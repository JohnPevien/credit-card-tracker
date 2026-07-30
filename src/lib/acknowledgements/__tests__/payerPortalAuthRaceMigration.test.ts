import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260731170000_close_payer_portal_auth_races.sql",
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

describe("payer portal auth-race migration", () => {
    it("upgrades ephemeral attempts to isolated portal-scope buckets", () => {
        expect(migration).not.toBe("");
        expect(migrationPath).toMatch(
            /20260731170000_close_payer_portal_auth_races\.sql$/,
        );
        const clear = migration.indexOf(
            "DELETE FROM public.payer_portal_pin_attempts;",
        );
        const addScope = migration.indexOf("portal_scope_hash text");
        expect(clear).toBeGreaterThan(-1);
        expect(addScope).toBeGreaterThan(clear);
        expect(migration).toContain("finalized_at timestamptz");
        expect(migration).toContain(
            "payer_portal_pin_attempts_scope_limit_idx",
        );
        expect(migration).toMatch(
            /portal_scope_hash\s+~\s+'\^\[0-9a-f\]\{64\}\$'/,
        );
    });

    it("counts and locks only the candidate scope plus obscured network", () => {
        const reserve = extractFunction("ack_reserve_payer_portal_attempt");
        const countStart = reserve.indexOf("SELECT count(*)");
        const insertStart = reserve.indexOf(
            "INSERT INTO public.payer_portal_pin_attempts",
        );
        const countWindow = reserve.slice(countStart, insertStart);

        expect(reserve).toContain("p_portal_scope_hash text");
        expect(reserve).toContain("pg_advisory_xact_lock");
        expect(countWindow).toContain(
            "portal_scope_hash = p_portal_scope_hash",
        );
        expect(countWindow).toContain("network_hash = p_network_hash");
        expect(countWindow).not.toContain("portal_person_id");
    });

    it.each([
        "ack_finalize_payer_portal_attempt",
        "ack_complete_payer_portal_unlock",
    ])(
        "%s acquires the bucket advisory lock before any reservation row lock",
        (name) => {
            const fn = extractFunction(name);
            const initialRead = fn.indexOf(
                "FROM public.payer_portal_pin_attempts",
            );
            const advisoryLock = fn.indexOf("pg_advisory_xact_lock");
            const rowLock = fn.indexOf("FOR UPDATE", advisoryLock);

            expect(initialRead).toBeGreaterThan(-1);
            expect(advisoryLock).toBeGreaterThan(initialRead);
            expect(rowLock).toBeGreaterThan(advisoryLock);
            expect(fn.slice(initialRead, advisoryLock)).not.toContain(
                "FOR UPDATE",
            );
        },
    );

    it("finalizes failures and preserves other pending reservations on success", () => {
        const finalize = extractFunction("ack_finalize_payer_portal_attempt");
        const complete = extractFunction("ack_complete_payer_portal_unlock");

        expect(finalize).toContain("finalized_at = clock_timestamp()");
        expect(complete).toMatch(
            /finalized_at IS NOT NULL[\s\S]*OR reservation_id = p_reservation_id/,
        );
        expect(complete).not.toMatch(
            /DELETE FROM public\.payer_portal_pin_attempts[\s\S]*WHERE portal_scope_hash = p_portal_scope_hash[\s\S]*AND network_hash = p_network_hash\s*;/,
        );
    });

    it("locks and validates payer ownership before database-owned confirmation", () => {
        const confirm = extractFunction("ack_confirm_payer_receipt");
        const receiptRead = confirm.indexOf(
            "FROM public.acknowledgement_receipts",
        );
        const rowLock = confirm.indexOf("FOR UPDATE", receiptRead);
        const ownership = confirm.indexOf(
            "v_receipt.payer_person_id IS DISTINCT FROM p_authorized_person_id",
        );
        const confirmCall = confirm.indexOf("public.ack_confirm_receipt(");

        expect(receiptRead).toBeGreaterThan(-1);
        expect(rowLock).toBeGreaterThan(receiptRead);
        expect(ownership).toBeGreaterThan(rowLock);
        expect(confirm).toContain("v_receipt.published_at IS NULL");
        expect(confirm).toContain("v_receipt.voided_at IS NOT NULL");
        expect(confirm).toContain(
            "v_receipt.revision_number <> p_expected_revision",
        );
        expect(confirmCall).toBeGreaterThan(ownership);
        expect(confirm).toContain("'payer'");
    });

    it("removes stale overloads and grants only the replacement RPCs to service_role", () => {
        for (const oldSignature of [
            "public.ack_reserve_payer_portal_attempt(uuid, text, uuid)",
            "public.ack_complete_payer_portal_unlock(uuid, uuid, integer)",
        ]) {
            expect(migration).toContain(
                `DROP FUNCTION IF EXISTS ${oldSignature};`,
            );
        }

        for (const signature of [
            "public.ack_reserve_payer_portal_attempt(uuid, text, text, uuid)",
            "public.ack_finalize_payer_portal_attempt(uuid, text, text)",
            "public.ack_complete_payer_portal_unlock(uuid, uuid, integer, text, text)",
            "public.ack_confirm_payer_receipt(uuid, integer, uuid)",
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
