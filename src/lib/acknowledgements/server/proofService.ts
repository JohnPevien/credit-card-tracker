import { randomUUID } from "node:crypto";

import type {
    ReceiptProof,
    ReceiptUploaderRole,
} from "@/lib/acknowledgements/types";
import {
    ReceiptConflictError,
    ReceiptNotFoundError,
    ReceiptUnexpectedError,
    ReceiptValidationError,
} from "./http";

export {
    ReceiptConflictError,
    ReceiptNotFoundError,
    ReceiptValidationError,
} from "./http";

export const PROOF_BUCKET = "acknowledgement-proofs";
export const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;
const SIGNED_READ_SECONDS = 5 * 60;
const INTERNAL_SIGNATURE_READ_SECONDS = 30;
const SIGNATURE_PREFIX_BYTES = 16;
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORTED_CONTENT_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
]);

type ProofDatabaseError = {
    code?: string;
    message?: string;
    status?: number;
};

type ProofDatabaseResult = {
    data: unknown;
    error: ProofDatabaseError | null;
};

interface ProofQuery extends PromiseLike<ProofDatabaseResult> {
    select(...args: unknown[]): ProofQuery;
    eq(...args: unknown[]): ProofQuery;
    not(...args: unknown[]): ProofQuery;
    is(...args: unknown[]): ProofQuery;
    order(...args: unknown[]): ProofQuery;
    maybeSingle(...args: unknown[]): ProofQuery;
}

export interface ProofDataClient {
    from(table: string): ProofQuery;
    rpc(
        name: string,
        args: Record<string, unknown>,
    ): PromiseLike<ProofDatabaseResult>;
}

type StorageResult = {
    data: unknown;
    error: unknown;
};

export interface ProofStorageBucket {
    createSignedUploadUrl(
        path: string,
        options: { upsert: boolean },
    ): PromiseLike<StorageResult>;
    info(path: string): PromiseLike<StorageResult>;
    createSignedUrl(
        path: string,
        expiresIn: number,
    ): PromiseLike<StorageResult>;
    remove(paths: string[]): PromiseLike<StorageResult>;
}

type ProofServiceDependencies = {
    storage: ProofStorageBucket;
    createObjectId?: () => string;
    fetch?: (
        input: string,
        init?: RequestInit,
    ) => Promise<Response>;
};

export type ProofActor =
    | { role: "receiver" }
    | { role: "payer"; personId: string };

export type ProofUploadClaim = {
    expectedRevision: number;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
};

export type FinalizeProofInput = ProofUploadClaim & {
    path: string;
};

export type ProofMutationResult = {
    proof: ReceiptProof;
    revisionNumber: number;
};

export type ProofRemovalResult = {
    revisionNumber: number;
};

const RECEIPT_AUTHORIZATION_COLUMNS = [
    "id",
    "payer_person_id",
    "revision_number",
    "published_at",
    "completed_at",
    "voided_at",
    "proof_count",
].join(",");

export const PROOF_SIGNING_COLUMNS = [
    "id",
    "receipt_id",
    "storage_path",
    "original_filename",
    "content_type",
    "size_bytes",
    "uploader_role",
    "removed_at",
    "created_at",
].join(",");

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const stringValue = (row: Record<string, unknown>, key: string) =>
    typeof row[key] === "string" ? row[key] : "";

const nullableStringValue = (row: Record<string, unknown>, key: string) =>
    typeof row[key] === "string" ? row[key] : null;

export function serializeProofRow(value: unknown): ReceiptProof {
    const row = asRecord(value);
    return {
        id: stringValue(row, "id"),
        originalFilename: stringValue(row, "original_filename"),
        contentType: stringValue(
            row,
            "content_type",
        ) as ReceiptProof["contentType"],
        sizeBytes: Number(row.size_bytes),
        uploaderRole: stringValue(
            row,
            "uploader_role",
        ) as ReceiptProof["uploaderRole"],
        removedAt: nullableStringValue(row, "removed_at"),
        createdAt: stringValue(row, "created_at"),
    };
}

export function sanitizeProofFilename(value: string): string {
    const basename =
        value.normalize("NFKC").replaceAll("\\", "/").split("/").at(-1) ?? "";
    const sanitized = basename
        .replaceAll(/[\u0000-\u001f\u007f]/g, "")
        .replaceAll(/\s+/g, " ")
        .trim();
    if (!sanitized) {
        throw new ReceiptValidationError("Proof filename is required");
    }

    const limited = Array.from(sanitized).slice(0, 255).join("").trim();
    if (!limited) {
        throw new ReceiptValidationError("Proof filename is required");
    }
    return limited;
}

const validateClaim = (claim: ProofUploadClaim) => {
    if (
        !Number.isInteger(claim.expectedRevision) ||
        claim.expectedRevision < 1
    ) {
        throw new ReceiptValidationError("Invalid receipt revision");
    }
    if (
        !Number.isInteger(claim.sizeBytes) ||
        claim.sizeBytes < 1 ||
        claim.sizeBytes > MAX_PROOF_SIZE_BYTES
    ) {
        throw new ReceiptValidationError(
            "Proof images must be between 1 byte and 10 MiB",
        );
    }
    if (!SUPPORTED_CONTENT_TYPES.has(claim.contentType)) {
        throw new ReceiptValidationError(
            "Proof images must be JPEG, PNG, or WebP",
        );
    }
    return {
        ...claim,
        originalFilename: sanitizeProofFilename(claim.originalFilename),
    };
};

const exactTempPath = (receiptId: string, objectId: string) =>
    `receipts/${receiptId}/tmp/${objectId}`;

const isExactReceiptTempPath = (receiptId: string, path: string) => {
    const prefix = `receipts/${receiptId}/tmp/`;
    return path.startsWith(prefix) && UUID_PATTERN.test(path.slice(prefix.length));
};

const throwDatabaseError = (
    error: ProofDatabaseError,
    fallback: string,
): never => {
    if (
        error.code === "40001" ||
        error.code === "23514" ||
        error.status === 409
    ) {
        throw new ReceiptConflictError("Receipt revision conflict", {
            cause: error,
        });
    }
    if (error.code === "P0002" || error.code === "PGRST116") {
        throw new ReceiptNotFoundError("Receipt proof was not found", {
            cause: error,
        });
    }
    if (
        error.code === "22023" ||
        error.code === "55000" ||
        error.code === "42501"
    ) {
        throw new ReceiptValidationError("Invalid proof request", {
            cause: error,
        });
    }
    throw new ReceiptUnexpectedError(fallback, { cause: error });
};

const revisionFromRpc = (data: unknown): number => {
    const row = asRecord(Array.isArray(data) ? data[0] : data);
    const revisionNumber = Number(row.revision_number);
    if (!Number.isInteger(revisionNumber) || revisionNumber < 1) {
        throw new ReceiptUnexpectedError(
            "Proof mutation returned an invalid receipt revision",
        );
    }
    return revisionNumber;
};

const contentTypeFromMagic = (
    bytes: Uint8Array,
): ReceiptProof["contentType"] | null => {
    if (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
    ) {
        return "image/jpeg";
    }
    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
    ) {
        return "image/png";
    }
    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        return "image/webp";
    }
    return null;
};

const readBoundedPrefix = async (response: Response): Promise<Uint8Array> => {
    if (!response.ok || (response.status !== 200 && response.status !== 206)) {
        throw new ReceiptValidationError("Uploaded proof could not be verified");
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (
        response.status === 200 &&
        Number.isFinite(contentLength) &&
        contentLength > MAX_PROOF_SIZE_BYTES
    ) {
        throw new ReceiptValidationError("Uploaded proof exceeds 10 MiB");
    }
    if (!response.body) {
        throw new ReceiptValidationError("Uploaded proof could not be verified");
    }

    const reader = response.body.getReader();
    const prefix = new Uint8Array(SIGNATURE_PREFIX_BYTES);
    let prefixLength = 0;
    let receivedBytes = 0;
    try {
        while (prefixLength < SIGNATURE_PREFIX_BYTES) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            receivedBytes += value.byteLength;
            if (receivedBytes > MAX_PROOF_SIZE_BYTES) {
                throw new ReceiptValidationError(
                    "Uploaded proof exceeds 10 MiB",
                );
            }
            const take = Math.min(
                value.byteLength,
                SIGNATURE_PREFIX_BYTES - prefixLength,
            );
            prefix.set(value.subarray(0, take), prefixLength);
            prefixLength += take;
        }
    } finally {
        await reader.cancel().catch(() => undefined);
    }
    return prefix.subarray(0, prefixLength);
};

export function createProofService(
    client: ProofDataClient,
    dependencies: ProofServiceDependencies,
) {
    const storage = dependencies.storage;
    const createObjectId = dependencies.createObjectId ?? randomUUID;
    const fetchObject = dependencies.fetch ?? fetch;

    const authorizeReceipt = async (
        actor: ProofActor,
        receiptId: string,
        expectedRevision: number,
        enforceCapacity: boolean,
    ) => {
        let query = client
            .from("acknowledgement_receipt_overview")
            .select(RECEIPT_AUTHORIZATION_COLUMNS)
            .eq("id", receiptId);
        if (actor.role === "payer") {
            query = query.eq("payer_person_id", actor.personId);
        }
        const { data, error } = await query.maybeSingle();
        if (error) {
            throwDatabaseError(error, "Unable to authorize proof request");
        }
        if (!data) {
            throw new ReceiptNotFoundError("Receipt was not found");
        }

        const receipt = asRecord(data);
        if (
            actor.role === "payer" &&
            receipt.payer_person_id !== actor.personId
        ) {
            throw new ReceiptNotFoundError("Receipt was not found");
        }
        if (Number(receipt.revision_number) !== expectedRevision) {
            throw new ReceiptConflictError("Receipt revision conflict");
        }
        if (receipt.voided_at != null) {
            throw new ReceiptValidationError(
                "Voided receipts cannot change proofs",
            );
        }
        if (actor.role === "payer" && receipt.published_at == null) {
            throw new ReceiptNotFoundError("Receipt was not found");
        }
        if (actor.role === "payer" && receipt.completed_at != null) {
            throw new ReceiptValidationError(
                "Completed receipts are read-only",
            );
        }
        if (enforceCapacity && Number(receipt.proof_count) >= 5) {
            throw new ReceiptValidationError(
                "A receipt may have at most five active proof images",
            );
        }
        return receipt;
    };

    const requestProofUpload = async (
        actor: ProofActor,
        receiptId: string,
        claim: ProofUploadClaim,
    ): Promise<{ path: string; token: string }> => {
        const validated = validateClaim(claim);
        await authorizeReceipt(
            actor,
            receiptId,
            validated.expectedRevision,
            true,
        );

        const objectId = createObjectId();
        if (!UUID_PATTERN.test(objectId)) {
            throw new ReceiptUnexpectedError(
                "Unable to create proof upload path",
            );
        }
        const path = exactTempPath(receiptId, objectId);
        const { data, error } = await storage.createSignedUploadUrl(path, {
            upsert: false,
        });
        const signedUpload = asRecord(data);
        if (
            error ||
            signedUpload.path !== path ||
            typeof signedUpload.token !== "string" ||
            !signedUpload.token
        ) {
            throw new ReceiptUnexpectedError(
                "Unable to create proof upload target",
            );
        }
        return { path, token: signedUpload.token };
    };

    const cleanupTempObject = async (path: string) => {
        try {
            await storage.remove([path]);
        } catch {
            // The exact path remains under the explicit receipt tmp prefix for
            // scheduled cleanup. Never log the private object path.
        }
    };

    const finalizeProofUpload = async (
        actor: ProofActor,
        receiptId: string,
        input: FinalizeProofInput,
    ): Promise<ProofMutationResult> => {
        const validated = validateClaim(input);
        let cleanupOnFailure = false;
        try {
            if (!isExactReceiptTempPath(receiptId, input.path)) {
                throw new ReceiptValidationError("Invalid proof upload path");
            }
            try {
                await authorizeReceipt(
                    actor,
                    receiptId,
                    validated.expectedRevision,
                    true,
                );
            } catch (error) {
                if (
                    error instanceof ReceiptConflictError ||
                    error instanceof ReceiptValidationError
                ) {
                    await cleanupTempObject(input.path);
                }
                throw error;
            }
            cleanupOnFailure = true;

            const infoResult = await storage.info(input.path);
            if (infoResult.error || !infoResult.data) {
                throw new ReceiptValidationError(
                    "Uploaded proof could not be verified",
                );
            }
            const info = asRecord(infoResult.data);
            const storedSize = Number(info.size);
            const storedContentType = stringValue(info, "contentType");
            if (
                !Number.isInteger(storedSize) ||
                storedSize < 1 ||
                storedSize > MAX_PROOF_SIZE_BYTES ||
                storedSize !== validated.sizeBytes
            ) {
                throw new ReceiptValidationError(
                    "Uploaded proof size does not match",
                );
            }
            if (
                !SUPPORTED_CONTENT_TYPES.has(storedContentType) ||
                storedContentType !== validated.contentType
            ) {
                throw new ReceiptValidationError(
                    "Uploaded proof type does not match",
                );
            }

            const signedReadResult = await storage.createSignedUrl(
                input.path,
                INTERNAL_SIGNATURE_READ_SECONDS,
            );
            const signedRead = asRecord(signedReadResult.data);
            if (
                signedReadResult.error ||
                typeof signedRead.signedUrl !== "string"
            ) {
                throw new ReceiptValidationError(
                    "Uploaded proof could not be verified",
                );
            }
            const prefix = await readBoundedPrefix(
                await fetchObject(signedRead.signedUrl, {
                    cache: "no-store",
                    headers: {
                        Range: `bytes=0-${SIGNATURE_PREFIX_BYTES - 1}`,
                    },
                }),
            );
            const magicContentType = contentTypeFromMagic(prefix);
            if (
                magicContentType == null ||
                magicContentType !== storedContentType ||
                magicContentType !== validated.contentType
            ) {
                throw new ReceiptValidationError(
                    "Uploaded proof contents do not match its image type",
                );
            }

            const registration = await client.rpc("ack_register_file", {
                p_receipt_id: receiptId,
                p_expected_revision: validated.expectedRevision,
                p_storage_path: input.path,
                p_original_filename: validated.originalFilename,
                p_content_type: storedContentType,
                p_size_bytes: storedSize,
                p_uploader_role: actor.role,
            });
            if (registration.error) {
                throwDatabaseError(
                    registration.error,
                    "Unable to register proof",
                );
            }
            cleanupOnFailure = false;
            const revisionNumber = revisionFromRpc(registration.data);

            const proofResult = await client
                .from("acknowledgement_receipt_files")
                .select(PROOF_SIGNING_COLUMNS)
                .eq("receipt_id", receiptId)
                .eq("storage_path", input.path)
                .maybeSingle();
            if (proofResult.error) {
                throwDatabaseError(
                    proofResult.error,
                    "Unable to load registered proof",
                );
            }
            if (!proofResult.data) {
                throw new ReceiptUnexpectedError(
                    "Registered proof metadata was not found",
                );
            }

            return {
                proof: serializeProofRow(proofResult.data),
                revisionNumber,
            };
        } catch (error) {
            if (cleanupOnFailure) {
                await cleanupTempObject(input.path);
            }
            throw error;
        }
    };

    const removeProof = async (
        actor: ProofActor,
        receiptId: string,
        fileId: string,
        expectedRevision: number,
    ): Promise<ProofRemovalResult> => {
        await authorizeReceipt(actor, receiptId, expectedRevision, false);

        let query = client
            .from("acknowledgement_receipt_files")
            .select(PROOF_SIGNING_COLUMNS)
            .eq("id", fileId)
            .eq("receipt_id", receiptId)
            .is("removed_at", null);
        if (actor.role === "payer") {
            query = query.eq("uploader_role", "payer");
        }
        const { data, error } = await query.maybeSingle();
        if (error) {
            throwDatabaseError(error, "Unable to authorize proof removal");
        }
        if (!data) {
            throw new ReceiptNotFoundError("Receipt proof was not found");
        }
        const proof = asRecord(data);
        if (
            actor.role === "payer" &&
            proof.uploader_role !== "payer"
        ) {
            throw new ReceiptValidationError(
                "Payers may only remove their own proofs",
            );
        }

        const removal = await client.rpc("ack_remove_file", {
            p_receipt_id: receiptId,
            p_expected_revision: expectedRevision,
            p_file_id: fileId,
            p_actor_role: actor.role,
        });
        if (removal.error) {
            throwDatabaseError(removal.error, "Unable to remove proof");
        }

        // Soft removal is intentional: bytes stay private for immutable
        // receiver audit snapshots. Removed rows are never hydrated below.
        return { revisionNumber: revisionFromRpc(removal.data) };
    };

    const hydrateProofRows = async (rows: unknown[]): Promise<ReceiptProof[]> =>
        Promise.all(
            rows.map(async (value) => {
                const row = asRecord(value);
                const proof = serializeProofRow(row);
                const receiptId = stringValue(row, "receipt_id");
                const path = stringValue(row, "storage_path");
                if (
                    proof.removedAt !== null ||
                    !isExactReceiptTempPath(receiptId, path)
                ) {
                    return proof;
                }

                try {
                    const { data, error } = await storage.createSignedUrl(
                        path,
                        SIGNED_READ_SECONDS,
                    );
                    const signed = asRecord(data);
                    return !error && typeof signed.signedUrl === "string"
                        ? { ...proof, downloadUrl: signed.signedUrl }
                        : proof;
                } catch {
                    return proof;
                }
            }),
        );

    return {
        requestProofUpload,
        finalizeProofUpload,
        removeProof,
        hydrateProofRows,
    };
}

const getDefaultService = async () => {
    const { getServerSupabase } = await import("@/lib/supabase/server");
    const client = getServerSupabase();
    return createProofService(client as unknown as ProofDataClient, {
        storage: client.storage.from(PROOF_BUCKET) as ProofStorageBucket,
    });
};

export async function requestProofUpload(
    actor: ProofActor,
    receiptId: string,
    claim: ProofUploadClaim,
): Promise<{ path: string; token: string }> {
    return (await getDefaultService()).requestProofUpload(
        actor,
        receiptId,
        claim,
    );
}

export async function finalizeProofUpload(
    actor: ProofActor,
    receiptId: string,
    input: FinalizeProofInput,
): Promise<ProofMutationResult> {
    return (await getDefaultService()).finalizeProofUpload(
        actor,
        receiptId,
        input,
    );
}

export async function removeProof(
    actor: ProofActor,
    receiptId: string,
    fileId: string,
    expectedRevision: number,
): Promise<ProofRemovalResult> {
    return (await getDefaultService()).removeProof(
        actor,
        receiptId,
        fileId,
        expectedRevision,
    );
}

export async function hydrateProofRows(rows: unknown[]): Promise<ReceiptProof[]> {
    return (await getDefaultService()).hydrateProofRows(rows);
}
