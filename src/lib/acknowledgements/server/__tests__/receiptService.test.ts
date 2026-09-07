import { describe, expect, it, vi } from "vitest";

import type { PayerPortalAdminView } from "../../types";
import {
    ReceiptConflictError,
    ReceiptNotFoundError,
    ReceiptValidationError,
} from "../http";
import {
    createReceiptService,
    type ReceiptDataClient,
} from "../receiptService";
import { createPortalAdminService } from "../portalAdminService";

type QueryResult = {
    data: unknown;
    error: Record<string, unknown> | null;
};

type QueryOperation = {
    kind: string;
    args: unknown[];
};

class FakeQuery implements PromiseLike<QueryResult> {
    readonly operations: QueryOperation[] = [];

    constructor(private readonly result: QueryResult) {}

    private record(kind: string, ...args: unknown[]) {
        this.operations.push({ kind, args });
        return this;
    }

    select(...args: unknown[]) {
        return this.record("select", ...args);
    }

    insert(...args: unknown[]) {
        return this.record("insert", ...args);
    }

    update(...args: unknown[]) {
        return this.record("update", ...args);
    }

    eq(...args: unknown[]) {
        return this.record("eq", ...args);
    }

    gte(...args: unknown[]) {
        return this.record("gte", ...args);
    }

    lte(...args: unknown[]) {
        return this.record("lte", ...args);
    }

    or(...args: unknown[]) {
        return this.record("or", ...args);
    }

    order(...args: unknown[]) {
        return this.record("order", ...args);
    }

    maybeSingle(...args: unknown[]) {
        return this.record("maybeSingle", ...args);
    }

    then<TResult1 = QueryResult, TResult2 = never>(
        onfulfilled?:
            | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
            | null,
        onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
    ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(this.result).then(onfulfilled, onrejected);
    }
}

class FakeClient implements ReceiptDataClient {
    readonly queries = new Map<string, FakeQuery[]>();
    readonly rpcCalls: Array<{ name: string; args: Record<string, unknown> }> =
        [];
    readonly fromCalls: string[] = [];
    readonly events: string[] = [];

    private readonly tableResults = new Map<string, QueryResult[]>();
    private readonly rpcResults = new Map<string, QueryResult[]>();

    queueTable(table: string, ...results: QueryResult[]) {
        this.tableResults.set(table, results);
    }

    queueRpc(name: string, ...results: QueryResult[]) {
        this.rpcResults.set(name, results);
    }

    from(table: string) {
        this.fromCalls.push(table);
        const result = this.tableResults.get(table)?.shift() ?? {
            data: [],
            error: null,
        };
        const query = new FakeQuery(result);
        this.queries.set(table, [...(this.queries.get(table) ?? []), query]);
        return query;
    }

    async rpc(name: string, args: Record<string, unknown>) {
        this.events.push(`rpc:${name}`);
        this.rpcCalls.push({ name, args });
        return (
            this.rpcResults.get(name)?.shift() ?? {
                data: null,
                error: null,
            }
        );
    }
}

const receiptRow = {
    id: "00000000-0000-4000-8000-000000000010",
    receipt_number: "AR-2026-000001",
    payer_person_id: "00000000-0000-4000-8000-000000000020",
    payer_name_snapshot: "Ada Payer",
    receiver_name: "Rene Receiver",
    amount: "1250.50",
    currency: "PHP",
    payment_date: "2026-07-30",
    notes: null,
    revision_number: 2,
    published_at: "2026-07-30T01:00:00.000Z",
    payer_confirmed_at: null,
    receiver_confirmed_at: null,
    completed_at: null,
    is_completed: false,
    voided_at: null,
    void_reason: null,
    status: "awaiting_both",
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T01:00:00.000Z",
    transaction_count: 1,
    proof_count: 0,
    pin_hash: "must-never-escape",
    storage_path: "must-never-escape",
};

const portalRow = {
    person_id: "00000000-0000-4000-8000-000000000020",
    payer_name: "Ada Payer",
    public_id: "00000000-0000-4000-8000-000000000040",
    credential_version: 1,
    revoked_at: null,
    last_accessed_at: null,
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z",
    persons: { name: "Ada Payer" },
    pin_hash: "must-never-escape",
};

const expectedPortal: PayerPortalAdminView = {
    personId: "00000000-0000-4000-8000-000000000020",
    payerName: "Ada Payer",
    publicId: "00000000-0000-4000-8000-000000000040",
    credentialVersion: 1,
    revokedAt: null,
    lastAccessedAt: null,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
};

const detailTableResults = (row: Record<string, unknown> = receiptRow) => ({
    acknowledgement_receipt_overview: [
        { data: row, error: null },
    ] satisfies QueryResult[],
    acknowledgement_receipt_transactions: [
        { data: [], error: null },
    ] satisfies QueryResult[],
    acknowledgement_receipt_files: [
        { data: [], error: null },
    ] satisfies QueryResult[],
    acknowledgement_receipt_revisions: [
        { data: [], error: null },
    ] satisfies QueryResult[],
    acknowledgement_receipt_events: [
        { data: [], error: null },
    ] satisfies QueryResult[],
});

const queueReceiptDetail = (
    client: FakeClient,
    row: Record<string, unknown> = receiptRow,
) => {
    for (const [table, results] of Object.entries(detailTableResults(row))) {
        client.queueTable(table, ...results);
    }
};

describe("receiver receipt service", () => {
    it("serializes list rows into browser-safe receipt summaries", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipt_overview", {
            data: [receiptRow],
            error: null,
        });

        const result = await createReceiptService(client).listReceipts();

        expect(result).toEqual([
            {
                id: "00000000-0000-4000-8000-000000000010",
                receiptNumber: "AR-2026-000001",
                payerPersonId: "00000000-0000-4000-8000-000000000020",
                payerName: "Ada Payer",
                receiverName: "Rene Receiver",
                amount: 1250.5,
                currency: "PHP",
                paymentDate: "2026-07-30",
                notes: null,
                revisionNumber: 2,
                publishedAt: "2026-07-30T01:00:00.000Z",
                payerConfirmedAt: null,
                receiverConfirmedAt: null,
                completedAt: null,
                isCompleted: false,
                voidedAt: null,
                voidReason: null,
                status: "awaiting_both",
                createdAt: "2026-07-30T00:00:00.000Z",
                updatedAt: "2026-07-30T01:00:00.000Z",
                transactionCount: 1,
                proofCount: 0,
            },
        ]);
        expect(JSON.stringify(result)).not.toContain("pin_hash");
        expect(JSON.stringify(result)).not.toContain("storage_path");
    });

    it("removes database-only fields recursively from receipt details", async () => {
        const client = new FakeClient();
        queueReceiptDetail(client);
        client.queueTable("acknowledgement_receipt_events", {
            data: [
                {
                    id: "00000000-0000-4000-8000-000000000050",
                    event_type: "proof_added",
                    actor_role: "receiver",
                    revision_number: 2,
                    details: {
                        file_id: "00000000-0000-4000-8000-000000000060",
                        storage_path: "private/receipt/file.png",
                        nested: { pin_hash: "must-never-escape" },
                    },
                    created_at: "2026-07-30T01:00:00.000Z",
                },
            ],
            error: null,
        });

        const result = await createReceiptService(client).getReceipt(
            "00000000-0000-4000-8000-000000000010",
        );

        expect(result.events[0].details).toEqual({
            file_id: "00000000-0000-4000-8000-000000000060",
            nested: {},
        });
        expect(JSON.stringify(result)).not.toContain("storage_path");
        expect(JSON.stringify(result)).not.toContain("pin_hash");
    });

    it("hydrates only active receiver-detail proofs and never returns raw paths", async () => {
        const client = new FakeClient();
        queueReceiptDetail(client);
        const activeRow = {
            id: "00000000-0000-4000-8000-000000000060",
            receipt_id: receiptRow.id,
            storage_path: `receipts/${receiptRow.id}/tmp/00000000-0000-4000-8000-000000000070`,
            original_filename: "active.png",
            content_type: "image/png",
            size_bytes: 12,
            uploader_role: "receiver",
            removed_at: null,
            created_at: "2026-07-30T01:00:00.000Z",
        };
        const removedRow = {
            ...activeRow,
            id: "00000000-0000-4000-8000-000000000061",
            original_filename: "removed.png",
            removed_at: "2026-07-30T02:00:00.000Z",
        };
        client.queueTable("acknowledgement_receipt_files", {
            data: [activeRow, removedRow],
            error: null,
        });
        const hydrateProofRows = vi.fn(async () => [
            {
                id: activeRow.id,
                originalFilename: activeRow.original_filename,
                contentType: "image/png" as const,
                sizeBytes: 12,
                uploaderRole: "receiver" as const,
                removedAt: null,
                createdAt: activeRow.created_at,
                downloadUrl: "https://storage.example/signed-active",
            },
        ]);

        const result = await createReceiptService(client, {
            hydrateProofRows,
        }).getReceipt(receiptRow.id);

        expect(hydrateProofRows).toHaveBeenCalledWith([activeRow]);
        expect(result.proofs).toEqual([
            expect.objectContaining({
                originalFilename: "active.png",
                downloadUrl: "https://storage.example/signed-active",
            }),
            expect.objectContaining({
                originalFilename: "removed.png",
                removedAt: "2026-07-30T02:00:00.000Z",
            }),
        ]);
        expect(result.proofs[1]).not.toHaveProperty("downloadUrl");
        expect(JSON.stringify(result)).not.toContain("storage_path");
    });

    it("maps a stale-revision RPC error to ReceiptConflictError", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_update_receipt", {
            data: null,
            error: {
                code: "40001",
                message: "receipt revision conflict",
                status: 409,
            },
        });

        await expect(
            createReceiptService(client).updateReceipt(
                "00000000-0000-4000-8000-000000000010",
                {
                    payerPersonId: "00000000-0000-4000-8000-000000000020",
                    receiverName: "Rene Receiver",
                    amount: 1250.5,
                    currency: "PHP",
                    paymentDate: "2026-07-30",
                    notes: null,
                    transactionIds: [],
                    expectedRevision: 1,
                },
            ),
        ).rejects.toBeInstanceOf(ReceiptConflictError);
    });

    it("maps a missing detail row to ReceiptNotFoundError", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipt_overview", {
            data: null,
            error: null,
        });

        await expect(
            createReceiptService(client).getReceipt(
                "00000000-0000-4000-8000-000000000099",
            ),
        ).rejects.toBeInstanceOf(ReceiptNotFoundError);
    });

    it("forwards only schema-approved create fields to the RPC", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_create_receipt", {
            data: receiptRow,
            error: null,
        });
        queueReceiptDetail(client);

        const result = await createReceiptService(client).createReceipt({
            payerPersonId: "00000000-0000-4000-8000-000000000020",
            receiverName: "  Rene Receiver  ",
            amount: 1250.5,
            paymentDate: "2026-07-30",
            notes: null,
            transactionIds: ["00000000-0000-4000-8000-000000000030"],
        });

        expect(result.receiptNumber).toBe("AR-2026-000001");
        expect(client.rpcCalls).toEqual([
            {
                name: "ack_create_receipt",
                args: {
                    p_payer_person_id: "00000000-0000-4000-8000-000000000020",
                    p_receiver_name: "Rene Receiver",
                    p_amount: 1250.5,
                    p_currency: "PHP",
                    p_payment_date: "2026-07-30",
                    p_notes: null,
                    p_transaction_ids: ["00000000-0000-4000-8000-000000000030"],
                },
            },
        ]);
    });

    it("filters form transactions by the selected payer", async () => {
        const client = new FakeClient();
        client.queueTable("persons", {
            data: [
                {
                    id: "00000000-0000-4000-8000-000000000020",
                    name: "Ada Payer",
                },
            ],
            error: null,
        });
        client.queueTable("transactions", {
            data: [
                {
                    id: "00000000-0000-4000-8000-000000000030",
                    person_id: "00000000-0000-4000-8000-000000000020",
                    date: "2026-07-30",
                    description: "Card payment",
                    amount: "1250.50",
                    paid: true,
                    acknowledgement_receipt_transactions: [],
                },
            ],
            error: null,
        });

        const result = await createReceiptService(client).getReceiptFormMeta(
            "00000000-0000-4000-8000-000000000020",
        );

        expect(result.transactions).toEqual([
            {
                id: "00000000-0000-4000-8000-000000000030",
                personId: "00000000-0000-4000-8000-000000000020",
                date: "2026-07-30",
                description: "Card payment",
                amount: 1250.5,
                paid: true,
                alreadyReferenced: false,
            },
        ]);
        expect(
            client.queries.get("transactions")?.[0].operations,
        ).toContainEqual({
            kind: "eq",
            args: ["person_id", "00000000-0000-4000-8000-000000000020"],
        });
    });

    it("maps invalid RPC input to ReceiptValidationError", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_void_receipt", {
            data: null,
            error: { code: "22023", message: "invalid void reason" },
        });

        await expect(
            createReceiptService(client).performReceiptAction(
                "00000000-0000-4000-8000-000000000010",
                { type: "void", expectedRevision: 2, reason: "duplicate" },
            ),
        ).rejects.toBeInstanceOf(ReceiptValidationError);
    });

    it("atomically publishes and returns a newly created transient portal PIN", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_publish_receipt_with_portal", {
            data: {
                receipt_id: receiptRow.id,
                portal_created: true,
                portal: {
                    person_id: receiptRow.payer_person_id,
                    payer_name: "Ada Payer",
                    public_id: "00000000-0000-4000-8000-000000000040",
                    credential_version: 1,
                    revoked_at: null,
                    last_accessed_at: null,
                    created_at: "2026-07-30T00:00:00.000Z",
                    updated_at: "2026-07-30T00:00:00.000Z",
                },
            },
            error: null,
        });
        queueReceiptDetail(client);

        const result = await createReceiptService(client, {
            generatePin: () => "123456",
            hashPin: async () => "scrypt$publish-salt$publish-hash",
            createPublicId: () => "00000000-0000-4000-8000-000000000040",
        }).performReceiptAction("00000000-0000-4000-8000-000000000010", {
            type: "publish",
            expectedRevision: 2,
        });

        expect(result).toEqual({
            receipt: expect.objectContaining({
                id: "00000000-0000-4000-8000-000000000010",
            }),
            portalCredential: {
                portal: expectedPortal,
                pin: "123456",
            },
        });
        expect(client.rpcCalls).toEqual([
            {
                name: "ack_publish_receipt_with_portal",
                args: {
                    p_receipt_id: "00000000-0000-4000-8000-000000000010",
                    p_expected_revision: 2,
                    p_pin_hash: "scrypt$publish-salt$publish-hash",
                    p_public_id: "00000000-0000-4000-8000-000000000040",
                },
            },
        ]);
        expect(JSON.stringify(result)).not.toContain("publish-hash");
    });

    it("returns no plaintext PIN when atomic publish finds an existing portal", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_publish_receipt_with_portal", {
            data: {
                receipt_id: receiptRow.id,
                portal_created: false,
                portal: {
                    person_id: receiptRow.payer_person_id,
                    payer_name: "Ada Payer",
                    public_id: "00000000-0000-4000-8000-000000000040",
                    credential_version: 4,
                    revoked_at: null,
                    last_accessed_at: null,
                    created_at: "2026-07-30T00:00:00.000Z",
                    updated_at: "2026-07-30T00:00:00.000Z",
                },
            },
            error: null,
        });
        queueReceiptDetail(client);

        const result = await createReceiptService(client, {
            generatePin: () => "999999",
            hashPin: async () => "scrypt$unused-salt$unused-hash",
            createPublicId: () => "00000000-0000-4000-8000-000000000099",
        }).performReceiptAction("00000000-0000-4000-8000-000000000010", {
            type: "publish",
            expectedRevision: 2,
        });

        expect(result.portalCredential).toEqual({
            portal: { ...expectedPortal, credentialVersion: 4 },
            pin: null,
        });
        expect(JSON.stringify(result)).not.toContain("999999");
    });

    it("preserves stale-revision conflict priority before any portal read", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_publish_receipt_with_portal", {
            data: null,
            error: { code: "40001", message: "stale receipt revision" },
        });

        await expect(
            createReceiptService(client, {
                generatePin: () => "123456",
                hashPin: async () => "scrypt$stale-salt$stale-hash",
                createPublicId: () => "00000000-0000-4000-8000-000000000040",
            }).performReceiptAction("00000000-0000-4000-8000-000000000010", {
                type: "publish",
                expectedRevision: 1,
            }),
        ).rejects.toBeInstanceOf(ReceiptConflictError);
        expect(client.fromCalls).toEqual([]);
        expect(client.rpcCalls).toHaveLength(1);
    });
});

describe("portal administration", () => {
    it("returns an existing portal without exposing its PIN hash", async () => {
        const client = new FakeClient();
        client.queueTable("payer_portal_access", {
            data: portalRow,
            error: null,
        });

        const portal = await createPortalAdminService(client).getPortalAccess(
            "00000000-0000-4000-8000-000000000020",
        );

        expect(portal).toEqual(expectedPortal);
        expect(JSON.stringify(portal)).not.toContain("pin_hash");
    });

    it("returns plaintext only while generating a new credential", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_manage_portal_access", {
            data: { portal: portalRow, credential_changed: true },
            error: null,
        });
        const generateCredentialPin = vi.fn(() => "123456");
        const hashCredentialPin = vi.fn(async () => "scrypt$salt$hash");

        const result = await createPortalAdminService(client, {
            generatePin: generateCredentialPin,
            hashPin: hashCredentialPin,
            createPublicId: () => "00000000-0000-4000-8000-000000000040",
        }).managePortalAccess("00000000-0000-4000-8000-000000000020", {
            type: "generate-pin",
        });

        expect(result).toEqual({ portal: expectedPortal, pin: "123456" });
        expect(JSON.stringify(result)).not.toContain("scrypt$salt$hash");
        expect(client.rpcCalls).toEqual([
            {
                name: "ack_manage_portal_access",
                args: {
                    p_person_id: "00000000-0000-4000-8000-000000000020",
                    p_action: "generate-pin",
                    p_pin_hash: "scrypt$salt$hash",
                    p_public_id: "00000000-0000-4000-8000-000000000040",
                },
            },
        ]);
        expect(client.fromCalls).toEqual([]);
    });

    it("resets the PIN and writes its audit event through one atomic RPC", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_manage_portal_access", {
            data: {
                portal: {
                    ...portalRow,
                    credential_version: 2,
                    updated_at: "2026-07-30T02:00:00.000Z",
                },
                credential_changed: true,
            },
            error: null,
        });

        const result = await createPortalAdminService(client, {
            generatePin: () => "654321",
            hashPin: async () => "scrypt$new-salt$new-hash",
        }).managePortalAccess("00000000-0000-4000-8000-000000000020", {
            type: "reset-pin",
        });

        expect(result.pin).toBe("654321");
        expect(result.portal.credentialVersion).toBe(2);
        expect(client.rpcCalls).toEqual([
            {
                name: "ack_manage_portal_access",
                args: {
                    p_person_id: "00000000-0000-4000-8000-000000000020",
                    p_action: "reset-pin",
                    p_pin_hash: "scrypt$new-salt$new-hash",
                    p_public_id: null,
                },
            },
        ]);
        expect(client.fromCalls).toEqual([]);
    });

    it("rotates the public link and increments the credential version without returning a PIN", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_manage_portal_access", {
            data: {
                portal: {
                    ...portalRow,
                    public_id: "00000000-0000-4000-8000-000000000041",
                    credential_version: 2,
                },
                credential_changed: true,
            },
            error: null,
        });

        const result = await createPortalAdminService(client, {
            createPublicId: () => "00000000-0000-4000-8000-000000000041",
        }).managePortalAccess("00000000-0000-4000-8000-000000000020", {
            type: "rotate-link",
        });

        expect(result.pin).toBeNull();
        expect(result.portal).toMatchObject({
            publicId: "00000000-0000-4000-8000-000000000041",
            credentialVersion: 2,
        });
        expect(client.rpcCalls).toEqual([
            {
                name: "ack_manage_portal_access",
                args: {
                    p_person_id: "00000000-0000-4000-8000-000000000020",
                    p_action: "rotate-link",
                    p_pin_hash: null,
                    p_public_id: "00000000-0000-4000-8000-000000000041",
                },
            },
        ]);
    });

    it("keeps the revoked version invalid after reactivation", async () => {
        const client = new FakeClient();
        client.queueRpc(
            "ack_manage_portal_access",
            {
                data: {
                    portal: {
                        ...portalRow,
                        credential_version: 2,
                        revoked_at: "2026-07-30T03:00:00.000Z",
                    },
                    credential_changed: true,
                },
                error: null,
            },
            {
                data: {
                    portal: {
                        ...portalRow,
                        credential_version: 2,
                        revoked_at: null,
                    },
                    credential_changed: true,
                },
                error: null,
            },
        );
        const service = createPortalAdminService(client);

        const revoked = await service.managePortalAccess(
            "00000000-0000-4000-8000-000000000020",
            { type: "revoke" },
        );
        const reactivated = await service.managePortalAccess(
            "00000000-0000-4000-8000-000000000020",
            { type: "reactivate" },
        );

        expect(revoked.portal).toMatchObject({
            credentialVersion: 2,
            revokedAt: "2026-07-30T03:00:00.000Z",
        });
        expect(reactivated.portal).toMatchObject({
            credentialVersion: 2,
            revokedAt: null,
        });
        expect(client.rpcCalls.map(({ args }) => args)).toEqual([
            {
                p_person_id: "00000000-0000-4000-8000-000000000020",
                p_action: "revoke",
                p_pin_hash: null,
                p_public_id: null,
            },
            {
                p_person_id: "00000000-0000-4000-8000-000000000020",
                p_action: "reactivate",
                p_pin_hash: null,
                p_public_id: null,
            },
        ]);
        expect(client.fromCalls).toEqual([]);
    });
});
