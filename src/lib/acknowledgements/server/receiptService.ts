import { randomUUID } from "node:crypto";

import {
    createReceiptSchema,
    updateReceiptSchema,
} from "@/lib/acknowledgements/schemas";
import type {
    AcknowledgementReceipt,
    AcknowledgementReceiptDetail,
    AcknowledgementReceiptSummary,
    CreateReceiptInput,
    ReceiptActorRole,
    ReceiptEvent,
    ReceiptFilters,
    ReceiptFormMeta,
    ReceiptFormPerson,
    ReceiptFormTransaction,
    ReceiptProof,
    ReceiptRevision,
    ReceiptRevisionSnapshot,
    ReceiptStatus,
    ReceiptTransactionReference,
    ReceiverReceiptAction,
    ReceiverReceiptActionResult,
    UpdateReceiptInput,
} from "@/lib/acknowledgements/types";
import { generatePin, hashPin } from "@/lib/auth/pin";
import {
    ReceiptConflictError,
    ReceiptNotFoundError,
    ReceiptUnexpectedError,
    ReceiptValidationError,
} from "./http";
import {
    serializePortalAdminView,
    type ReceiptDataClient,
    type ReceiptDatabaseError,
    type ReceiptQuery,
} from "./portalAdminService";

export type { ReceiptDataClient } from "./portalAdminService";

type ReceiptServiceDependencies = {
    generatePin?: () => string;
    hashPin?: (pin: string) => Promise<string>;
    createPublicId?: () => string;
    hydrateProofRows?: (rows: unknown[]) => Promise<ReceiptProof[]>;
};

const RECEIPT_COLUMNS = [
    "id",
    "receipt_number",
    "payer_person_id",
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

const TRANSACTION_COLUMNS = [
    "id",
    "transaction_id",
    "transaction_date_snapshot",
    "description_snapshot",
    "amount_snapshot",
    "created_at",
].join(",");

const PROOF_COLUMNS = [
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

const REVISION_COLUMNS = [
    "id",
    "revision_number",
    "snapshot",
    "change_reason",
    "changed_by_role",
    "created_at",
].join(",");

const EVENT_COLUMNS = [
    "id",
    "event_type",
    "actor_role",
    "revision_number",
    "details",
    "created_at",
].join(",");

const DATABASE_ONLY_DETAIL_KEYS = new Set([
    "networkHash",
    "network_hash",
    "pinHash",
    "pin_hash",
    "storagePath",
    "storage_path",
]);

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

const numberValue = (row: Record<string, unknown>, key: string) =>
    Number(row[key]);

const booleanValue = (row: Record<string, unknown>, key: string) =>
    row[key] === true;

const sanitizeBrowserValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(sanitizeBrowserValue);
    }
    if (!value || typeof value !== "object") {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([key]) => !DATABASE_ONLY_DETAIL_KEYS.has(key))
            .map(([key, nestedValue]) => [
                key,
                sanitizeBrowserValue(nestedValue),
            ]),
    );
};

const sanitizeDetails = (value: unknown): Record<string, unknown> => {
    const sanitized = sanitizeBrowserValue(value);
    return sanitized &&
        typeof sanitized === "object" &&
        !Array.isArray(sanitized)
        ? (sanitized as Record<string, unknown>)
        : {};
};

const serializeReceipt = (value: unknown): AcknowledgementReceipt => {
    const row = asRecord(value);
    return {
        id: stringValue(row, "id"),
        receiptNumber: stringValue(row, "receipt_number"),
        payerPersonId: stringValue(row, "payer_person_id"),
        payerName: stringValue(row, "payer_name_snapshot"),
        receiverName: stringValue(row, "receiver_name"),
        amount: numberValue(row, "amount"),
        currency: stringValue(row, "currency"),
        paymentDate: stringValue(row, "payment_date"),
        notes: nullableStringValue(row, "notes"),
        revisionNumber: numberValue(row, "revision_number"),
        publishedAt: nullableStringValue(row, "published_at"),
        payerConfirmedAt: nullableStringValue(row, "payer_confirmed_at"),
        receiverConfirmedAt: nullableStringValue(row, "receiver_confirmed_at"),
        completedAt: nullableStringValue(row, "completed_at"),
        isCompleted: booleanValue(row, "is_completed"),
        voidedAt: nullableStringValue(row, "voided_at"),
        voidReason: nullableStringValue(row, "void_reason"),
        status: stringValue(row, "status") as ReceiptStatus,
        createdAt: stringValue(row, "created_at"),
        updatedAt: stringValue(row, "updated_at"),
    };
};

const serializeSummary = (value: unknown): AcknowledgementReceiptSummary => {
    const row = asRecord(value);
    return {
        ...serializeReceipt(row),
        transactionCount: numberValue(row, "transaction_count"),
        proofCount: numberValue(row, "proof_count"),
    };
};

const serializeTransaction = (value: unknown): ReceiptTransactionReference => {
    const row = asRecord(value);
    return {
        id: stringValue(row, "id"),
        transactionId: nullableStringValue(row, "transaction_id"),
        transactionDate: stringValue(row, "transaction_date_snapshot"),
        description: stringValue(row, "description_snapshot"),
        amount: numberValue(row, "amount_snapshot"),
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
        sizeBytes: numberValue(row, "size_bytes"),
        uploaderRole: stringValue(
            row,
            "uploader_role",
        ) as ReceiptProof["uploaderRole"],
        removedAt: nullableStringValue(row, "removed_at"),
        createdAt: stringValue(row, "created_at"),
    };
};

const publicReceiptFromSnapshot = (value: unknown): AcknowledgementReceipt => {
    const row = asRecord(value);
    return {
        id: stringValue(row, "id"),
        receiptNumber: stringValue(row, "receiptNumber"),
        payerPersonId: stringValue(row, "payerPersonId"),
        payerName: stringValue(row, "payerName"),
        receiverName: stringValue(row, "receiverName"),
        amount: numberValue(row, "amount"),
        currency: stringValue(row, "currency"),
        paymentDate: stringValue(row, "paymentDate"),
        notes: nullableStringValue(row, "notes"),
        revisionNumber: numberValue(row, "revisionNumber"),
        publishedAt: nullableStringValue(row, "publishedAt"),
        payerConfirmedAt: nullableStringValue(row, "payerConfirmedAt"),
        receiverConfirmedAt: nullableStringValue(row, "receiverConfirmedAt"),
        completedAt: nullableStringValue(row, "completedAt"),
        isCompleted: booleanValue(row, "isCompleted"),
        voidedAt: nullableStringValue(row, "voidedAt"),
        voidReason: nullableStringValue(row, "voidReason"),
        status: stringValue(row, "status") as ReceiptStatus,
        createdAt: stringValue(row, "createdAt"),
        updatedAt: stringValue(row, "updatedAt"),
    };
};

const publicTransactionFromSnapshot = (
    value: unknown,
): ReceiptTransactionReference => {
    const row = asRecord(value);
    return {
        id: stringValue(row, "id"),
        transactionId: nullableStringValue(row, "transactionId"),
        transactionDate: stringValue(row, "transactionDate"),
        description: stringValue(row, "description"),
        amount: numberValue(row, "amount"),
        createdAt: stringValue(row, "createdAt"),
    };
};

const publicProofFromSnapshot = (value: unknown): ReceiptProof => {
    const row = asRecord(value);
    return {
        id: stringValue(row, "id"),
        originalFilename: stringValue(row, "originalFilename"),
        contentType: stringValue(
            row,
            "contentType",
        ) as ReceiptProof["contentType"],
        sizeBytes: numberValue(row, "sizeBytes"),
        uploaderRole: stringValue(
            row,
            "uploaderRole",
        ) as ReceiptProof["uploaderRole"],
        removedAt: nullableStringValue(row, "removedAt"),
        createdAt: stringValue(row, "createdAt"),
        ...(typeof row.downloadUrl === "string"
            ? { downloadUrl: row.downloadUrl }
            : {}),
    };
};

const serializeSnapshot = (value: unknown): ReceiptRevisionSnapshot => {
    const snapshot = asRecord(value);
    return {
        receipt: publicReceiptFromSnapshot(snapshot.receipt),
        transactions: asRecords(snapshot.transactions).map(
            publicTransactionFromSnapshot,
        ),
        proofs: asRecords(snapshot.proofs).map(publicProofFromSnapshot),
    };
};

const serializeRevision = (value: unknown): ReceiptRevision => {
    const row = asRecord(value);
    return {
        id: stringValue(row, "id"),
        revisionNumber: numberValue(row, "revision_number"),
        snapshot: serializeSnapshot(row.snapshot),
        changeReason: stringValue(row, "change_reason"),
        changedByRole: stringValue(row, "changed_by_role") as ReceiptActorRole,
        createdAt: stringValue(row, "created_at"),
    };
};

const serializeEvent = (value: unknown): ReceiptEvent => {
    const row = asRecord(value);
    return {
        id: stringValue(row, "id"),
        eventType: stringValue(row, "event_type"),
        actorRole: stringValue(row, "actor_role") as ReceiptActorRole,
        revisionNumber: numberValue(row, "revision_number"),
        details: sanitizeDetails(row.details),
        createdAt: stringValue(row, "created_at"),
    };
};

const normalizeDatabaseError = (
    error: ReceiptDatabaseError,
    fallback: string,
): never => {
    if (error.code === "40001" || error.status === 409) {
        throw new ReceiptConflictError("Receipt revision conflict", {
            cause: error,
        });
    }
    if (error.code === "P0002") {
        throw new ReceiptNotFoundError(
            error.message ?? "Receipt was not found",
            {
                cause: error,
            },
        );
    }
    if (
        error.code === "22023" ||
        error.code === "55000" ||
        error.code === "42501"
    ) {
        throw new ReceiptValidationError(
            error.message ?? "Invalid receipt request",
            {
                cause: error,
            },
        );
    }

    throw new ReceiptUnexpectedError(fallback, { cause: error });
};

const requireQueryData = (
    data: unknown,
    error: ReceiptDatabaseError | null,
    fallback: string,
) => {
    if (error) {
        normalizeDatabaseError(error, fallback);
    }
    return data;
};

const extractReceiptId = (data: unknown): string => {
    const row = Array.isArray(data) ? asRecord(data[0]) : asRecord(data);
    const id = stringValue(row, "id");
    if (!id) {
        throw new ReceiptUnexpectedError("Receipt mutation returned no row");
    }
    return id;
};

const applyFilters = (
    query: ReceiptQuery,
    filters: ReceiptFilters,
): ReceiptQuery => {
    let filtered = query;
    if (filters.status) {
        filtered = filtered.eq("status", filters.status);
    }
    if (filters.payerPersonId) {
        filtered = filtered.eq("payer_person_id", filters.payerPersonId);
    }
    if (filters.paymentDateFrom) {
        filtered = filtered.gte("payment_date", filters.paymentDateFrom);
    }
    if (filters.paymentDateTo) {
        filtered = filtered.lte("payment_date", filters.paymentDateTo);
    }
    if (filters.query) {
        const safeQuery = filters.query.replaceAll(/[,%()]/g, " ").trim();
        if (safeQuery) {
            filtered = filtered.or(
                `receipt_number.ilike.%${safeQuery}%,payer_name_snapshot.ilike.%${safeQuery}%,receiver_name.ilike.%${safeQuery}%`,
            );
        }
    }
    return filtered;
};

export function createReceiptService(
    client: ReceiptDataClient,
    dependencies: ReceiptServiceDependencies = {},
) {
    const createCredentialPin = dependencies.generatePin ?? generatePin;
    const hashCredentialPin = dependencies.hashPin ?? hashPin;
    const createPublicId = dependencies.createPublicId ?? randomUUID;
    const hydrateProofRows = dependencies.hydrateProofRows;

    const listReceipts = async (
        filters: ReceiptFilters = {},
    ): Promise<AcknowledgementReceiptSummary[]> => {
        const query = applyFilters(
            client
                .from("acknowledgement_receipt_overview")
                .select(RECEIPT_COLUMNS),
            filters,
        ).order("payment_date", { ascending: false });
        const { data, error } = await query;
        return asRecords(
            requireQueryData(data, error, "Unable to list receipts"),
        ).map(serializeSummary);
    };

    const getReceipt = async (
        id: string,
    ): Promise<AcknowledgementReceiptDetail> => {
        const receiptResult = await client
            .from("acknowledgement_receipt_overview")
            .select(RECEIPT_COLUMNS)
            .eq("id", id)
            .maybeSingle();
        const receiptData = requireQueryData(
            receiptResult.data,
            receiptResult.error,
            "Unable to load receipt",
        );
        if (!receiptData) {
            throw new ReceiptNotFoundError("Receipt was not found");
        }

        const [
            transactionsResult,
            proofsResult,
            revisionsResult,
            eventsResult,
        ] = await Promise.all([
            client
                .from("acknowledgement_receipt_transactions")
                .select(TRANSACTION_COLUMNS)
                .eq("receipt_id", id)
                .order("created_at", { ascending: true }),
            client
                .from("acknowledgement_receipt_files")
                .select(PROOF_COLUMNS)
                .eq("receipt_id", id)
                .order("created_at", { ascending: true }),
            client
                .from("acknowledgement_receipt_revisions")
                .select(REVISION_COLUMNS)
                .eq("receipt_id", id)
                .order("revision_number", { ascending: false }),
            client
                .from("acknowledgement_receipt_events")
                .select(EVENT_COLUMNS)
                .eq("receipt_id", id)
                .order("created_at", { ascending: false }),
        ]);

        const proofRows = asRecords(
            requireQueryData(
                proofsResult.data,
                proofsResult.error,
                "Unable to load receipt proofs",
            ),
        );
        const activeProofRows = proofRows.filter(
            (row) => row.removed_at == null,
        );
        const activeProofs = hydrateProofRows
            ? await hydrateProofRows(activeProofRows)
            : activeProofRows.map(serializeProof);
        const activeProofsById = new Map(
            activeProofs.map((proof) => [proof.id, proof]),
        );

        return {
            ...serializeReceipt(receiptData),
            transactions: asRecords(
                requireQueryData(
                    transactionsResult.data,
                    transactionsResult.error,
                    "Unable to load receipt transactions",
                ),
            ).map(serializeTransaction),
            proofs: proofRows.map((row) =>
                row.removed_at == null
                    ? (activeProofsById.get(stringValue(row, "id")) ??
                      serializeProof(row))
                    : serializeProof(row),
            ),
            revisions: asRecords(
                requireQueryData(
                    revisionsResult.data,
                    revisionsResult.error,
                    "Unable to load receipt revisions",
                ),
            ).map(serializeRevision),
            events: asRecords(
                requireQueryData(
                    eventsResult.data,
                    eventsResult.error,
                    "Unable to load receipt events",
                ),
            ).map(serializeEvent),
        };
    };

    const createReceipt = async (
        input: CreateReceiptInput,
    ): Promise<AcknowledgementReceiptDetail> => {
        const parsed = createReceiptSchema.parse(input);
        const { data, error } = await client.rpc("ack_create_receipt", {
            p_payer_person_id: parsed.payerPersonId,
            p_receiver_name: parsed.receiverName,
            p_amount: parsed.amount,
            p_currency: parsed.currency,
            p_payment_date: parsed.paymentDate,
            p_notes: parsed.notes ?? null,
            p_transaction_ids: parsed.transactionIds,
        });
        requireQueryData(data, error, "Unable to create receipt");
        return getReceipt(extractReceiptId(data));
    };

    const updateReceipt = async (
        id: string,
        input: UpdateReceiptInput,
    ): Promise<AcknowledgementReceiptDetail> => {
        const parsed = updateReceiptSchema.parse(input);
        const { data, error } = await client.rpc("ack_update_receipt", {
            p_receipt_id: id,
            p_expected_revision: parsed.expectedRevision,
            p_payer_person_id: parsed.payerPersonId,
            p_receiver_name: parsed.receiverName,
            p_amount: parsed.amount,
            p_currency: parsed.currency,
            p_payment_date: parsed.paymentDate,
            p_notes: parsed.notes ?? null,
            p_transaction_ids: parsed.transactionIds,
        });
        requireQueryData(data, error, "Unable to update receipt");
        return getReceipt(extractReceiptId(data));
    };

    const performReceiptAction = async (
        id: string,
        action: ReceiverReceiptAction,
    ): Promise<ReceiverReceiptActionResult> => {
        let rpcName: string;
        let args: Record<string, unknown>;

        if (action.type === "publish") {
            const plaintextPin = createCredentialPin();
            const pinHash = await hashCredentialPin(plaintextPin);
            const { data, error } = await client.rpc(
                "ack_publish_receipt_with_portal",
                {
                    p_receipt_id: id,
                    p_expected_revision: action.expectedRevision,
                    p_pin_hash: pinHash,
                    p_public_id: createPublicId(),
                },
            );
            requireQueryData(data, error, "Unable to publish receipt");

            const payload = asRecord(Array.isArray(data) ? data[0] : data);
            const receiptId = stringValue(payload, "receipt_id");
            if (!receiptId || !payload.portal) {
                throw new ReceiptUnexpectedError(
                    "Receipt publish returned an invalid result",
                );
            }

            return {
                receipt: await getReceipt(receiptId),
                portalCredential: {
                    portal: serializePortalAdminView(payload.portal),
                    pin: payload.portal_created === true ? plaintextPin : null,
                },
            };
        } else if (action.type === "confirm") {
            rpcName = "ack_confirm_receipt";
            args = {
                p_receipt_id: id,
                p_expected_revision: action.expectedRevision,
                p_role: "receiver",
            };
        } else {
            rpcName = "ack_void_receipt";
            args = {
                p_receipt_id: id,
                p_expected_revision: action.expectedRevision,
                p_reason: action.reason,
            };
        }

        const { data, error } = await client.rpc(rpcName, args);
        requireQueryData(data, error, "Unable to perform receipt action");
        return {
            receipt: await getReceipt(extractReceiptId(data)),
            portalCredential: null,
        };
    };

    const getReceiptFormMeta = async (
        payerPersonId?: string,
    ): Promise<ReceiptFormMeta> => {
        const personsQuery = client
            .from("persons")
            .select("id,name")
            .order("name", { ascending: true });
        let transactionsQuery = client
            .from("transactions")
            .select(
                "id,person_id,date,description,amount,paid,acknowledgement_receipt_transactions(id)",
            )
            .order("date", { ascending: false });
        if (payerPersonId) {
            transactionsQuery = transactionsQuery.eq(
                "person_id",
                payerPersonId,
            );
        }

        const [personsResult, transactionsResult] = await Promise.all([
            personsQuery,
            transactionsQuery,
        ]);
        const persons = asRecords(
            requireQueryData(
                personsResult.data,
                personsResult.error,
                "Unable to load receipt persons",
            ),
        ).map(
            (row): ReceiptFormPerson => ({
                id: stringValue(row, "id"),
                name: stringValue(row, "name"),
            }),
        );
        const transactions = asRecords(
            requireQueryData(
                transactionsResult.data,
                transactionsResult.error,
                "Unable to load receipt transactions",
            ),
        ).map(
            (row): ReceiptFormTransaction => ({
                id: stringValue(row, "id"),
                personId: stringValue(row, "person_id"),
                date: stringValue(row, "date"),
                description: stringValue(row, "description"),
                amount: numberValue(row, "amount"),
                paid: booleanValue(row, "paid"),
                alreadyReferenced:
                    Array.isArray(row.acknowledgement_receipt_transactions) &&
                    row.acknowledgement_receipt_transactions.length > 0,
            }),
        );

        return { persons, transactions };
    };

    return {
        listReceipts,
        getReceipt,
        createReceipt,
        updateReceipt,
        performReceiptAction,
        getReceiptFormMeta,
    };
}

const getDefaultService = async () => {
    const [{ getServerSupabase }, { hydrateProofRows }] = await Promise.all([
        import("@/lib/supabase/server"),
        import("./proofService"),
    ]);
    return createReceiptService(getServerSupabase() as unknown as ReceiptDataClient, {
        hydrateProofRows,
    });
};

export async function listReceipts(
    filters?: ReceiptFilters,
): Promise<AcknowledgementReceiptSummary[]> {
    return (await getDefaultService()).listReceipts(filters);
}

export async function getReceipt(
    id: string,
): Promise<AcknowledgementReceiptDetail> {
    return (await getDefaultService()).getReceipt(id);
}

export async function createReceipt(
    input: CreateReceiptInput,
): Promise<AcknowledgementReceiptDetail> {
    return (await getDefaultService()).createReceipt(input);
}

export async function updateReceipt(
    id: string,
    input: UpdateReceiptInput,
): Promise<AcknowledgementReceiptDetail> {
    return (await getDefaultService()).updateReceipt(id, input);
}

export async function performReceiptAction(
    id: string,
    action: ReceiverReceiptAction,
): Promise<ReceiverReceiptActionResult> {
    return (await getDefaultService()).performReceiptAction(id, action);
}

export async function getReceiptFormMeta(
    payerPersonId?: string,
): Promise<ReceiptFormMeta> {
    return (await getDefaultService()).getReceiptFormMeta(payerPersonId);
}
