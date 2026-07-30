import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(
        process.cwd(),
        "supabase/migrations/20260730_acknowledgement_receipts.sql",
    ),
    "utf8",
);

function extractFunction(name: string): string {
    const startMarker = `CREATE OR REPLACE FUNCTION public.${name}(`;
    const start = migration.indexOf(startMarker);
    const end = migration.indexOf("\n$$;", start);

    if (start === -1 || end === -1) {
        throw new Error(`Could not find SQL function ${name}`);
    }

    return migration.slice(start, end + 4);
}

function extractTable(name: string): string {
    const startMarker = `CREATE TABLE IF NOT EXISTS public.${name} (`;
    const start = migration.indexOf(startMarker);
    const end = migration.indexOf("\n\nCREATE ", start);

    if (start === -1 || end === -1) {
        throw new Error(`Could not find SQL table ${name}`);
    }

    return migration.slice(start, end);
}

describe("acknowledgement migration safety contracts", () => {
    it("uses NULL-safe same-payer comparison when linking a paid transaction", () => {
        expect(extractFunction("ack_set_transaction_paid")).toMatch(
            /v_transaction\.person_id\s+IS DISTINCT FROM\s+v_receipt\.payer_person_id/,
        );
    });

    it("stores browser-safe camelCase revision snapshots without raw row serialization", () => {
        const snapshotFunction = extractFunction("ack_snapshot_receipt");

        expect(snapshotFunction).not.toContain("to_jsonb(v_receipt)");
        expect(snapshotFunction).not.toContain("to_jsonb(receipt_file)");
        expect(snapshotFunction).toContain("'receiptNumber'");
        expect(snapshotFunction).toContain("'proofs'");
        expect(snapshotFunction).not.toContain("'storagePath'");
        expect(snapshotFunction).not.toContain("'storage_path'");
    });

    it("makes void and receipt-event subject checks explicitly NULL-safe", () => {
        expect(extractTable("acknowledgement_receipts")).toMatch(
            /voided_at IS NOT NULL\s+AND void_reason IS NOT NULL\s+AND length\(btrim\(void_reason\)\) BETWEEN 1 AND 1000/,
        );
        expect(extractTable("acknowledgement_receipt_events")).toMatch(
            /receipt_id IS NOT NULL[\s\S]*revision_number IS NOT NULL[\s\S]*revision_number > 0/,
        );
    });

    it("locks receipt before transaction for linked paid updates while preserving transaction-only updates", () => {
        const paidFunction = extractFunction("ack_set_transaction_paid");
        const transactionOnlyStart = paidFunction.indexOf(
            "IF p_receipt_id IS NULL THEN",
        );
        const transactionOnlyEnd = paidFunction.indexOf(
            "IF NOT p_paid THEN",
            transactionOnlyStart,
        );
        const transactionOnlyBranch = paidFunction.slice(
            transactionOnlyStart,
            transactionOnlyEnd,
        );
        const linkedBranch = paidFunction.slice(transactionOnlyEnd);

        expect(transactionOnlyBranch).toContain("FROM public.transactions");
        expect(transactionOnlyBranch).toContain("SET paid = p_paid");
        expect(transactionOnlyBranch).toContain("RETURN jsonb_build_object");

        const receiptLock = linkedBranch.indexOf(
            "FROM public.acknowledgement_receipts",
        );
        const transactionLock = linkedBranch.indexOf(
            "FROM public.transactions",
        );

        expect(receiptLock).toBeGreaterThan(-1);
        expect(transactionLock).toBeGreaterThan(receiptLock);
    });

    it("returns an unchanged receipt before snapshotting or resetting confirmations", () => {
        const updateFunction = extractFunction("ack_update_receipt");
        const noOpCheck = updateFunction.indexOf("v_is_unchanged");
        const noOpReturn = updateFunction.indexOf(
            "RETURN v_receipt;",
            noOpCheck,
        );
        const snapshot = updateFunction.indexOf(
            "PERFORM public.ack_snapshot_receipt",
        );

        expect(noOpCheck).toBeGreaterThan(-1);
        expect(updateFunction).toContain("EXCEPT");
        expect(noOpReturn).toBeGreaterThan(noOpCheck);
        expect(noOpReturn).toBeLessThan(snapshot);
    });

    it("prevents receipt reassignment for existing proof metadata", () => {
        const limitFunction = extractFunction("ack_enforce_active_file_limit");

        expect(limitFunction).toMatch(
            /NEW\.receipt_id\s+IS DISTINCT FROM\s+OLD\.receipt_id/,
        );
        expect(migration).toMatch(
            /BEFORE INSERT OR UPDATE OF receipt_id, removed_at\s+ON public\.acknowledgement_receipt_files/,
        );
    });

    it("keeps completed receipts read-only for payer proof mutations", () => {
        expect(extractFunction("ack_register_file")).toMatch(
            /p_uploader_role = 'payer'\s+AND v_receipt\.completed_at IS NOT NULL/,
        );
        expect(extractFunction("ack_remove_file")).toMatch(
            /p_actor_role = 'payer'\s+AND v_receipt\.completed_at IS NOT NULL/,
        );
    });
});
