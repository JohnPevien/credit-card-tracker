import type { ReceiptStatus, ReceiptStatusFields } from "./types";

export function deriveReceiptStatus(
    receipt: ReceiptStatusFields,
): ReceiptStatus {
    if (receipt.voided_at) {
        return "voided";
    }

    if (!receipt.published_at) {
        return "draft";
    }

    if (
        receipt.completed_at &&
        receipt.payer_confirmed_at &&
        receipt.receiver_confirmed_at
    ) {
        return "completed";
    }

    if (receipt.payer_confirmed_at && !receipt.receiver_confirmed_at) {
        return "awaiting_receiver";
    }

    if (!receipt.payer_confirmed_at && receipt.receiver_confirmed_at) {
        return "awaiting_payer";
    }

    return "awaiting_both";
}
