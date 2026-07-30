import { describe, expect, it, vi } from "vitest";

import {
    PortalConflictError,
    PortalNotFoundError,
    createPortalService,
} from "../portalService";

const PUBLIC_ID = "00000000-0000-4000-8000-000000000040";
const PERSON_ID = "00000000-0000-4000-8000-000000000020";
const RECEIPT_ID = "00000000-0000-4000-8000-000000000010";
const RESERVATION_ID = "00000000-0000-4000-8000-000000000070";
const SECRET = "a-32-character-minimum-portal-secret";

type QueryResult = {
    data: unknown;
    error: { code?: string; message?: string; status?: number } | null;
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

    eq(...args: unknown[]) {
        return this.record("eq", ...args);
    }

    not(...args: unknown[]) {
        return this.record("not", ...args);
    }

    is(...args: unknown[]) {
        return this.record("is", ...args);
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

class FakeClient {
    readonly queries = new Map<string, FakeQuery[]>();
    readonly fromCalls: string[] = [];
    readonly rpcCalls: Array<{ name: string; args: Record<string, unknown> }> =
        [];
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
        const query = new FakeQuery(
            this.tableResults.get(table)?.shift() ?? {
                data: [],
                error: null,
            },
        );
        this.queries.set(table, [...(this.queries.get(table) ?? []), query]);
        return query;
    }

    async rpc(name: string, args: Record<string, unknown>) {
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
    id: RECEIPT_ID,
    receipt_number: "AR-2026-000001",
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
    proof_count: 1,
    payer_person_id: PERSON_ID,
    pin_hash: "must-never-escape",
    storage_path: "must-never-escape",
};

const rejectPin = async (pin: string, encoded: string) => {
    void pin;
    void encoded;
    return false;
};

const serviceWith = (
    client: FakeClient,
    verifyPin: (pin: string, encoded: string) => Promise<boolean> = vi.fn(
        rejectPin,
    ),
) =>
    createPortalService(client, {
        verifyPin,
        sessionSecret: SECRET,
        createReservationId: () => RESERVATION_ID,
    });

describe("payer portal unlock throttling", () => {
    it("HMAC-obscures the normalized trusted address before one atomic failure reservation RPC", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_reserve_payer_portal_attempt", {
            data: {
                allowed: true,
                reservation_id: RESERVATION_ID,
                portal: {
                    person_id: PERSON_ID,
                    public_id: PUBLIC_ID,
                    credential_version: 1,
                    revoked_at: null,
                    pin_hash: "scrypt$salt$hash",
                },
            },
            error: null,
        });
        const verifyPin = vi.fn(rejectPin);

        const result = await serviceWith(client, verifyPin).unlockPortal(
            PUBLIC_ID,
            "123456",
            " 203.0.113.10 ",
        );

        expect(result).toEqual({ kind: "invalid" });
        expect(verifyPin).toHaveBeenCalledWith("123456", "scrypt$salt$hash");
        expect(client.rpcCalls).toHaveLength(1);
        expect(client.rpcCalls[0]).toMatchObject({
            name: "ack_reserve_payer_portal_attempt",
            args: {
                p_public_id: PUBLIC_ID,
                p_reservation_id: RESERVATION_ID,
            },
        });
        const networkHash = client.rpcCalls[0].args.p_network_hash;
        expect(networkHash).toMatch(/^[a-f0-9]{64}$/);
        expect(networkHash).not.toBe("203.0.113.10");
    });

    it("uses comparable PIN work for an unknown portal and returns the same generic result", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_reserve_payer_portal_attempt", {
            data: {
                allowed: true,
                reservation_id: RESERVATION_ID,
                portal: null,
            },
            error: null,
        });
        const verifyPin = vi.fn(rejectPin);

        await expect(
            serviceWith(client, verifyPin).unlockPortal(
                PUBLIC_ID,
                "123456",
                null,
            ),
        ).resolves.toEqual({ kind: "invalid" });
        expect(verifyPin).toHaveBeenCalledOnce();
        expect(verifyPin.mock.calls[0][1]).toMatch(/^scrypt\$/);
        expect(client.rpcCalls).toHaveLength(1);
    });

    it("returns a bounded retry after five reserved failures without doing scrypt work", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_reserve_payer_portal_attempt", {
            data: {
                allowed: false,
                retry_after_seconds: 5000,
                portal: null,
            },
            error: null,
        });
        const verifyPin = vi.fn(async () => false);

        await expect(
            serviceWith(client, verifyPin).unlockPortal(
                PUBLIC_ID,
                "123456",
                null,
            ),
        ).resolves.toEqual({
            kind: "rate_limited",
            retryAfterSeconds: 900,
        });
        expect(verifyPin).not.toHaveBeenCalled();
    });

    it("atomically clears failures and records access only after a correct active credential", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_reserve_payer_portal_attempt", {
            data: {
                allowed: true,
                reservation_id: RESERVATION_ID,
                portal: {
                    person_id: PERSON_ID,
                    public_id: PUBLIC_ID,
                    credential_version: 4,
                    revoked_at: null,
                    pin_hash: "scrypt$salt$hash",
                },
            },
            error: null,
        });
        client.queueRpc("ack_complete_payer_portal_unlock", {
            data: {
                person_id: PERSON_ID,
                public_id: PUBLIC_ID,
                credential_version: 4,
            },
            error: null,
        });

        const result = await serviceWith(
            client,
            vi.fn(async () => true),
        ).unlockPortal(PUBLIC_ID, "123456", "203.0.113.10");

        expect(result).toEqual({
            kind: "authorized",
            session: {
                personId: PERSON_ID,
                publicId: PUBLIC_ID,
                credentialVersion: 4,
            },
        });
        expect(client.rpcCalls.map(({ name }) => name)).toEqual([
            "ack_reserve_payer_portal_attempt",
            "ack_complete_payer_portal_unlock",
        ]);
        expect(client.rpcCalls[1].args).toEqual({
            p_reservation_id: RESERVATION_ID,
            p_public_id: PUBLIC_ID,
            p_credential_version: 4,
        });
    });

    it("treats a revoked portal like a wrong PIN even when its hash verifies", async () => {
        const client = new FakeClient();
        client.queueRpc("ack_reserve_payer_portal_attempt", {
            data: {
                allowed: true,
                reservation_id: RESERVATION_ID,
                portal: {
                    person_id: PERSON_ID,
                    public_id: PUBLIC_ID,
                    credential_version: 4,
                    revoked_at: "2026-07-31T00:00:00.000Z",
                    pin_hash: "scrypt$salt$hash",
                },
            },
            error: null,
        });

        await expect(
            serviceWith(
                client,
                vi.fn(async () => true),
            ).unlockPortal(PUBLIC_ID, "123456", null),
        ).resolves.toEqual({ kind: "invalid" });
        expect(client.rpcCalls).toHaveLength(1);
    });
});

describe("payer-scoped published receipts", () => {
    it("always scopes the list by the authorized person and publication while retaining voided rows", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipt_overview", {
            data: [
                {
                    ...receiptRow,
                    voided_at: "2026-07-31T02:00:00.000Z",
                    void_reason: "Entered twice",
                    status: "voided",
                },
            ],
            error: null,
        });

        const receipts =
            await serviceWith(client).listPublishedReceipts(PERSON_ID);

        expect(receipts).toEqual([
            expect.objectContaining({
                id: RECEIPT_ID,
                status: "voided",
                voidReason: "Entered twice",
            }),
        ]);
        expect(JSON.stringify(receipts)).not.toContain("payer_person_id");
        expect(JSON.stringify(receipts)).not.toContain("pin_hash");
        expect(JSON.stringify(receipts)).not.toContain("storage_path");
        expect(
            client.queries.get("acknowledgement_receipt_overview")?.[0]
                .operations,
        ).toEqual(
            expect.arrayContaining([
                { kind: "eq", args: ["payer_person_id", PERSON_ID] },
                { kind: "not", args: ["published_at", "is", null] },
            ]),
        );
        expect(
            client.queries.get("acknowledgement_receipt_overview")?.[0]
                .operations,
        ).not.toContainEqual({
            kind: "is",
            args: ["voided_at", null],
        });
    });

    it("scopes detail and every child query without returning drafts or internal paths", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipt_overview", {
            data: receiptRow,
            error: null,
        });
        client.queueTable("acknowledgement_receipt_transactions", {
            data: [
                {
                    id: "00000000-0000-4000-8000-000000000030",
                    transaction_id: null,
                    transaction_date_snapshot: "2026-07-29",
                    description_snapshot: "Payment",
                    amount_snapshot: "1250.50",
                    created_at: "2026-07-30T00:00:00.000Z",
                    person_id: "unrelated",
                },
            ],
            error: null,
        });
        client.queueTable("acknowledgement_receipt_files", {
            data: [
                {
                    id: "00000000-0000-4000-8000-000000000060",
                    original_filename: "proof.jpg",
                    content_type: "image/jpeg",
                    size_bytes: 200,
                    uploader_role: "payer",
                    removed_at: null,
                    created_at: "2026-07-30T00:00:00.000Z",
                    storage_path: "private/path.jpg",
                },
            ],
            error: null,
        });

        const detail = await serviceWith(client).getPublishedReceipt(
            PERSON_ID,
            RECEIPT_ID,
        );

        expect(detail).toMatchObject({
            id: RECEIPT_ID,
            transactions: [expect.objectContaining({ description: "Payment" })],
            proofs: [
                expect.objectContaining({ originalFilename: "proof.jpg" }),
            ],
        });
        expect(JSON.stringify(detail)).not.toContain("storage_path");
        expect(JSON.stringify(detail)).not.toContain("unrelated");
        expect(
            client.queries.get("acknowledgement_receipt_overview")?.[0]
                .operations,
        ).toEqual(
            expect.arrayContaining([
                { kind: "eq", args: ["id", RECEIPT_ID] },
                { kind: "eq", args: ["payer_person_id", PERSON_ID] },
                { kind: "not", args: ["published_at", "is", null] },
            ]),
        );
        for (const table of [
            "acknowledgement_receipt_transactions",
            "acknowledgement_receipt_files",
        ]) {
            expect(client.queries.get(table)?.[0].operations).toEqual(
                expect.arrayContaining([
                    {
                        kind: "eq",
                        args: [
                            "acknowledgement_receipts.payer_person_id",
                            PERSON_ID,
                        ],
                    },
                    {
                        kind: "not",
                        args: [
                            "acknowledgement_receipts.published_at",
                            "is",
                            null,
                        ],
                    },
                ]),
            );
        }
    });

    it("checks ownership, publication, and void state before confirming as payer", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipts", {
            data: {
                id: RECEIPT_ID,
                revision_number: 3,
                payer_person_id: PERSON_ID,
                published_at: "2026-07-30T01:00:00.000Z",
                voided_at: null,
            },
            error: null,
        });
        client.queueRpc("ack_confirm_receipt", {
            data: { id: RECEIPT_ID },
            error: null,
        });
        client.queueTable("acknowledgement_receipt_overview", {
            data: receiptRow,
            error: null,
        });
        client.queueTable("acknowledgement_receipt_transactions", {
            data: [],
            error: null,
        });
        client.queueTable("acknowledgement_receipt_files", {
            data: [],
            error: null,
        });

        await serviceWith(client).confirmPublishedReceipt(
            PERSON_ID,
            RECEIPT_ID,
            3,
        );

        expect(
            client.queries.get("acknowledgement_receipts")?.[0].operations,
        ).toEqual(
            expect.arrayContaining([
                { kind: "eq", args: ["id", RECEIPT_ID] },
                { kind: "eq", args: ["payer_person_id", PERSON_ID] },
                { kind: "not", args: ["published_at", "is", null] },
                { kind: "is", args: ["voided_at", null] },
            ]),
        );
        expect(client.rpcCalls[0]).toEqual({
            name: "ack_confirm_receipt",
            args: {
                p_receipt_id: RECEIPT_ID,
                p_expected_revision: 3,
                p_role: "payer",
            },
        });
    });

    it.each([
        [{ code: "40001", message: "revision conflict" }, PortalConflictError],
        [{ code: "P0002", message: "not found" }, PortalNotFoundError],
    ])(
        "keeps database conflict and not-found semantics",
        async (error, Type) => {
            const client = new FakeClient();
            client.queueTable("acknowledgement_receipts", {
                data: {
                    id: RECEIPT_ID,
                    revision_number: 3,
                    payer_person_id: PERSON_ID,
                    published_at: "2026-07-30T01:00:00.000Z",
                    voided_at: null,
                },
                error: null,
            });
            client.queueRpc("ack_confirm_receipt", {
                data: null,
                error,
            });

            await expect(
                serviceWith(client).confirmPublishedReceipt(
                    PERSON_ID,
                    RECEIPT_ID,
                    3,
                ),
            ).rejects.toBeInstanceOf(Type);
        },
    );
});
