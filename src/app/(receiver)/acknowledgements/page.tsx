"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
    CalendarDays,
    Check,
    CircleDashed,
    Eye,
    FileImage,
    Pencil,
    Plus,
    ReceiptText,
    RotateCcw,
} from "lucide-react";

import ReceiptStatusBadge from "@/components/acknowledgements/ReceiptStatusBadge";
import {
    ReceiptRequestError,
    requestJson,
} from "@/components/acknowledgements/receiptApi";
import {
    formatReceiptAmount,
    formatReceiptDate,
    formatReceiptDateTime,
} from "@/lib/acknowledgements/format";
import type {
    AcknowledgementReceiptSummary,
    ReceiptFilters,
    ReceiptFormMeta,
    ReceiptStatus,
} from "@/lib/acknowledgements/types";

type ReceiptListPayload = {
    receipts: AcknowledgementReceiptSummary[];
};

const statusOptions: Array<{ value: ReceiptStatus | ""; label: string }> = [
    { value: "", label: "All statuses" },
    { value: "draft", label: "Draft" },
    { value: "awaiting_both", label: "Awaiting both" },
    { value: "awaiting_payer", label: "Awaiting payer" },
    { value: "awaiting_receiver", label: "Awaiting receiver" },
    { value: "completed", label: "Completed" },
    { value: "voided", label: "Void" },
];

function ConfirmationMark({
    label,
    date,
}: {
    label: string;
    date: string | null;
}) {
    return (
        <span
            className="inline-flex items-center gap-1.5 text-xs text-slate-300"
            title={date ? formatReceiptDateTime(date) : `${label} pending`}
        >
            {date ? (
                <Check
                    className="h-3.5 w-3.5 text-emerald-300"
                    aria-hidden="true"
                />
            ) : (
                <CircleDashed
                    className="h-3.5 w-3.5 text-amber-300"
                    aria-hidden="true"
                />
            )}
            {label}: {date ? "confirmed" : "pending"}
        </span>
    );
}

function ReceiptActions({
    receipt,
}: {
    receipt: AcknowledgementReceiptSummary;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            <Link
                href={`/acknowledgements/${receipt.id}`}
                className="btn btn-outline btn-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
                <Eye className="h-4 w-4" aria-hidden="true" />
                View
            </Link>
            {!receipt.voidedAt ? (
                <Link
                    href={`/acknowledgements/${receipt.id}?edit=1`}
                    className="btn btn-ghost btn-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                </Link>
            ) : null}
        </div>
    );
}

function MobileReceiptCard({
    receipt,
}: {
    receipt: AcknowledgementReceiptSummary;
}) {
    return (
        <article className="receipt-paper space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="receipt-kicker">{receipt.receiptNumber}</p>
                    <h2 className="mt-1 text-xl font-semibold text-white">
                        {receipt.payerName}
                    </h2>
                </div>
                <ReceiptStatusBadge status={receipt.status} />
            </div>
            <div className="flex items-end justify-between gap-3 border-y border-dashed border-white/10 py-4">
                <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                        Amount
                    </p>
                    <p className="font-mono text-xl text-amber-100">
                        {formatReceiptAmount(receipt.amount, receipt.currency)}
                    </p>
                </div>
                <p className="text-sm text-slate-300">
                    {formatReceiptDate(receipt.paymentDate)}
                </p>
            </div>
            <div className="space-y-1.5">
                <ConfirmationMark
                    label="Payer"
                    date={receipt.payerConfirmedAt}
                />
                <ConfirmationMark
                    label="Receiver"
                    date={receipt.receiverConfirmedAt}
                />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                    <FileImage className="h-3.5 w-3.5" aria-hidden="true" />
                    {receipt.proofCount} proof
                    {receipt.proofCount === 1 ? "" : "s"}
                </span>
                <span>Revision {receipt.revisionNumber}</span>
            </div>
            <ReceiptActions receipt={receipt} />
        </article>
    );
}

export default function AcknowledgementsPage() {
    const [receipts, setReceipts] = useState<AcknowledgementReceiptSummary[]>(
        [],
    );
    const [meta, setMeta] = useState<ReceiptFormMeta>({
        persons: [],
        transactions: [],
    });
    const [filters, setFilters] = useState({
        payerPersonId: "",
        status: "" as ReceiptStatus | "",
        paymentDateFrom: "",
        paymentDateTo: "",
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        async function loadDashboard() {
            setIsLoading(true);
            setError(null);
            try {
                const [receiptPayload, metaPayload] = await Promise.all([
                    requestJson<ReceiptListPayload>("/api/acknowledgements", {
                        signal: controller.signal,
                    }),
                    requestJson<ReceiptFormMeta>("/api/acknowledgements/meta", {
                        signal: controller.signal,
                    }),
                ]);
                setReceipts(receiptPayload.receipts);
                setMeta(metaPayload);
            } catch (caught) {
                if (
                    caught instanceof DOMException &&
                    caught.name === "AbortError"
                ) {
                    return;
                }
                setError(
                    caught instanceof ReceiptRequestError
                        ? caught.message
                        : "The receipt ledger could not be loaded.",
                );
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }

        void loadDashboard();
        return () => controller.abort();
    }, [retryKey]);

    async function applyFilters(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const search = new URLSearchParams();
        const entries = Object.entries(filters) as Array<
            [keyof ReceiptFilters, string]
        >;
        for (const [key, value] of entries) {
            if (value) {
                search.set(key, value);
            }
        }

        setIsFiltering(true);
        setError(null);
        try {
            const payload = await requestJson<ReceiptListPayload>(
                `/api/acknowledgements${search.size ? `?${search}` : ""}`,
            );
            setReceipts(payload.receipts);
        } catch (caught) {
            setError(
                caught instanceof ReceiptRequestError
                    ? caught.message
                    : "Filters could not be applied.",
            );
        } finally {
            setIsFiltering(false);
        }
    }

    async function clearFilters() {
        setFilters({
            payerPersonId: "",
            status: "",
            paymentDateFrom: "",
            paymentDateTo: "",
        });
        setIsFiltering(true);
        setError(null);
        try {
            const payload = await requestJson<ReceiptListPayload>(
                "/api/acknowledgements",
            );
            setReceipts(payload.receipts);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "The receipt ledger could not be refreshed.",
            );
        } finally {
            setIsFiltering(false);
        }
    }

    return (
        <div className="receipt-shell">
            <header className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="receipt-kicker">Receiver ledger</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                        Acknowledgement receipts
                    </h1>
                    <p className="mt-2 max-w-2xl text-slate-400">
                        Issue reference-only receipts and track confirmation
                        from both parties.
                    </p>
                </div>
                <Link
                    href="/acknowledgements/new"
                    className="btn btn-warning focus:outline-none focus:ring-2 focus:ring-amber-200"
                >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create receipt
                </Link>
            </header>

            <form
                className="ledger-panel grid gap-4 md:grid-cols-2 xl:grid-cols-6"
                onSubmit={applyFilters}
                aria-label="Receipt filters"
            >
                <label className="space-y-2 xl:col-span-2">
                    <span className="text-sm font-medium text-slate-300">
                        Payer
                    </span>
                    <select
                        className="select select-bordered w-full bg-black/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
                        value={filters.payerPersonId}
                        onChange={(event) =>
                            setFilters((current) => ({
                                ...current,
                                payerPersonId: event.target.value,
                            }))
                        }
                    >
                        <option value="">All payers</option>
                        {meta.persons.map((person) => (
                            <option key={person.id} value={person.id}>
                                {person.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">
                        Status
                    </span>
                    <select
                        className="select select-bordered w-full bg-black/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
                        value={filters.status}
                        onChange={(event) =>
                            setFilters((current) => ({
                                ...current,
                                status: event.target.value as
                                    | ReceiptStatus
                                    | "",
                            }))
                        }
                    >
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">
                        From date
                    </span>
                    <input
                        type="date"
                        className="input input-bordered w-full bg-black/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
                        value={filters.paymentDateFrom}
                        onChange={(event) =>
                            setFilters((current) => ({
                                ...current,
                                paymentDateFrom: event.target.value,
                            }))
                        }
                    />
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">
                        To date
                    </span>
                    <input
                        type="date"
                        className="input input-bordered w-full bg-black/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
                        value={filters.paymentDateTo}
                        onChange={(event) =>
                            setFilters((current) => ({
                                ...current,
                                paymentDateTo: event.target.value,
                            }))
                        }
                    />
                </label>
                <div className="flex items-end gap-2">
                    <button
                        type="submit"
                        className="btn btn-warning flex-1"
                        disabled={isFiltering}
                    >
                        {isFiltering ? (
                            <span className="loading loading-spinner loading-sm" />
                        ) : null}
                        Apply
                    </button>
                    <button
                        type="button"
                        className="btn btn-ghost btn-square"
                        onClick={clearFilters}
                        aria-label="Clear receipt filters"
                        disabled={isFiltering}
                    >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </form>

            {error ? (
                <div
                    className="flex flex-col gap-3 rounded-xl border border-rose-800/60 bg-rose-950/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                    role="alert"
                >
                    <span>{error}</span>
                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setRetryKey((key) => key + 1)}
                    >
                        Retry
                    </button>
                </div>
            ) : null}

            {isLoading ? (
                <div
                    className="ledger-panel flex min-h-56 items-center justify-center gap-3 text-slate-300"
                    role="status"
                >
                    <span className="loading loading-spinner" />
                    Loading receipt ledger…
                </div>
            ) : receipts.length === 0 ? (
                <div className="ledger-panel grid min-h-64 place-items-center text-center">
                    <div>
                        <ReceiptText
                            className="mx-auto h-10 w-10 text-amber-200"
                            aria-hidden="true"
                        />
                        <h2 className="mt-4 text-xl font-semibold text-white">
                            No receipts match
                        </h2>
                        <p className="mt-2 text-slate-400">
                            Clear the filters or create the first
                            acknowledgement.
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="space-y-4 md:hidden">
                        {receipts.map((receipt) => (
                            <MobileReceiptCard
                                key={receipt.id}
                                receipt={receipt}
                            />
                        ))}
                    </div>

                    <div className="ledger-panel hidden overflow-x-auto p-0 md:block">
                        <table className="table table-sm">
                            <thead>
                                <tr className="border-white/10 text-xs uppercase tracking-wider text-slate-500">
                                    <th>Receipt</th>
                                    <th>Payer</th>
                                    <th>Payment</th>
                                    <th>Status</th>
                                    <th>Confirmations</th>
                                    <th>Record</th>
                                    <th>
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {receipts.map((receipt) => (
                                    <tr
                                        key={receipt.id}
                                        className="border-white/10 hover:bg-white/[0.025]"
                                    >
                                        <td className="font-mono text-amber-100">
                                            {receipt.receiptNumber}
                                        </td>
                                        <td className="font-medium text-white">
                                            {receipt.payerName}
                                        </td>
                                        <td>
                                            <span className="block font-mono text-slate-100">
                                                {formatReceiptAmount(
                                                    receipt.amount,
                                                    receipt.currency,
                                                )}
                                            </span>
                                            <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400">
                                                <CalendarDays
                                                    className="h-3 w-3"
                                                    aria-hidden="true"
                                                />
                                                {formatReceiptDate(
                                                    receipt.paymentDate,
                                                )}
                                            </span>
                                        </td>
                                        <td>
                                            <ReceiptStatusBadge
                                                status={receipt.status}
                                            />
                                        </td>
                                        <td className="space-y-1">
                                            <ConfirmationMark
                                                label="Payer"
                                                date={receipt.payerConfirmedAt}
                                            />
                                            <ConfirmationMark
                                                label="Receiver"
                                                date={
                                                    receipt.receiverConfirmedAt
                                                }
                                            />
                                        </td>
                                        <td className="text-xs text-slate-400">
                                            <span className="block">
                                                {receipt.proofCount} proof
                                                {receipt.proofCount === 1
                                                    ? ""
                                                    : "s"}
                                            </span>
                                            <span>
                                                Revision{" "}
                                                {receipt.revisionNumber}
                                            </span>
                                        </td>
                                        <td>
                                            <ReceiptActions receipt={receipt} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
