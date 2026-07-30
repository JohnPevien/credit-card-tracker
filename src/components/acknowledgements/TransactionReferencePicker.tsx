"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Link2 } from "lucide-react";

import {
    formatReceiptAmount,
    formatReceiptDate,
} from "@/lib/acknowledgements/format";
import type {
    ReceiptFormMeta,
    ReceiptFormTransaction,
} from "@/lib/acknowledgements/types";
import { ReceiptRequestError, requestJson } from "./receiptApi";

type TransactionReferencePickerProps = {
    payerPersonId: string;
    selectedIds: string[];
    onChange: (transactionIds: string[]) => void;
    disabled?: boolean;
};

export default function TransactionReferencePicker({
    payerPersonId,
    selectedIds,
    onChange,
    disabled = false,
}: TransactionReferencePickerProps) {
    const [transactions, setTransactions] = useState<ReceiptFormTransaction[]>(
        [],
    );
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        if (!payerPersonId) {
            setTransactions([]);
            setError(null);
            return;
        }

        const controller = new AbortController();

        async function loadTransactions() {
            setIsLoading(true);
            setError(null);
            try {
                const meta = await requestJson<ReceiptFormMeta>(
                    `/api/acknowledgements/meta?payerPersonId=${payerPersonId}`,
                    { signal: controller.signal },
                );
                setTransactions(meta.transactions);
            } catch (caught) {
                if (
                    caught instanceof DOMException &&
                    caught.name === "AbortError"
                ) {
                    return;
                }
                setTransactions([]);
                setError(
                    caught instanceof ReceiptRequestError
                        ? caught.message
                        : "Transactions could not be loaded.",
                );
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }

        void loadTransactions();
        return () => controller.abort();
    }, [payerPersonId, retryKey]);

    const selectedIdSet = new Set(selectedIds);
    const selectedTotal = transactions.reduce(
        (sum, transaction) =>
            selectedIdSet.has(transaction.id) ? sum + transaction.amount : sum,
        0,
    );

    function toggleTransaction(transactionId: string) {
        onChange(
            selectedIdSet.has(transactionId)
                ? selectedIds.filter((id) => id !== transactionId)
                : [...selectedIds, transactionId],
        );
    }

    if (!payerPersonId) {
        return (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-5 text-sm text-slate-400">
                Choose a payer to see their eligible transactions.
            </div>
        );
    }

    if (isLoading) {
        return (
            <div
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300"
                role="status"
            >
                <span className="loading loading-spinner loading-sm" />
                Loading payer transactions…
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="rounded-xl border border-rose-800/70 bg-rose-950/30 p-4"
                role="alert"
            >
                <p className="flex items-center gap-2 text-sm text-rose-100">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    {error}
                </p>
                <button
                    className="btn btn-ghost btn-sm mt-2 min-h-11"
                    type="button"
                    onClick={() => setRetryKey((key) => key + 1)}
                >
                    Retry transactions
                </button>
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <p className="rounded-xl border border-dashed border-white/15 bg-black/20 p-5 text-sm text-slate-400">
                No transactions are available for this payer. References are
                optional, so the receipt can still be saved.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {transactions.map((transaction) => (
                    <label
                        key={transaction.id}
                        className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-amber-400/40 focus-within:ring-2 focus-within:ring-amber-300"
                    >
                        <input
                            type="checkbox"
                            className="checkbox checkbox-warning mt-1"
                            checked={selectedIdSet.has(transaction.id)}
                            onChange={() => toggleTransaction(transaction.id)}
                            disabled={disabled}
                            aria-label={`${transaction.description}, ${formatReceiptDate(transaction.date)}, ${formatReceiptAmount(transaction.amount)}`}
                        />
                        <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-medium text-slate-100">
                                    {transaction.description}
                                </span>
                                <span className="font-mono text-sm text-amber-100">
                                    {formatReceiptAmount(transaction.amount)}
                                </span>
                            </span>
                            <span className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                                <span>
                                    {formatReceiptDate(transaction.date)}
                                </span>
                                <span>
                                    {transaction.paid ? "Paid" : "Not paid"}
                                </span>
                                {transaction.alreadyReferenced ? (
                                    <span className="inline-flex items-center gap-1">
                                        <Link2
                                            className="h-3 w-3"
                                            aria-hidden="true"
                                        />
                                        Referenced elsewhere
                                    </span>
                                ) : null}
                            </span>
                        </span>
                    </label>
                ))}
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-slate-300">
                    Selected reference total:{" "}
                    <strong className="font-mono text-amber-100">
                        {formatReceiptAmount(selectedTotal)}
                    </strong>
                </span>
                <span className="text-xs text-slate-400">
                    For context only — it does not validate the receipt amount.
                </span>
            </div>
        </div>
    );
}
