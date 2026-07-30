import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260731180000_finalize_interrupted_payer_unlocks.sql",
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

describe("interrupted payer unlock migration", () => {
    it("ships as a new upgrade after the auth-race migration", () => {
        expect(migration).not.toBe("");
        expect(migrationPath).toMatch(
            /20260731180000_finalize_interrupted_payer_unlocks\.sql$/,
        );
    });

    it("finalizes the locked reservation when the live credential changed", () => {
        const complete = extractFunction("ack_complete_payer_portal_unlock");
        const portalRead = complete.indexOf("FROM public.payer_portal_access");
        const mismatch = complete.indexOf("IF NOT FOUND", portalRead);
        const mismatchReturn = complete.indexOf("RETURN NULL;", mismatch);
        const mismatchBranch = complete.slice(mismatch, mismatchReturn);

        expect(complete).toContain(
            "v_portal.credential_version <> p_credential_version",
        );
        expect(complete).toContain(
            "v_portal.public_id IS DISTINCT FROM p_public_id",
        );
        expect(complete).toContain("v_portal.revoked_at IS NOT NULL");
        expect(mismatchBranch).toContain(
            "UPDATE public.payer_portal_pin_attempts",
        );
        expect(mismatchBranch).toContain(
            "SET finalized_at = clock_timestamp()",
        );
        expect(mismatchBranch).toContain("WHERE id = v_attempt.id");
    });

    it("keeps bucket-before-row lock ordering and preserves unrelated pending reservations", () => {
        const complete = extractFunction("ack_complete_payer_portal_unlock");
        const initialRead = complete.indexOf(
            "FROM public.payer_portal_pin_attempts",
        );
        const advisoryLock = complete.indexOf("pg_advisory_xact_lock");
        const reservationLock = complete.indexOf("FOR UPDATE", advisoryLock);
        const portalRead = complete.indexOf("FROM public.payer_portal_access");
        const mismatch = complete.indexOf("IF NOT FOUND", portalRead);
        const mismatchReturn = complete.indexOf("RETURN NULL;", mismatch);
        const mismatchBranch = complete.slice(mismatch, mismatchReturn);

        expect(initialRead).toBeGreaterThan(-1);
        expect(advisoryLock).toBeGreaterThan(initialRead);
        expect(reservationLock).toBeGreaterThan(advisoryLock);
        expect(complete.slice(initialRead, advisoryLock)).not.toContain(
            "FOR UPDATE",
        );
        expect(mismatchBranch).not.toContain("DELETE FROM");
        expect(mismatchBranch).not.toContain("portal_scope_hash =");
        expect(mismatchBranch).not.toContain("network_hash =");
    });

    it("keeps the replacement signature service-role-only", () => {
        const signature =
            "public.ack_complete_payer_portal_unlock(uuid, uuid, integer, text, text)";

        expect(migration).toContain(
            `REVOKE ALL ON FUNCTION ${signature}\n    FROM PUBLIC, anon, authenticated;`,
        );
        expect(migration).toContain(
            `GRANT EXECUTE ON FUNCTION ${signature}\n    TO service_role;`,
        );
    });
});
