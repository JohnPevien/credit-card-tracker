import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260731153000_secure_payer_portal_access.sql",
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

describe("payer portal public-access migration", () => {
    it("uses a new 14-digit migration version and permits an anonymous throttle bucket", () => {
        expect(migration).not.toBe("");
        expect(migrationPath).toMatch(
            /20260731153000_secure_payer_portal_access\.sql$/,
        );
        expect(migration).toContain(
            "ALTER COLUMN portal_person_id DROP NOT NULL",
        );
        expect(migration).toContain("reservation_id uuid");
        expect(migration).toContain("UNIQUE (reservation_id)");
    });

    it("serializes rolling-window count and failure reservation in one transaction", () => {
        const reserve = extractFunction("ack_reserve_payer_portal_attempt");

        expect(reserve).toContain("pg_advisory_xact_lock");
        expect(reserve).toMatch(
            /attempted_at\s*>\s*clock_timestamp\(\)\s*-\s*interval '15 minutes'/,
        );
        expect(reserve).toMatch(/v_failure_count\s*>=\s*5/);
        expect(reserve).toContain(
            "INSERT INTO public.payer_portal_pin_attempts",
        );
        expect(reserve.indexOf("SELECT count(*)")).toBeLessThan(
            reserve.indexOf("INSERT INTO public.payer_portal_pin_attempts"),
        );
        expect(reserve).not.toContain("p_pin");
        expect(reserve).not.toContain("p_request_address");
    });

    it("revalidates the live credential and atomically clears failures with last access", () => {
        const complete = extractFunction("ack_complete_payer_portal_unlock");

        expect(complete).toContain("FOR UPDATE");
        expect(complete).toContain(
            "v_portal.credential_version <> p_credential_version",
        );
        expect(complete).toContain("v_portal.public_id <> p_public_id");
        expect(complete).toContain("v_portal.revoked_at IS NOT NULL");
        expect(complete).toContain(
            "DELETE FROM public.payer_portal_pin_attempts",
        );
        expect(complete).toContain("last_accessed_at = clock_timestamp()");
    });

    it("keeps both throttle functions service-role-only", () => {
        for (const signature of [
            "public.ack_reserve_payer_portal_attempt(uuid, text, uuid)",
            "public.ack_complete_payer_portal_unlock(uuid, uuid, integer)",
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
