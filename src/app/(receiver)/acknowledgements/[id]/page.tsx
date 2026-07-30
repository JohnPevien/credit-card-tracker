"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
    AlertTriangle,
    ArrowLeft,
    Ban,
    CalendarDays,
    FileImage,
    History,
    Link2,
    Pencil,
    ReceiptText,
    Send,
    UserRound,
} from "lucide-react";

import ConfirmationPanel from "@/components/acknowledgements/ConfirmationPanel";
import PortalAccessCard from "@/components/acknowledgements/PortalAccessCard";
import ReceiptForm, {
    type ReceiptFormValue,
} from "@/components/acknowledgements/ReceiptForm";
import ReceiptStatusBadge from "@/components/acknowledgements/ReceiptStatusBadge";
import {
    ReceiptRequestError,
    requestJson,
    requestPortal,
    requestPortalAction,
    requestReceiptAction,
    updateReceiptRequest,
} from "@/components/acknowledgements/receiptApi";
import Button from "@/components/base/Button";
import {
    formatReceiptAmount,
    formatReceiptDate,
    formatReceiptDateTime,
} from "@/lib/acknowledgements/format";
import type {
    AcknowledgementReceiptDetail,
    PayerPortalAdminView,
    PayerPortalCredentialResult,
    PortalAdminAction,
    ReceiptFormMeta,
} from "@/lib/acknowledgements/types";

type ReceiptDetailPayload = {
    receipt: AcknowledgementReceiptDetail;
};

function DetailTerm({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {label}
            </dt>
            <dd className="mt-1 text-slate-100">{children}</dd>
        </div>
    );
}

export default function AcknowledgementDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [receipt, setReceipt] = useState<AcknowledgementReceiptDetail | null>(
        null,
    );
    const [meta, setMeta] = useState<ReceiptFormMeta>({
        persons: [],
        transactions: [],
    });
    const [portal, setPortal] = useState<PayerPortalAdminView | null>(null);
    const [transientPin, setTransientPin] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [voidReason, setVoidReason] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);

    const loadReceiptData = useCallback(
        async (signal?: AbortSignal) => {
            const [receiptPayload, metaPayload] = await Promise.all([
                requestJson<ReceiptDetailPayload>(
                    `/api/acknowledgements/${id}`,
                    { signal },
                ),
                requestJson<ReceiptFormMeta>("/api/acknowledgements/meta", {
                    signal,
                }),
            ]);
            const portalPayload = await requestPortal(
                receiptPayload.receipt.payerPersonId,
            );
            setReceipt(receiptPayload.receipt);
            setMeta(metaPayload);
            setPortal(portalPayload.portal);
        },
        [id],
    );

    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            setIsLoading(true);
            setError(null);
            try {
                await loadReceiptData(controller.signal);
                if (
                    typeof window !== "undefined" &&
                    new URLSearchParams(window.location.search).get("edit") ===
                        "1"
                ) {
                    setIsEditing(true);
                }
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
                        : "The receipt could not be loaded.",
                );
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }

        void load();
        return () => controller.abort();
    }, [loadReceiptData, retryKey]);

    async function reloadAfterConflict() {
        setIsEditing(false);
        setTransientPin(null);
        await loadReceiptData();
        setError(
            "This receipt changed before your request completed. The latest revision has been loaded; review it and try again.",
        );
    }

    async function saveEdit(value: ReceiptFormValue) {
        if (!receipt) {
            return;
        }
        setPendingAction("edit");
        setError(null);
        setSuccess(null);
        try {
            const payload = await updateReceiptRequest(receipt.id, {
                ...value,
                expectedRevision: receipt.revisionNumber,
            });
            setReceipt(payload.receipt);
            setIsEditing(false);
            setTransientPin(null);
            const portalPayload = await requestPortal(
                payload.receipt.payerPersonId,
            );
            setPortal(portalPayload.portal);
            setSuccess(
                "Receipt updated. Current confirmations were reset and the prior revision remains in history.",
            );
        } catch (caught) {
            if (caught instanceof ReceiptRequestError && caught.isConflict) {
                await reloadAfterConflict();
            } else {
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "The receipt could not be updated.",
                );
            }
        } finally {
            setPendingAction(null);
        }
    }

    async function runReceiptAction(type: "publish" | "confirm" | "void") {
        if (!receipt) {
            return;
        }
        if (type === "void" && !voidReason.trim()) {
            setError("Enter a reason before voiding this receipt.");
            return;
        }

        setPendingAction(type);
        setError(null);
        setSuccess(null);
        try {
            const action =
                type === "void"
                    ? {
                          type,
                          expectedRevision: receipt.revisionNumber,
                          reason: voidReason.trim(),
                      }
                    : {
                          type,
                          expectedRevision: receipt.revisionNumber,
                      };
            const payload = await requestReceiptAction(receipt.id, action);
            setReceipt(payload.receipt);
            if (payload.portalCredential) {
                setPortal(payload.portalCredential.portal);
                setTransientPin(payload.portalCredential.pin);
            }
            setSuccess(
                type === "publish"
                    ? payload.portalCredential?.pin
                        ? "Receipt published. Copy the newly created one-time payer PIN below."
                        : "Receipt published. The existing payer portal PIN remains unchanged and cannot be recovered."
                    : type === "confirm"
                      ? payload.receipt.completedAt
                          ? "Payment confirmed. Both parties have confirmed this revision."
                          : "Payment received confirmation recorded."
                      : "Receipt marked void. It remains in the audit record.",
            );
            if (type === "void") {
                setVoidReason("");
            }
        } catch (caught) {
            if (caught instanceof ReceiptRequestError && caught.isConflict) {
                await reloadAfterConflict();
            } else {
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "The receipt action could not be completed.",
                );
            }
        } finally {
            setPendingAction(null);
        }
    }

    async function runPortalAction(action: PortalAdminAction) {
        if (!receipt) {
            throw new Error("Receipt is not loaded.");
        }
        const result = await requestPortalAction(receipt.payerPersonId, action);
        return result;
    }

    function acceptPortalResult(result: PayerPortalCredentialResult) {
        setPortal(result.portal);
        setTransientPin(result.pin);
    }

    if (isLoading) {
        return (
            <div className="receipt-shell">
                <div
                    className="ledger-panel flex min-h-72 items-center justify-center gap-3 text-slate-300"
                    role="status"
                >
                    <span className="loading loading-spinner" />
                    Loading receipt…
                </div>
            </div>
        );
    }

    if (!receipt) {
        return (
            <div className="receipt-shell">
                <div className="ledger-panel text-center" role="alert">
                    <h1 className="text-2xl font-semibold text-white">
                        Receipt unavailable
                    </h1>
                    <p className="mt-2 text-slate-400">
                        {error ?? "The requested receipt was not found."}
                    </p>
                    <button
                        type="button"
                        className="btn btn-warning mt-4"
                        onClick={() => setRetryKey((key) => key + 1)}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const formValue: ReceiptFormValue = {
        payerPersonId: receipt.payerPersonId,
        receiverName: receipt.receiverName,
        amount: receipt.amount,
        currency: receipt.currency,
        paymentDate: receipt.paymentDate,
        notes: receipt.notes,
        transactionIds: receipt.transactions.flatMap((transaction) =>
            transaction.transactionId ? [transaction.transactionId] : [],
        ),
    };
    const confirmationWarning =
        receipt.status === "completed"
            ? "completed"
            : receipt.payerConfirmedAt || receipt.receiverConfirmedAt
              ? "confirmed"
              : null;

    return (
        <div className="receipt-shell">
            <header className="border-b border-white/10 pb-6">
                <Link
                    href="/acknowledgements"
                    className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to receipt ledger
                </Link>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="receipt-kicker">
                            {receipt.receiptNumber}
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
                            {receipt.payerName}
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                            Current revision {receipt.revisionNumber}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <ReceiptStatusBadge status={receipt.status} />
                        {!receipt.voidedAt && !isEditing ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setError(null);
                                    setSuccess(null);
                                    setIsEditing(true);
                                }}
                            >
                                <Pencil
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Edit receipt
                            </Button>
                        ) : null}
                    </div>
                </div>
            </header>

            {success ? (
                <p
                    className="rounded-xl border border-emerald-700/50 bg-emerald-950/35 p-4 text-emerald-100"
                    role="status"
                >
                    {success}
                </p>
            ) : null}
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
                        Retry / reload
                    </button>
                </div>
            ) : null}

            {isEditing ? (
                <ReceiptForm
                    key={`${receipt.id}-${receipt.revisionNumber}`}
                    persons={meta.persons}
                    initialValue={formValue}
                    confirmationWarning={confirmationWarning}
                    onSubmit={saveEdit}
                    onCancel={() => setIsEditing(false)}
                    submitLabel="Save new revision"
                    isSubmitting={pendingAction === "edit"}
                />
            ) : (
                <>
                    {receipt.voidedAt ? (
                        <div
                            className="flex gap-3 rounded-xl border border-rose-700/50 bg-rose-950/35 p-4 text-rose-100"
                            role="note"
                        >
                            <Ban
                                className="mt-0.5 h-5 w-5 shrink-0"
                                aria-hidden="true"
                            />
                            <div>
                                <p className="font-semibold">Void receipt</p>
                                <p className="mt-1 text-sm">
                                    {receipt.voidReason ??
                                        "No void reason was supplied."}
                                </p>
                            </div>
                        </div>
                    ) : null}

                    <section
                        className="receipt-paper space-y-6"
                        aria-labelledby="receipt-details-title"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <ReceiptText
                                    className="h-6 w-6 text-amber-200"
                                    aria-hidden="true"
                                />
                                <h2
                                    id="receipt-details-title"
                                    className="text-xl font-semibold text-white"
                                >
                                    Receipt details
                                </h2>
                            </div>
                            <span className="font-mono text-xs text-slate-500">
                                REV {receipt.revisionNumber}
                            </span>
                        </div>
                        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <DetailTerm label="Payer">
                                <span className="inline-flex items-center gap-2">
                                    <UserRound
                                        className="h-4 w-4 text-slate-400"
                                        aria-hidden="true"
                                    />
                                    {receipt.payerName}
                                </span>
                            </DetailTerm>
                            <DetailTerm label="Receiver">
                                {receipt.receiverName}
                            </DetailTerm>
                            <DetailTerm label="Amount received">
                                <span className="font-mono text-lg text-amber-100">
                                    {formatReceiptAmount(
                                        receipt.amount,
                                        receipt.currency,
                                    )}
                                </span>
                            </DetailTerm>
                            <DetailTerm label="Payment date">
                                <span className="inline-flex items-center gap-2">
                                    <CalendarDays
                                        className="h-4 w-4 text-slate-400"
                                        aria-hidden="true"
                                    />
                                    {formatReceiptDate(receipt.paymentDate)}
                                </span>
                            </DetailTerm>
                        </dl>
                        <div className="border-t border-dashed border-white/10 pt-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                Notes
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-slate-300">
                                {receipt.notes || "No notes recorded."}
                            </p>
                        </div>
                    </section>

                    <section
                        className="ledger-panel space-y-4"
                        aria-labelledby="transactions-title"
                    >
                        <div className="flex items-center gap-3">
                            <Link2
                                className="h-5 w-5 text-amber-200"
                                aria-hidden="true"
                            />
                            <div>
                                <h2
                                    id="transactions-title"
                                    className="text-lg font-semibold text-white"
                                >
                                    Transaction references
                                </h2>
                                <p className="text-sm text-slate-400">
                                    Reference-only; no amount allocation or
                                    reconciliation.
                                </p>
                            </div>
                        </div>
                        {receipt.transactions.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-slate-400">
                                No transactions referenced.
                            </p>
                        ) : (
                            <ul className="divide-y divide-white/10">
                                {receipt.transactions.map((transaction) => (
                                    <li
                                        key={transaction.id}
                                        className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <span>
                                            <span className="block font-medium text-white">
                                                {transaction.description}
                                            </span>
                                            <span className="text-sm text-slate-400">
                                                {formatReceiptDate(
                                                    transaction.transactionDate,
                                                )}
                                            </span>
                                        </span>
                                        <span className="font-mono text-amber-100">
                                            {formatReceiptAmount(
                                                transaction.amount,
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section
                        className="ledger-panel space-y-4"
                        aria-labelledby="proofs-title"
                    >
                        <div className="flex items-center gap-3">
                            <FileImage
                                className="h-5 w-5 text-sky-200"
                                aria-hidden="true"
                            />
                            <div>
                                <h2
                                    id="proofs-title"
                                    className="text-lg font-semibold text-white"
                                >
                                    Current proof metadata
                                </h2>
                                <p className="text-sm text-slate-400">
                                    {receipt.proofs.length} of 5 active proof
                                    images. Uploading arrives in the next
                                    workflow.
                                </p>
                            </div>
                        </div>
                        {receipt.proofs.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-slate-400">
                                No active proof images supplied.
                            </p>
                        ) : (
                            <ul className="grid gap-3 sm:grid-cols-2">
                                {receipt.proofs.map((proof) => (
                                    <li
                                        key={proof.id}
                                        className="rounded-xl border border-white/10 bg-black/20 p-3"
                                    >
                                        <p className="truncate font-medium text-white">
                                            {proof.originalFilename}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            {proof.uploaderRole} ·{" "}
                                            {(
                                                proof.sizeBytes /
                                                1024 /
                                                1024
                                            ).toFixed(2)}{" "}
                                            MiB ·{" "}
                                            {formatReceiptDateTime(
                                                proof.createdAt,
                                            )}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <ConfirmationPanel
                            receipt={receipt}
                            onConfirm={() => runReceiptAction("confirm")}
                            isSubmitting={pendingAction === "confirm"}
                        />
                        <PortalAccessCard
                            portal={portal}
                            transientPin={transientPin}
                            onAction={runPortalAction}
                            onResult={acceptPortalResult}
                        />
                    </div>

                    {!receipt.voidedAt ? (
                        <section
                            className="ledger-panel space-y-4"
                            aria-labelledby="actions-title"
                        >
                            <h2
                                id="actions-title"
                                className="text-lg font-semibold text-white"
                            >
                                Receipt actions
                            </h2>
                            {!receipt.publishedAt ? (
                                <div className="rounded-xl border border-sky-700/40 bg-sky-950/25 p-4">
                                    <p className="text-sm text-sky-100">
                                        Publishing makes this receipt available
                                        in the payer portal. A PIN is shown only
                                        if this creates the payer&apos;s portal.
                                    </p>
                                    <Button
                                        type="button"
                                        color="info"
                                        className="mt-3"
                                        loading={pendingAction === "publish"}
                                        onClick={() =>
                                            runReceiptAction("publish")
                                        }
                                    >
                                        <Send
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                        Publish receipt
                                    </Button>
                                </div>
                            ) : null}

                            <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 p-4">
                                <p className="flex items-start gap-2 text-sm text-rose-100">
                                    <AlertTriangle
                                        className="mt-0.5 h-4 w-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                    Voiding is permanent in the current UI. The
                                    record and history remain visible.
                                </p>
                                <label
                                    className="mt-3 block text-sm font-medium text-slate-300"
                                    htmlFor="void-reason"
                                >
                                    Void reason
                                </label>
                                <textarea
                                    id="void-reason"
                                    className="textarea textarea-bordered mt-2 w-full bg-black/30 focus:outline-none focus:ring-2 focus:ring-rose-300"
                                    value={voidReason}
                                    onChange={(event) =>
                                        setVoidReason(event.target.value)
                                    }
                                    maxLength={500}
                                />
                                <Button
                                    type="button"
                                    color="error"
                                    variant="outline"
                                    className="mt-3"
                                    loading={pendingAction === "void"}
                                    onClick={() => runReceiptAction("void")}
                                >
                                    <Ban
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    Void receipt
                                </Button>
                            </div>
                        </section>
                    ) : null}

                    <section
                        className="ledger-panel space-y-5"
                        aria-labelledby="history-title"
                    >
                        <div className="flex items-center gap-3">
                            <History
                                className="h-5 w-5 text-slate-300"
                                aria-hidden="true"
                            />
                            <div>
                                <h2
                                    id="history-title"
                                    className="text-lg font-semibold text-white"
                                >
                                    Audit history
                                </h2>
                                <p className="text-sm text-slate-400">
                                    Immutable events and preserved prior
                                    revisions.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Events
                            </h3>
                            {receipt.events.length === 0 ? (
                                <p className="mt-2 text-sm text-slate-400">
                                    No events supplied by the API.
                                </p>
                            ) : (
                                <ol className="mt-3 space-y-3 border-l border-white/10 pl-5">
                                    {receipt.events.map((event) => (
                                        <li key={event.id} className="relative">
                                            <span className="absolute -left-[1.45rem] top-1.5 h-2 w-2 rounded-full bg-amber-300" />
                                            <p className="font-medium text-slate-100">
                                                {event.eventType
                                                    .replaceAll("_", " ")
                                                    .replace(/^\w/, (letter) =>
                                                        letter.toUpperCase(),
                                                    )}
                                            </p>
                                            <p className="mt-0.5 text-xs text-slate-400">
                                                {event.actorRole} · revision{" "}
                                                {event.revisionNumber} ·{" "}
                                                {formatReceiptDateTime(
                                                    event.createdAt,
                                                )}
                                            </p>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </div>

                        <div className="border-t border-white/10 pt-5">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Preserved revisions
                            </h3>
                            {receipt.revisions.length === 0 ? (
                                <p className="mt-2 text-sm text-slate-400">
                                    No prior revisions yet.
                                </p>
                            ) : (
                                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                                    {receipt.revisions.map((revision) => (
                                        <li
                                            key={revision.id}
                                            className="rounded-xl border border-white/10 bg-black/20 p-4"
                                        >
                                            <p className="font-mono text-amber-100">
                                                Revision{" "}
                                                {revision.revisionNumber}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-200">
                                                {revision.changeReason}
                                            </p>
                                            <p className="mt-2 text-xs text-slate-500">
                                                {revision.changedByRole} ·{" "}
                                                {formatReceiptDateTime(
                                                    revision.createdAt,
                                                )}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
