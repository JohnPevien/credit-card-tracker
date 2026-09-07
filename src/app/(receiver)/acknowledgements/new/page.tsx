"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ReceiptText } from "lucide-react";

import ReceiptForm, {
    type ReceiptFormValue,
} from "@/components/acknowledgements/ReceiptForm";
import {
    proofApiBase,
    uploadProofFile,
} from "@/components/acknowledgements/ProofUploader";
import {
    ReceiptRequestError,
    createReceiptRequest,
    requestJson,
} from "@/components/acknowledgements/receiptApi";
import type { ReceiptFormMeta } from "@/lib/acknowledgements/types";

export default function NewAcknowledgementPage() {
    const router = useRouter();
    const [meta, setMeta] = useState<ReceiptFormMeta>({
        persons: [],
        transactions: [],
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const [stagedProofFiles, setStagedProofFiles] = useState<File[]>([]);

    useEffect(() => {
        const controller = new AbortController();

        async function loadMeta() {
            setIsLoading(true);
            setError(null);
            try {
                setMeta(
                    await requestJson<ReceiptFormMeta>(
                        "/api/acknowledgements/meta",
                        { signal: controller.signal },
                    ),
                );
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
                        : "Receipt options could not be loaded.",
                );
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }

        void loadMeta();
        return () => controller.abort();
    }, [retryKey]);

    async function saveDraft(value: ReceiptFormValue) {
        setIsSubmitting(true);
        setError(null);
        try {
            const { receipt } = await createReceiptRequest(value);
            const apiBase = proofApiBase(receipt.id, "receiver");
            let expectedRevision = receipt.revisionNumber;
            let uploadedCount = 0;
            try {
                for (const file of stagedProofFiles) {
                    const result = await uploadProofFile({
                        apiBase,
                        file,
                        expectedRevision,
                    });
                    expectedRevision = result.revisionNumber;
                    uploadedCount += 1;
                    setStagedProofFiles((current) =>
                        current.filter((candidate) => candidate !== file),
                    );
                }
            } catch {
                router.push(
                    `/acknowledgements/${receipt.id}?proofUpload=retry&uploaded=${uploadedCount}`,
                );
                return;
            }
            router.push(`/acknowledgements/${receipt.id}`);
        } catch (caught) {
            setError(
                caught instanceof ReceiptRequestError
                    ? caught.message
                    : "The draft could not be saved.",
            );
            setIsSubmitting(false);
        }
    }

    return (
        <div className="receipt-shell max-w-5xl">
            <header className="border-b border-white/10 pb-6">
                <Link
                    href="/acknowledgements"
                    className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to receipt ledger
                </Link>
                <div className="flex items-center gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-amber-300 text-black">
                        <ReceiptText className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div>
                        <p className="receipt-kicker">New draft</p>
                        <h1 className="mt-1 text-3xl font-semibold text-white">
                            Create acknowledgement
                        </h1>
                    </div>
                </div>
            </header>

            {error ? (
                <div
                    className="flex flex-col gap-3 rounded-xl border border-rose-800/60 bg-rose-950/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                    role="alert"
                >
                    <span>{error}</span>
                    {!isSubmitting ? (
                        <button
                            type="button"
                            className="btn btn-outline btn-sm min-h-11"
                            onClick={() => setRetryKey((key) => key + 1)}
                        >
                            Retry loading
                        </button>
                    ) : null}
                </div>
            ) : null}

            {isLoading ? (
                <div
                    className="ledger-panel flex min-h-64 items-center justify-center gap-3 text-slate-300"
                    role="status"
                >
                    <span className="loading loading-spinner" />
                    Loading receipt form…
                </div>
            ) : meta.persons.length === 0 ? (
                <div className="ledger-panel text-center">
                    <h2 className="text-xl font-semibold text-white">
                        Add a payer first
                    </h2>
                    <p className="mt-2 text-slate-400">
                        Receipts can only be assigned to an existing Person.
                    </p>
                    <Link href="/persons" className="btn btn-warning mt-4">
                        Open Persons
                    </Link>
                </div>
            ) : (
                <ReceiptForm
                    persons={meta.persons}
                    onSubmit={saveDraft}
                    onCancel={() => router.push("/acknowledgements")}
                    isSubmitting={isSubmitting}
                    stagedProofFiles={stagedProofFiles}
                    onStagedProofFilesChange={setStagedProofFiles}
                />
            )}
        </div>
    );
}
