import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260731_harden_portal_credentials.sql",
);
const migration = existsSync(migrationPath)
    ? readFileSync(migrationPath, "utf8")
    : "";

const extractFunction = (name: string) => {
    const start = migration.indexOf(
        `CREATE OR REPLACE FUNCTION public.${name}(`,
    );
    const end = migration.indexOf("\n$$;", start);
    return start === -1 || end === -1 ? "" : migration.slice(start, end + 4);
};

describe("portal credential hardening migration", () => {
    it("checks the receipt revision before conditionally creating portal access", () => {
        const publish = extractFunction("ack_publish_receipt_with_portal");
        const receiptLock = publish.indexOf(
            "FROM public.acknowledgement_receipts",
        );
        const staleCheck = publish.indexOf(
            "v_receipt.revision_number <> p_expected_revision",
        );
        const portalInsert = publish.indexOf(
            "INSERT INTO public.payer_portal_access",
        );

        expect(receiptLock).toBeGreaterThan(-1);
        expect(staleCheck).toBeGreaterThan(receiptLock);
        expect(portalInsert).toBeGreaterThan(staleCheck);
        expect(publish).toContain("ON CONFLICT (person_id) DO NOTHING");
        expect(publish).toContain("portal_created");
    });

    it("returns no PIN hash from the atomic publish RPC", () => {
        const publish = extractFunction("ack_publish_receipt_with_portal");
        const returnedPayload = publish.slice(
            publish.lastIndexOf("RETURN jsonb_build_object"),
        );

        expect(returnedPayload).toContain("'portal'");
        expect(returnedPayload).toContain("'portal_created'");
        expect(returnedPayload).not.toContain("'pin_hash'");
    });

    it("performs every portal credential mutation and audit event in one RPC", () => {
        const manage = extractFunction("ack_manage_portal_access");

        for (const action of [
            "generate-pin",
            "reset-pin",
            "rotate-link",
            "revoke",
            "reactivate",
        ]) {
            expect(manage).toContain(`'${action}'`);
        }
        expect(manage).toContain("FOR UPDATE");
        expect(manage).toContain("ON CONFLICT (person_id) DO NOTHING");
        expect(manage).toContain(
            "INSERT INTO public.acknowledgement_receipt_events",
        );
    });

    it("increments the version once on a real revoke and preserves it on reactivate", () => {
        const manage = extractFunction("ack_manage_portal_access");
        const revokeStart = manage.indexOf("ELSIF p_action = 'revoke' THEN");
        const reactivateStart = manage.indexOf(
            "ELSIF p_action = 'reactivate' THEN",
        );
        const revokeBranch = manage.slice(revokeStart, reactivateStart);
        const reactivateBranch = manage.slice(reactivateStart);

        expect(revokeBranch).toContain("v_portal.revoked_at IS NULL");
        expect(revokeBranch).toContain(
            "credential_version = credential_version + 1",
        );
        expect(reactivateBranch).not.toContain(
            "credential_version = credential_version + 1",
        );
    });

    it("keeps both new RPCs service-role-only without overloading ack_publish_receipt", () => {
        expect(migration).not.toContain(
            "CREATE OR REPLACE FUNCTION public.ack_publish_receipt(",
        );
        for (const signature of [
            "public.ack_manage_portal_access(uuid, text, text, uuid)",
            "public.ack_publish_receipt_with_portal(uuid, integer, text, uuid)",
        ]) {
            expect(migration).toContain(
                `REVOKE ALL ON FUNCTION ${signature}\n    FROM PUBLIC, anon, authenticated;`,
            );
            expect(migration).toContain(
                `GRANT EXECUTE ON FUNCTION ${signature}\n    TO service_role;`,
            );
        }
    });
});
