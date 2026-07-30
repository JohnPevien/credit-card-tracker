export type ReceiptStatus =
    | "draft"
    | "awaiting_both"
    | "awaiting_payer"
    | "awaiting_receiver"
    | "completed"
    | "voided";

export type ReceiptActorRole = "payer" | "receiver" | "system";
export type ReceiptUploaderRole = Exclude<ReceiptActorRole, "system">;

export interface ReceiptStatusFields {
    published_at: string | null;
    payer_confirmed_at: string | null;
    receiver_confirmed_at: string | null;
    completed_at: string | null;
    voided_at: string | null;
}

export interface AcknowledgementReceipt {
    id: string;
    receiptNumber: string;
    payerPersonId: string;
    payerName: string;
    receiverName: string;
    amount: number;
    currency: string;
    paymentDate: string;
    notes: string | null;
    revisionNumber: number;
    publishedAt: string | null;
    payerConfirmedAt: string | null;
    receiverConfirmedAt: string | null;
    completedAt: string | null;
    isCompleted: boolean;
    voidedAt: string | null;
    voidReason: string | null;
    status: ReceiptStatus;
    createdAt: string;
    updatedAt: string;
}

export interface AcknowledgementReceiptSummary extends AcknowledgementReceipt {
    transactionCount: number;
    proofCount: number;
}

export interface ReceiptTransactionReference {
    id: string;
    transactionId: string | null;
    transactionDate: string;
    description: string;
    amount: number;
    createdAt: string;
}

export interface ReceiptProof {
    id: string;
    originalFilename: string;
    contentType: "image/jpeg" | "image/png" | "image/webp";
    sizeBytes: number;
    uploaderRole: ReceiptUploaderRole;
    removedAt: string | null;
    createdAt: string;
    downloadUrl?: string;
}

export interface ReceiptRevision {
    id: string;
    revisionNumber: number;
    snapshot: ReceiptRevisionSnapshot;
    changeReason: string;
    changedByRole: ReceiptActorRole;
    createdAt: string;
}

export interface ReceiptRevisionSnapshot {
    receipt: AcknowledgementReceipt;
    transactions: ReceiptTransactionReference[];
    proofs: ReceiptProof[];
}

export interface ReceiptEvent {
    id: string;
    eventType: string;
    actorRole: ReceiptActorRole;
    revisionNumber: number;
    details: Record<string, unknown>;
    createdAt: string;
}

export interface AcknowledgementReceiptDetail extends AcknowledgementReceipt {
    transactions: ReceiptTransactionReference[];
    proofs: ReceiptProof[];
    revisions: ReceiptRevision[];
    events: ReceiptEvent[];
}

export interface ReceiptFilters {
    status?: ReceiptStatus;
    payerPersonId?: string;
    paymentDateFrom?: string;
    paymentDateTo?: string;
    query?: string;
}

export interface ReceiptFormPerson {
    id: string;
    name: string;
}

export interface ReceiptFormTransaction {
    id: string;
    personId: string;
    date: string;
    description: string;
    amount: number;
    paid: boolean;
    alreadyReferenced: boolean;
}

export interface ReceiptFormMeta {
    persons: ReceiptFormPerson[];
    transactions: ReceiptFormTransaction[];
}

export interface PayerPortalSummary {
    personId: string;
    payerName: string;
    publicId: string;
    credentialVersion: number;
    revokedAt: string | null;
    lastAccessedAt: string | null;
}

export interface PayerPortalAdminView extends PayerPortalSummary {
    createdAt: string;
    updatedAt: string;
}

export interface PayerPortalCredentialResult {
    portal: PayerPortalAdminView;
    pin: string | null;
}

export interface CreateReceiptInput {
    payerPersonId: string;
    receiverName: string;
    amount: number;
    currency: string;
    paymentDate: string;
    notes?: string | null;
    transactionIds?: string[];
}

export interface UpdateReceiptInput extends CreateReceiptInput {
    expectedRevision: number;
}

export type ReceiverReceiptAction =
    | { type: "publish"; expectedRevision: number }
    | { type: "confirm"; expectedRevision: number }
    | { type: "void"; expectedRevision: number; reason: string };

export type PortalAdminAction =
    | { type: "generate-pin" }
    | { type: "reset-pin" }
    | { type: "rotate-link" }
    | { type: "revoke" }
    | { type: "reactivate" };

export interface AckCreateReceiptArgs {
    p_payer_person_id: string;
    p_receiver_name: string;
    p_amount: number;
    p_currency: string;
    p_payment_date: string;
    p_notes: string | null;
    p_transaction_ids: string[];
}

export interface AckUpdateReceiptArgs extends AckCreateReceiptArgs {
    p_receipt_id: string;
    p_expected_revision: number;
}

export interface AckReceiptRevisionArgs {
    p_receipt_id: string;
    p_expected_revision: number;
}

export interface AckConfirmReceiptArgs extends AckReceiptRevisionArgs {
    p_role: ReceiptUploaderRole;
}

export interface AckVoidReceiptArgs extends AckReceiptRevisionArgs {
    p_reason: string;
}

export interface AckRemoveFileArgs extends AckReceiptRevisionArgs {
    p_file_id: string;
    p_actor_role: ReceiptUploaderRole;
}

export interface AckSetTransactionPaidArgs {
    p_transaction_id: string;
    p_paid: boolean;
    p_receipt_id: string | null;
    p_expected_revision: number | null;
}

export interface AckSetTransactionPaidResult {
    transaction_id: string;
    paid: boolean;
    receipt_id: string | null;
    receipt_revision: number | null;
}

export interface AcknowledgementReceiptRpcArgs {
    ack_create_receipt: AckCreateReceiptArgs;
    ack_update_receipt: AckUpdateReceiptArgs;
    ack_publish_receipt: AckReceiptRevisionArgs;
    ack_confirm_receipt: AckConfirmReceiptArgs;
    ack_void_receipt: AckVoidReceiptArgs;
    ack_remove_file: AckRemoveFileArgs;
    ack_set_transaction_paid: AckSetTransactionPaidArgs;
}
