import { describe, expect, it, vi } from "vitest";

import {
    MAX_PROOF_SIZE_BYTES,
    ReceiptConflictError,
    ReceiptNotFoundError,
    ReceiptValidationError,
    createProofService,
} from "../proofService";

const RECEIPT_ID = "00000000-0000-4000-8000-000000000010";
const PERSON_ID = "00000000-0000-4000-8000-000000000020";
const OTHER_PERSON_ID = "00000000-0000-4000-8000-000000000021";
const FILE_ID = "00000000-0000-4000-8000-000000000060";
const OBJECT_ID = "00000000-0000-4000-8000-000000000070";
const TEMP_PATH = `receipts/${RECEIPT_ID}/tmp/${OBJECT_ID}`;

type QueryResult = {
    data: unknown;
    error: { code?: string; message?: string; status?: number } | null;
};

type QueryOperation = { kind: string; args: unknown[] };

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
        const result = this.tableResults.get(table)?.shift() ?? {
            data: [],
            error: null,
        };
        const query = new FakeQuery(result);
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

class FakeStorage {
    readonly signedUploadCalls: Array<{
        path: string;
        options: { upsert: boolean };
    }> = [];
    readonly infoCalls: string[] = [];
    readonly signedReadCalls: Array<{ path: string; expiresIn: number }> = [];
    readonly removeCalls: string[][] = [];
    signedUploadResult: QueryResult = {
        data: { path: TEMP_PATH, token: "upload-token", signedUrl: "secret" },
        error: null,
    };
    infoResult: QueryResult = {
        data: {
            id: OBJECT_ID,
            name: TEMP_PATH,
            bucketId: "acknowledgement-proofs",
            size: 12,
            contentType: "image/png",
        },
        error: null,
    };
    signedReadResults: QueryResult[] = [
        {
            data: { signedUrl: "https://storage.example/signed/read" },
            error: null,
        },
    ];
    removeResult: QueryResult = { data: [], error: null };

    async createSignedUploadUrl(
        path: string,
        options: { upsert: boolean },
    ) {
        this.signedUploadCalls.push({ path, options });
        return this.signedUploadResult;
    }

    async info(path: string) {
        this.infoCalls.push(path);
        return this.infoResult;
    }

    async createSignedUrl(path: string, expiresIn: number) {
        this.signedReadCalls.push({ path, expiresIn });
        return (
            this.signedReadResults.shift() ?? {
                data: null,
                error: { message: "signing failed" },
            }
        );
    }

    async remove(paths: string[]) {
        this.removeCalls.push(paths);
        return this.removeResult;
    }
}

const receiptRow = (
    overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
    id: RECEIPT_ID,
    payer_person_id: PERSON_ID,
    revision_number: 3,
    published_at: "2026-07-30T00:00:00.000Z",
    completed_at: null,
    voided_at: null,
    proof_count: 0,
    ...overrides,
});

const proofRow = (
    overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
    id: FILE_ID,
    receipt_id: RECEIPT_ID,
    storage_path: TEMP_PATH,
    original_filename: "proof.png",
    content_type: "image/png",
    size_bytes: 12,
    uploader_role: "payer",
    removed_at: null,
    created_at: "2026-07-30T00:01:00.000Z",
    ...overrides,
});

const uploadClaim = (
    overrides: Record<string, unknown> = {},
): {
    expectedRevision: number;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
} => ({
    expectedRevision: 3,
    originalFilename: "../ proof\u0000.png ",
    contentType: "image/png",
    sizeBytes: 12,
    ...overrides,
});

const pngBytes = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);

const serviceWith = (
    client: FakeClient,
    storage = new FakeStorage(),
    bytes = pngBytes,
) => ({
    service: createProofService(client, {
        storage,
        createObjectId: () => OBJECT_ID,
        fetch: vi.fn(async () => new Response(bytes, { status: 206 })),
    }),
    storage,
});

describe("proof upload preflight", () => {
    it("rejects the sixth active proof before issuing a signed upload token", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipt_overview", {
            data: receiptRow({ proof_count: 5 }),
            error: null,
        });
        const { service, storage } = serviceWith(client);

        await expect(
            service.requestProofUpload(
                { role: "receiver" },
                RECEIPT_ID,
                uploadClaim(),
            ),
        ).rejects.toBeInstanceOf(ReceiptValidationError);
        expect(storage.signedUploadCalls).toHaveLength(0);
    });

    it("rejects empty, oversized, and unsupported files before storage access", async () => {
        for (const claim of [
            uploadClaim({ sizeBytes: 0 }),
            uploadClaim({ sizeBytes: MAX_PROOF_SIZE_BYTES + 1 }),
            uploadClaim({ contentType: "image/svg+xml" }),
            uploadClaim({ contentType: "image/gif" }),
            uploadClaim({ contentType: "application/pdf" }),
        ]) {
            const client = new FakeClient();
            const { service, storage } = serviceWith(client);

            await expect(
                service.requestProofUpload(
                    { role: "receiver" },
                    RECEIPT_ID,
                    claim,
                ),
            ).rejects.toBeInstanceOf(ReceiptValidationError);
            expect(storage.signedUploadCalls).toHaveLength(0);
        }
    });

    it("scopes payer authorization by Person and hides an unrelated receipt", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipt_overview", {
            data: receiptRow({ payer_person_id: OTHER_PERSON_ID }),
            error: null,
        });

        await expect(
            serviceWith(client).service.requestProofUpload(
                { role: "payer", personId: PERSON_ID },
                RECEIPT_ID,
                uploadClaim(),
            ),
        ).rejects.toBeInstanceOf(ReceiptNotFoundError);
    });

    it("allows a receiver to reopen a completed receipt but keeps it read-only for the payer", async () => {
        const completed = receiptRow({
            completed_at: "2026-07-30T01:00:00.000Z",
        });
        const receiverClient = new FakeClient();
        receiverClient.queueTable("acknowledgement_receipt_overview", {
            data: completed,
            error: null,
        });

        await expect(
            serviceWith(receiverClient).service.requestProofUpload(
                { role: "receiver" },
                RECEIPT_ID,
                uploadClaim(),
            ),
        ).resolves.toEqual({ path: TEMP_PATH, token: "upload-token" });

        const payerClient = new FakeClient();
        payerClient.queueTable("acknowledgement_receipt_overview", {
            data: completed,
            error: null,
        });
        await expect(
            serviceWith(payerClient).service.requestProofUpload(
                { role: "payer", personId: PERSON_ID },
                RECEIPT_ID,
                uploadClaim(),
            ),
        ).rejects.toBeInstanceOf(ReceiptValidationError);
    });

    it("uses only a server-generated receipt-scoped temp path with upsert disabled", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipt_overview", {
            data: receiptRow(),
            error: null,
        });
        const { service, storage } = serviceWith(client);

        const result = await service.requestProofUpload(
            { role: "receiver" },
            RECEIPT_ID,
            uploadClaim({ originalFilename: "another-receipt.jpg" }),
        );

        expect(result).toEqual({ path: TEMP_PATH, token: "upload-token" });
        expect(storage.signedUploadCalls).toEqual([
            { path: TEMP_PATH, options: { upsert: false } },
        ]);
        expect(TEMP_PATH).not.toContain("another-receipt");
    });
});

describe("proof finalization", () => {
    it.each([
        {
            name: "claimed size",
            claim: uploadClaim({ sizeBytes: 13 }),
            info: { size: 12, contentType: "image/png" },
            bytes: pngBytes,
        },
        {
            name: "stored MIME",
            claim: uploadClaim(),
            info: { size: 12, contentType: "image/jpeg" },
            bytes: pngBytes,
        },
        {
            name: "magic bytes",
            claim: uploadClaim(),
            info: { size: 12, contentType: "image/png" },
            bytes: Uint8Array.from([0x3c, 0x73, 0x76, 0x67]),
        },
    ])(
        "removes the temp object and creates no metadata for a $name mismatch",
        async ({ claim, info, bytes }) => {
            const client = new FakeClient();
            client.queueTable("acknowledgement_receipt_overview", {
                data: receiptRow(),
                error: null,
            });
            const storage = new FakeStorage();
            storage.infoResult = {
                data: {
                    id: OBJECT_ID,
                    name: TEMP_PATH,
                    bucketId: "acknowledgement-proofs",
                    ...info,
                },
                error: null,
            };
            const { service } = serviceWith(client, storage, bytes);

            await expect(
                service.finalizeProofUpload(
                    { role: "receiver" },
                    RECEIPT_ID,
                    { ...claim, path: TEMP_PATH },
                ),
            ).rejects.toBeInstanceOf(ReceiptValidationError);
            expect(client.rpcCalls).toHaveLength(0);
            expect(storage.removeCalls).toEqual([[TEMP_PATH]]);
        },
    );

    it("registers only verified authoritative metadata and returns a safe proof plus the new revision", async () => {
        const client = new FakeClient();
        client.queueTable(
            "acknowledgement_receipt_overview",
            { data: receiptRow(), error: null },
            {
                data: receiptRow({ revision_number: 4, proof_count: 1 }),
                error: null,
            },
        );
        client.queueRpc("ack_register_file", {
            data: receiptRow({ revision_number: 4, proof_count: 1 }),
            error: null,
        });
        client.queueTable("acknowledgement_receipt_files", {
            data: proofRow({
                original_filename: "proof.png",
                uploader_role: "receiver",
            }),
            error: null,
        });
        const { service, storage } = serviceWith(client);

        const result = await service.finalizeProofUpload(
            { role: "receiver" },
            RECEIPT_ID,
            { ...uploadClaim(), path: TEMP_PATH },
        );

        expect(client.rpcCalls).toEqual([
            {
                name: "ack_register_file",
                args: {
                    p_receipt_id: RECEIPT_ID,
                    p_expected_revision: 3,
                    p_storage_path: TEMP_PATH,
                    p_original_filename: "proof.png",
                    p_content_type: "image/png",
                    p_size_bytes: 12,
                    p_uploader_role: "receiver",
                },
            },
        ]);
        expect(result).toEqual({
            proof: {
                id: FILE_ID,
                originalFilename: "proof.png",
                contentType: "image/png",
                sizeBytes: 12,
                uploaderRole: "receiver",
                removedAt: null,
                createdAt: "2026-07-30T00:01:00.000Z",
            },
            revisionNumber: 4,
        });
        expect(JSON.stringify(result)).not.toContain("storage_path");
        expect(JSON.stringify(result)).not.toContain("upload-token");
        expect(storage.removeCalls).toHaveLength(0);
    });

    it("cleans up the temp object and maps stale registration to a conflict", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipt_overview", {
            data: receiptRow(),
            error: null,
        });
        client.queueRpc("ack_register_file", {
            data: null,
            error: { code: "40001", message: "revision conflict" },
        });
        const { service, storage } = serviceWith(client);

        await expect(
            service.finalizeProofUpload(
                { role: "receiver" },
                RECEIPT_ID,
                { ...uploadClaim(), path: TEMP_PATH },
            ),
        ).rejects.toBeInstanceOf(ReceiptConflictError);
        expect(storage.removeCalls).toEqual([[TEMP_PATH]]);
    });

    it("cleans up an exact issued temp path when finalization is already stale", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipt_overview", {
            data: receiptRow({ revision_number: 4 }),
            error: null,
        });
        const { service, storage } = serviceWith(client);

        await expect(
            service.finalizeProofUpload(
                { role: "receiver" },
                RECEIPT_ID,
                { ...uploadClaim(), path: TEMP_PATH },
            ),
        ).rejects.toBeInstanceOf(ReceiptConflictError);
        expect(storage.infoCalls).toHaveLength(0);
        expect(storage.removeCalls).toEqual([[TEMP_PATH]]);
    });
});

describe("proof removal and signed reads", () => {
    it("lets a payer remove only their own active proof on an unfinished published receipt", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipt_overview", {
            data: receiptRow(),
            error: null,
        });
        client.queueTable("acknowledgement_receipt_files", {
            data: proofRow({ uploader_role: "receiver" }),
            error: null,
        });

        await expect(
            serviceWith(client).service.removeProof(
                { role: "payer", personId: PERSON_ID },
                RECEIPT_ID,
                FILE_ID,
                3,
            ),
        ).rejects.toBeInstanceOf(ReceiptValidationError);
        expect(client.rpcCalls).toHaveLength(0);
    });

    it("lets the receiver remove from a completed receipt without deleting retained audit bytes", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipt_overview", {
            data: receiptRow({
                completed_at: "2026-07-30T01:00:00.000Z",
            }),
            error: null,
        });
        client.queueTable("acknowledgement_receipt_files", {
            data: proofRow(),
            error: null,
        });
        client.queueRpc("ack_remove_file", {
            data: receiptRow({
                revision_number: 4,
                completed_at: null,
                proof_count: 0,
            }),
            error: null,
        });
        const { service, storage } = serviceWith(client);

        await expect(
            service.removeProof(
                { role: "receiver" },
                RECEIPT_ID,
                FILE_ID,
                3,
            ),
        ).resolves.toEqual({ revisionNumber: 4 });
        expect(storage.removeCalls).toHaveLength(0);
    });

    it("allows removal while the receipt is already at the five-proof cap", async () => {
        const client = new FakeClient();
        client.queueTable("acknowledgement_receipt_overview", {
            data: receiptRow({ proof_count: 5 }),
            error: null,
        });
        client.queueTable("acknowledgement_receipt_files", {
            data: proofRow(),
            error: null,
        });
        client.queueRpc("ack_remove_file", {
            data: receiptRow({ revision_number: 4, proof_count: 4 }),
            error: null,
        });

        await expect(
            serviceWith(client).service.removeProof(
                { role: "receiver" },
                RECEIPT_ID,
                FILE_ID,
                3,
            ),
        ).resolves.toEqual({ revisionNumber: 4 });
    });

    it("signs only active authorized proof rows and omits a URL on a controlled signing failure", async () => {
        const client = new FakeClient();
        const storage = new FakeStorage();
        storage.signedReadResults = [
            {
                data: { signedUrl: "https://storage.example/active" },
                error: null,
            },
            { data: null, error: { message: "signing unavailable" } },
        ];
        const { service } = serviceWith(client, storage);

        const result = await service.hydrateProofRows([
            proofRow(),
            proofRow({
                id: "00000000-0000-4000-8000-000000000061",
                storage_path: `receipts/${RECEIPT_ID}/tmp/00000000-0000-4000-8000-000000000071`,
            }),
            proofRow({
                id: "00000000-0000-4000-8000-000000000062",
                storage_path: `receipts/${RECEIPT_ID}/tmp/00000000-0000-4000-8000-000000000072`,
                removed_at: "2026-07-30T00:02:00.000Z",
            }),
        ]);

        expect(result[0]).toEqual(
            expect.objectContaining({
                id: FILE_ID,
                downloadUrl: "https://storage.example/active",
            }),
        );
        expect(result[1]).not.toHaveProperty("downloadUrl");
        expect(result[2]).not.toHaveProperty("downloadUrl");
        expect(storage.signedReadCalls).toHaveLength(2);
        expect(JSON.stringify(result)).not.toContain("storage_path");
    });
});
