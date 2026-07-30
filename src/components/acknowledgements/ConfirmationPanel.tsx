"use client";

import { Check, Clock3, ShieldCheck } from "lucide-react";

import Button from "@/components/base/Button";
import { formatReceiptDateTime } from "@/lib/acknowledgements/format";
import type { AcknowledgementReceiptDetail } from "@/lib/acknowledgements/types";

function ConfirmationState({
    label,
    confirmedAt,
}: {
    label: string;
    confirmedAt: string | null;
}) {
    return (
        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
            <p className="flex items-center gap-2 font-medium text-slate-100">
                {confirmedAt ? (
                    <Check
                        className="h-4 w-4 text-emerald-300"
                        aria-hidden="true"
                    />
                ) : (
                    <Clock3
                        className="h-4 w-4 text-amber-300"
                        aria-hidden="true"
                    />
                )}
                {label}
            </p>
            <p className="mt-1 text-sm text-slate-400">
                {confirmedAt
                    ? `Confirmed ${formatReceiptDateTime(confirmedAt)}`
                    : "Not yet confirmed"}
            </p>
        </div>
    );
}

export default function ConfirmationPanel({
    receipt,
    onConfirm,
    isSubmitting = false,
}: {
    receipt: AcknowledgementReceiptDetail;
    onConfirm: () => void | Promise<void>;
    isSubmitting?: boolean;
}) {
    const canConfirm =
        Boolean(receipt.publishedAt) &&
        !receipt.voidedAt &&
        !receipt.receiverConfirmedAt;

    return (
        <section
            className="ledger-panel space-y-4"
            aria-labelledby="confirmation-title"
        >
            <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-300 text-black">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                    <h2
                        id="confirmation-title"
                        className="text-lg font-semibold text-white"
                    >
                        Current revision confirmation
                    </h2>
                    <p className="text-sm text-slate-400">
                        Both parties must confirm revision{" "}
                        {receipt.revisionNumber}.
                    </p>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <ConfirmationState
                    label="Payer"
                    confirmedAt={receipt.payerConfirmedAt}
                />
                <ConfirmationState
                    label="Receiver"
                    confirmedAt={receipt.receiverConfirmedAt}
                />
            </div>

            {!receipt.publishedAt ? (
                <p className="text-sm text-slate-400" role="note">
                    Publish this draft before either party can confirm it.
                </p>
            ) : null}
            {receipt.voidedAt ? (
                <p className="text-sm text-rose-200" role="note">
                    Voided receipts cannot be confirmed.
                </p>
            ) : null}

            <Button
                type="button"
                color="success"
                variant="outline"
                onClick={onConfirm}
                loading={isSubmitting}
                disabled={!canConfirm || isSubmitting}
            >
                {receipt.receiverConfirmedAt
                    ? "Receiver confirmed"
                    : "Confirm payment received"}
            </Button>
        </section>
    );
}
