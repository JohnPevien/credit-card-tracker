import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";

import type {
    PayerPortalReceipt,
    PayerPortalReceiptDetail,
    PayerPortalReceiptSummary,
    ReceiptProof,
    ReceiptTransactionReference,
} from "@/lib/acknowledgements/types";
import { verifyPin } from "@/lib/auth/pin";

type PortalDatabaseError = {
    code?: string;
    message?: string;
    status?: number;
};

type PortalDatabaseResult = {
    data: unknown;
    error: PortalDatabaseError | null;
};

interface PortalQuery extends PromiseLike<PortalDatabaseResult> {
    select(...args: unknown[]): PortalQuery;
    eq(...args: unknown[]): PortalQuery;
    not(...args: unknown[]): PortalQuery;
    is(...args: unknown[]): PortalQuery;
    order(...args: unknown[]): PortalQuery;
    maybeSingle(...args: unknown[]): PortalQuery;
}

export interface PortalDataClient {
    from(table: string): PortalQuery;
    rpc(
        name: string,
        args: Record<string, unknown>,
    ): PromiseLike<PortalDatabaseResult>;
}

type PortalServiceDependencies = {
    verifyPin?: (pin: string, encoded: string) => Promise<boolean>;
    sessionSecret?: string;
    createReservationId?: () => string;
    hydrateProofRows?: (rows: unknown[]) => Promise<ReceiptProof[]>;
};

export type PortalSessionIdentity = {
    personId: string;
    publicId: string;
    credentialVersion: number;
};

export type UnlockPortalResult =
    | { kind: "invalid" }
    | { kind: "rate_limited"; retryAfterSeconds: number }
    | { kind: "authorized"; session: PortalSessionIdentity };

export class PortalServiceError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = new.target.name;
    }
}

export class PortalNotFoundError extends PortalServiceError {}
export class PortalConflictError extends PortalServiceError {}
export class PortalUnexpectedError extends PortalServiceError {}

const PUBLIC_RECEIPT_COLUMNS = [
    "id",
    "receipt_number",
    "payer_name_snapshot",
    "receiver_name",
    "amount",
    "currency",
    "payment_date",
    "notes",
    "revision_number",
    "published_at",
    "payer_confirmed_at",
    "receiver_confirmed_at",
    "completed_at",
    "is_completed",
    "voided_at",
    "void_reason",
    "status",
    "created_at",
    "updated_at",
    "transaction_count",
    "proof_count",
].join(",");

const PUBLIC_TRANSACTION_COLUMNS = [
    "id",
    "transaction_id",
    "transaction_date_snapshot",
    "description_snapshot",
    "amount_snapshot",
    "created_at",
    "acknowledgement_receipts!inner(payer_person_id,published_at)",
].join(",");

const PUBLIC_PROOF_COLUMNS = [
    "id",
    "receipt_id",
    "storage_path",
    "original_filename",
    "content_type",
    "size_bytes",
    "uploader_role",
    "removed_at",
    "created_at",
    "acknowledgement_receipts!inner(payer_person_id,published_at)",
].join(",");

const DUMMY_PIN_HASH = [
    "scrypt",
    Buffer.alloc(16).toString("base64url"),
    Buffer.alloc(32).toString("base64url"),
].join("$");

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const asRecords = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? value.map(asRecord) : [];

const stringValue = (row: Record<string, unknown>, key: string) =>
    typeof row[key] === "string" ? row[key] : "";

const nullableStringValue = (row: Record<string, unknown>, key: string) =>
    typeof row[key] === "string" ? row[key] : null;

const serializeReceipt = (value: unknown): PayerPortalReceipt => {
    const row = asRecord(value);
    return {
        id: stringValue(row, "id"),
        receiptNumber: stringValue(row, "receipt_number"),
        payerName: stringValue(row, "payer_name_snapshot"),
        receiverName: stringValue(row, "receiver_name"),
        amount: Number(row.amount),
        currency: stringValue(row, "currency"),
        paymentDate: stringValue(row, "payment_date"),
        notes: nullableStringValue(row, "notes"),
        revisionNumber: Number(row.revision_number),
        publishedAt: stringValue(row, "published_at"),
        payerConfirmedAt: nullableStringValue(row, "payer_confirmed_at"),
        receiverConfirmedAt: nullableStringValue(row, "receiver_confirmed_at"),
        completedAt: nullableStringValue(row, "completed_at"),
        isCompleted: row.is_completed === true,
        voidedAt: nullableStringValue(row, "voided_at"),
        voidReason: nullableStringValue(row, "void_reason"),
        status: stringValue(row, "status") as PayerPortalReceipt["status"],
        createdAt: stringValue(row, "created_at"),
        updatedAt: stringValue(row, "updated_at"),
    };
};

const serializeSummary = (value: unknown): PayerPortalReceiptSummary => {
    const row = asRecord(value);
    return {
        ...serializeReceipt(row),
        transactionCount: Number(row.transaction_count),
        proofCount: Number(row.proof_count),
    };
};

const serializeTransaction = (value: unknown): ReceiptTransactionReference => {
    const row = asRecord(value);
    return {
        id: stringValue(row, "id"),
        transactionId: nullableStringValue(row, "transaction_id"),
        transactionDate: stringValue(row, "transaction_date_snapshot"),
        description: stringValue(row, "description_snapshot"),
        amount: Number(row.amount_snapshot),
        createdAt: stringValue(row, "created_at"),
    };
};

const serializeProof = (value: unknown): ReceiptProof => {
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
};

const throwDatabaseError = (
    error: PortalDatabaseError,
    fallback: string,
): never => {
    if (error.code === "40001" || error.status === 409) {
        throw new PortalConflictError("Receipt revision conflict", {
            cause: error,
        });
    }
    if (
        error.code === "P0002" ||
        error.code === "PGRST116" ||
        error.code === "55000"
    ) {
        throw new PortalNotFoundError("Receipt is unavailable", {
            cause: error,
        });
    }
    throw new PortalUnexpectedError(fallback, { cause: error });
};

const normalizeNetworkAddress = (address: string | null): string => {
    if (!address) {
        return "untrusted-or-missing";
    }
    const candidate = address.trim().toLowerCase();
    const normalized = candidate.startsWith("::ffff:")
        ? candidate.slice("::ffff:".length)
        : candidate;
    return isIP(normalized) ? normalized : "untrusted-or-missing";
};

export function derivePortalNetworkHash(
    address: string | null,
    secret: string,
): string {
    return createHmac("sha256", secret)
        .update(`payer-portal-throttle:v1:${normalizeNetworkAddress(address)}`)
        .digest("hex");
}

export function derivePortalScopeHash(
    publicId: string,
    secret: string,
): string {
    return createHmac("sha256", secret)
        .update(`payer-portal-scope:v1:${publicId.toLowerCase()}`)
        .digest("hex");
}

const boundedRetryAfter = (value: unknown) => {
    const seconds = Number(value);
    if (!Number.isFinite(seconds)) {
        return 1;
    }
    return Math.max(1, Math.min(900, Math.ceil(seconds)));
};

export function createPortalService(
    client: PortalDataClient,
    dependencies: PortalServiceDependencies = {},
) {
    const verifyCredentialPin = dependencies.verifyPin ?? verifyPin;
    const sessionSecret =
        dependencies.sessionSecret ??
        process.env.ACKNOWLEDGEMENT_SESSION_SECRET;
    const createReservationId = dependencies.createReservationId ?? randomUUID;
    const hydrateProofRows = dependencies.hydrateProofRows;

    const unlockPortal = async (
        publicId: string,
        pin: string,
        requestAddress: string | null,
    ): Promise<UnlockPortalResult> => {
        if (!sessionSecret) {
            throw new PortalUnexpectedError(
                "Payer portal session configuration is incomplete",
            );
        }

        const reservationId = createReservationId();
        const portalScopeHash = derivePortalScopeHash(publicId, sessionSecret);
        const networkHash = derivePortalNetworkHash(
            requestAddress,
            sessionSecret,
        );
        const { data, error } = await client.rpc(
            "ack_reserve_payer_portal_attempt",
            {
                p_public_id: publicId,
                p_portal_scope_hash: portalScopeHash,
                p_network_hash: networkHash,
                p_reservation_id: reservationId,
            },
        );
        if (error) {
            throwDatabaseError(error, "Unable to verify payer portal");
        }

        const reservation = asRecord(data);
        if (reservation.allowed !== true) {
            return {
                kind: "rate_limited",
                retryAfterSeconds: boundedRetryAfter(
                    reservation.retry_after_seconds,
                ),
            };
        }

        const portal = asRecord(reservation.portal);
        const pinHash =
            typeof portal.pin_hash === "string"
                ? portal.pin_hash
                : DUMMY_PIN_HASH;
        const pinMatches = await verifyCredentialPin(pin, pinHash);
        const credentialVersion = Number(portal.credential_version);
        if (
            !pinMatches ||
            portal.revoked_at != null ||
            typeof portal.person_id !== "string" ||
            portal.public_id !== publicId ||
            !Number.isInteger(credentialVersion) ||
            credentialVersion < 1
        ) {
            const finalizeResult = await client.rpc(
                "ack_finalize_payer_portal_attempt",
                {
                    p_reservation_id: reservationId,
                    p_portal_scope_hash: portalScopeHash,
                    p_network_hash: networkHash,
                },
            );
            if (finalizeResult.error) {
                throwDatabaseError(
                    finalizeResult.error,
                    "Unable to finalize payer portal verification",
                );
            }
            return { kind: "invalid" };
        }

        const completeResult = await client.rpc(
            "ack_complete_payer_portal_unlock",
            {
                p_reservation_id: reservationId,
                p_public_id: publicId,
                p_credential_version: credentialVersion,
                p_portal_scope_hash: portalScopeHash,
                p_network_hash: networkHash,
            },
        );
        if (completeResult.error) {
            throwDatabaseError(
                completeResult.error,
                "Unable to complete payer portal verification",
            );
        }

        const completedPortal = asRecord(completeResult.data);
        if (
            completedPortal.person_id !== portal.person_id ||
            completedPortal.public_id !== publicId ||
            completedPortal.credential_version !== credentialVersion
        ) {
            return { kind: "invalid" };
        }

        return {
            kind: "authorized",
            session: {
                personId: portal.person_id,
                publicId,
                credentialVersion,
            },
        };
    };

    const listPublishedReceipts = async (
        authorizedPersonId: string,
    ): Promise<PayerPortalReceiptSummary[]> => {
        const { data, error } = await client
            .from("acknowledgement_receipt_overview")
            .select(PUBLIC_RECEIPT_COLUMNS)
            .eq("payer_person_id", authorizedPersonId)
            .not("published_at", "is", null)
            .order("payment_date", { ascending: false });
        if (error) {
            throwDatabaseError(error, "Unable to list payer receipts");
        }
        return asRecords(data).map(serializeSummary);
    };

    const getPublishedReceipt = async (
        authorizedPersonId: string,
        receiptId: string,
    ): Promise<PayerPortalReceiptDetail> => {
        const receiptResult = await client
            .from("acknowledgement_receipt_overview")
            .select(PUBLIC_RECEIPT_COLUMNS)
            .eq("id", receiptId)
            .eq("payer_person_id", authorizedPersonId)
            .not("published_at", "is", null)
            .maybeSingle();
        if (receiptResult.error) {
            throwDatabaseError(
                receiptResult.error,
                "Unable to load payer receipt",
            );
        }
        if (!receiptResult.data) {
            throw new PortalNotFoundError("Receipt is unavailable");
        }

        const [transactionsResult, proofsResult] = await Promise.all([
            client
                .from("acknowledgement_receipt_transactions")
                .select(PUBLIC_TRANSACTION_COLUMNS)
                .eq("receipt_id", receiptId)
                .eq(
                    "acknowledgement_receipts.payer_person_id",
                    authorizedPersonId,
                )
                .not("acknowledgement_receipts.published_at", "is", null)
                .order("created_at", { ascending: true }),
            client
                .from("acknowledgement_receipt_files")
                .select(PUBLIC_PROOF_COLUMNS)
                .eq("receipt_id", receiptId)
                .eq(
                    "acknowledgement_receipts.payer_person_id",
                    authorizedPersonId,
                )
                .not("acknowledgement_receipts.published_at", "is", null)
                .is("removed_at", null)
                .order("created_at", { ascending: true }),
        ]);
        if (transactionsResult.error) {
            throwDatabaseError(
                transactionsResult.error,
                "Unable to load payer receipt transactions",
            );
        }
        if (proofsResult.error) {
            throwDatabaseError(
                proofsResult.error,
                "Unable to load payer receipt proofs",
            );
        }

        const proofRows = asRecords(proofsResult.data);
        return {
            ...serializeReceipt(receiptResult.data),
            transactions: asRecords(transactionsResult.data).map(
                serializeTransaction,
            ),
            proofs: hydrateProofRows
                ? await hydrateProofRows(proofRows)
                : proofRows.map(serializeProof),
        };
    };

    const confirmPublishedReceipt = async (
        authorizedPersonId: string,
        receiptId: string,
        expectedRevision: number,
    ): Promise<PayerPortalReceiptDetail> => {
        const { error } = await client.rpc("ack_confirm_payer_receipt", {
            p_receipt_id: receiptId,
            p_expected_revision: expectedRevision,
            p_authorized_person_id: authorizedPersonId,
        });
        if (error) {
            throwDatabaseError(error, "Unable to confirm payer receipt");
        }

        return getPublishedReceipt(authorizedPersonId, receiptId);
    };

    return {
        unlockPortal,
        listPublishedReceipts,
        getPublishedReceipt,
        confirmPublishedReceipt,
    };
}

const getDefaultService = async () => {
    const [{ getServerSupabase }, { hydrateProofRows }] = await Promise.all([
        import("@/lib/supabase/server"),
        import("./proofService"),
    ]);
    return createPortalService(getServerSupabase() as unknown as PortalDataClient, {
        hydrateProofRows,
    });
};

export async function unlockPortal(
    publicId: string,
    pin: string,
    requestAddress: string | null,
): Promise<UnlockPortalResult> {
    return (await getDefaultService()).unlockPortal(
        publicId,
        pin,
        requestAddress,
    );
}

export async function listPublishedReceipts(
    authorizedPersonId: string,
): Promise<PayerPortalReceiptSummary[]> {
    return (await getDefaultService()).listPublishedReceipts(
        authorizedPersonId,
    );
}

export async function getPublishedReceipt(
    authorizedPersonId: string,
    receiptId: string,
): Promise<PayerPortalReceiptDetail> {
    return (await getDefaultService()).getPublishedReceipt(
        authorizedPersonId,
        receiptId,
    );
}

export async function confirmPublishedReceipt(
    authorizedPersonId: string,
    receiptId: string,
    expectedRevision: number,
): Promise<PayerPortalReceiptDetail> {
    return (await getDefaultService()).confirmPublishedReceipt(
        authorizedPersonId,
        receiptId,
        expectedRevision,
    );
}
