"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileImage, RotateCcw, Trash2, Upload } from "lucide-react";

import {
    ReceiptRequestError,
    requestJson,
} from "@/components/acknowledgements/receiptApi";
import { supabase } from "@/lib/supabase";
import type {
    ReceiptProof,
    ReceiptUploaderRole,
} from "@/lib/acknowledgements/types";

const PROOF_BUCKET = "acknowledgement-proofs";
const MAX_PROOFS = 5;
const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type StagedProof = {
    id: string;
    file: File;
    previewUrl: string;
    status: "ready" | "requesting" | "uploading" | "finalizing" | "error";
    progress: number;
    error: string | null;
};

export type ProofChange = {
    revisionNumber: number;
    proof?: ReceiptProof;
    removedFileId?: string;
    conflict?: boolean;
};

type ProofUploaderProps = {
    receiptId: string;
    revisionNumber: number;
    proofs: ReceiptProof[];
    uploaderRole: ReceiptUploaderRole;
    publicId?: string;
    disabled?: boolean;
    onChanged: (change: ProofChange) => void | Promise<void>;
};

type ProofUploadTarget = {
    path: string;
    token: string;
};

type ProofFinalizeResult = {
    proof: ReceiptProof;
    revisionNumber: number;
};

class ProofRequestError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = "ProofRequestError";
    }
}

const responseErrorMessage = (value: unknown, fallback: string) =>
    value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
        ? value.error
        : fallback;

async function proofRequest<T>(
    input: RequestInfo | URL,
    init: RequestInit,
): Promise<T> {
    if (String(input).startsWith("/api/acknowledgements/")) {
        try {
            return await requestJson<T>(input, init);
        } catch (error) {
            if (error instanceof ReceiptRequestError) {
                throw new ProofRequestError(error.message, error.status);
            }
            throw error;
        }
    }

    const response = await fetch(input, {
        cache: "no-store",
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...init.headers,
        },
    });
    let payload: unknown = null;
    try {
        payload = await response.json();
    } catch {
        throw new ProofRequestError(
            "The proof server returned an invalid response.",
            response.status,
        );
    }
    if (!response.ok) {
        throw new ProofRequestError(
            responseErrorMessage(
                payload,
                "The proof request could not be completed.",
            ),
            response.status,
        );
    }
    return payload as T;
}

export function proofApiBase(
    receiptId: string,
    uploaderRole: ReceiptUploaderRole,
    publicId?: string,
) {
    if (uploaderRole === "payer") {
        if (!publicId) {
            throw new Error("Payer proof uploads require a portal id");
        }
        return `/api/public/payer-portals/${publicId}/receipts/${receiptId}/files`;
    }
    return `/api/acknowledgements/${receiptId}/files`;
}

export async function uploadProofFile({
    apiBase,
    file,
    expectedRevision,
    onProgress,
}: {
    apiBase: string;
    file: File;
    expectedRevision: number;
    onProgress?: (progress: number) => void;
}): Promise<ProofFinalizeResult> {
    const claim = {
        expectedRevision,
        originalFilename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
    };
    onProgress?.(10);
    const target = await proofRequest<ProofUploadTarget>(
        `${apiBase}/upload-url`,
        {
            method: "POST",
            body: JSON.stringify(claim),
        },
    );

    onProgress?.(45);
    const { error } = await supabase.storage
        .from(PROOF_BUCKET)
        .uploadToSignedUrl(target.path, target.token, file, {
            contentType: file.type,
            upsert: false,
        });
    if (error) {
        throw new ProofRequestError("The proof could not be uploaded.", 0);
    }

    onProgress?.(80);
    const result = await proofRequest<ProofFinalizeResult>(
        `${apiBase}/finalize`,
        {
            method: "POST",
            body: JSON.stringify({
                ...claim,
                path: target.path,
            }),
        },
    );
    onProgress?.(100);
    return result;
}

const validationMessage = (file: File): string | null => {
    if (!SUPPORTED_TYPES.has(file.type)) {
        return `${file.name}: choose a JPEG, PNG, or WebP image.`;
    }
    if (file.size < 1 || file.size > MAX_PROOF_SIZE_BYTES) {
        return `${file.name}: each image must be between 1 byte and 10 MiB.`;
    }
    return null;
};

export default function ProofUploader({
    receiptId,
    revisionNumber,
    proofs,
    uploaderRole,
    publicId,
    disabled = false,
    onChanged,
}: ProofUploaderProps) {
    const [staged, setStaged] = useState<StagedProof[]>([]);
    const [validationMessages, setValidationMessages] = useState<string[]>([]);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [mutationBusy, setMutationBusy] = useState(false);
    const previewUrls = useRef(new Map<string, string>());
    const nextStagedId = useRef(0);
    const revisionRef = useRef(revisionNumber);
    const mutationLock = useRef(false);

    useEffect(() => {
        revisionRef.current = revisionNumber;
    }, [revisionNumber]);

    useEffect(
        () => () => {
            for (const url of previewUrls.current.values()) {
                URL.revokeObjectURL(url);
            }
            previewUrls.current.clear();
        },
        [],
    );

    const activeProofs = useMemo(
        () => proofs.filter((proof) => proof.removedAt === null),
        [proofs],
    );
    const remainingSlots = Math.max(
        0,
        MAX_PROOFS - activeProofs.length - staged.length,
    );
    const selectionDisabled = disabled || remainingSlots === 0;
    const apiBase = useMemo(
        () => proofApiBase(receiptId, uploaderRole, publicId),
        [publicId, receiptId, uploaderRole],
    );

    const revokePreview = (id: string) => {
        const previewUrl = previewUrls.current.get(id);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrls.current.delete(id);
        }
    };

    const patchStaged = (id: string, patch: Partial<StagedProof>) => {
        setStaged((current) =>
            current.map((entry) =>
                entry.id === id ? { ...entry, ...patch } : entry,
            ),
        );
    };

    const runMutation = async <T,>(
        operation: () => Promise<T>,
    ): Promise<T | undefined> => {
        if (disabled || mutationLock.current) {
            return undefined;
        }
        mutationLock.current = true;
        setMutationBusy(true);
        try {
            return await operation();
        } finally {
            mutationLock.current = false;
            setMutationBusy(false);
        }
    };

    const notifyChanged = async (change: ProofChange, successLabel: string) => {
        try {
            await onChanged(change);
        } catch {
            setMutationError(
                `${successLabel}, but the receipt view could not refresh. Reload the receipt to see the latest revision.`,
            );
        }
    };

    const addFiles = (files: File[]) => {
        const messages: string[] = [];
        const valid: File[] = [];
        let available = remainingSlots;
        for (const file of files) {
            const message = validationMessage(file);
            if (message) {
                messages.push(message);
                continue;
            }
            if (available < 1) {
                messages.push(
                    `${file.name}: a receipt may have at most five active proof images.`,
                );
                continue;
            }
            available -= 1;
            valid.push(file);
        }
        if (messages.length > 0) {
            setValidationMessages((current) =>
                Array.from(new Set([...current, ...messages])),
            );
        }
        if (valid.length === 0) {
            return;
        }

        const additions = valid.map((file): StagedProof => {
            const id = `staged-proof-${nextStagedId.current++}`;
            const previewUrl = URL.createObjectURL(file);
            previewUrls.current.set(id, previewUrl);
            return {
                id,
                file,
                previewUrl,
                status: "ready",
                progress: 0,
                error: null,
            };
        });
        setStaged((current) => [...current, ...additions]);
    };

    const uploadOne = async (
        entry: StagedProof,
        expectedRevision: number,
    ): Promise<number | null> => {
        setMutationError(null);
        patchStaged(entry.id, {
            status: "requesting",
            progress: 5,
            error: null,
        });
        let result: ProofFinalizeResult;
        try {
            result = await uploadProofFile({
                apiBase,
                file: entry.file,
                expectedRevision,
                onProgress: (progress) =>
                    patchStaged(entry.id, {
                        status:
                            progress < 45
                                ? "requesting"
                                : progress < 80
                                  ? "uploading"
                                  : "finalizing",
                        progress,
                    }),
            });
        } catch (error) {
            const conflict =
                error instanceof ProofRequestError && error.status === 409;
            patchStaged(entry.id, {
                status: "error",
                progress: 0,
                error: conflict
                    ? "This receipt changed. Refresh it before retrying this proof."
                    : `${entry.file.name} could not be uploaded. Try again.`,
            });
            if (conflict) {
                await notifyChanged(
                    {
                        revisionNumber: revisionRef.current,
                        conflict: true,
                    },
                    "The receipt changed",
                );
            }
            return null;
        }

        revisionRef.current = result.revisionNumber;
        revokePreview(entry.id);
        setStaged((current) =>
            current.filter((candidate) => candidate.id !== entry.id),
        );
        await notifyChanged(
            {
                proof: result.proof,
                revisionNumber: result.revisionNumber,
            },
            "The proof was saved",
        );
        return result.revisionNumber;
    };

    const uploadAll = async () => {
        await runMutation(async () => {
            let expectedRevision = revisionRef.current;
            for (const entry of staged) {
                if (entry.status !== "ready" && entry.status !== "error") {
                    continue;
                }
                const nextRevision = await uploadOne(entry, expectedRevision);
                if (nextRevision === null) {
                    break;
                }
                expectedRevision = nextRevision;
            }
        });
    };

    const removeStaged = (id: string) => {
        revokePreview(id);
        setStaged((current) =>
            current.filter((entry) => entry.id !== id),
        );
    };

    const removeExisting = async (proof: ReceiptProof) => {
        await runMutation(async () => {
            setMutationError(null);
            setRemovingId(proof.id);
            let result: { revisionNumber: number };
            try {
                result = await proofRequest<{ revisionNumber: number }>(
                    `${apiBase}/${proof.id}`,
                    {
                        method: "DELETE",
                        body: JSON.stringify({
                            expectedRevision: revisionRef.current,
                        }),
                    },
                );
            } catch (error) {
                const conflict =
                    error instanceof ProofRequestError &&
                    error.status === 409;
                setMutationError(
                    conflict
                        ? "This receipt changed. Refresh the receipt before removing a proof."
                        : "The proof could not be removed. Try again.",
                );
                if (conflict) {
                    await notifyChanged(
                        {
                            revisionNumber: revisionRef.current,
                            conflict: true,
                        },
                        "The receipt changed",
                    );
                }
                return;
            } finally {
                setRemovingId(null);
            }

            revisionRef.current = result.revisionNumber;
            await notifyChanged(
                {
                    revisionNumber: result.revisionNumber,
                    removedFileId: proof.id,
                },
                "The proof was removed",
            );
        });
    };

    return (
        <section
            className="ledger-panel space-y-4"
            aria-labelledby="proof-uploader-title"
        >
            <div className="flex items-start gap-3">
                <FileImage
                    className="mt-0.5 h-5 w-5 text-sky-200"
                    aria-hidden="true"
                />
                <div>
                    <h2
                        id="proof-uploader-title"
                        className="text-lg font-semibold text-white"
                    >
                        Proof images
                    </h2>
                    <p className="text-sm text-slate-400">
                        {activeProofs.length} of 5 active. JPEG, PNG, or WebP;
                        10 MiB maximum each.
                    </p>
                </div>
            </div>

            {validationMessages.length > 0 ? (
                <div
                    className="rounded-lg border border-rose-800/60 bg-rose-950/30 p-3 text-sm text-rose-100"
                    role="alert"
                >
                    {validationMessages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </div>
            ) : null}
            {mutationError ? (
                <p
                    className="rounded-lg border border-rose-800/60 bg-rose-950/30 p-3 text-sm text-rose-100"
                    role="alert"
                >
                    {mutationError}
                </p>
            ) : null}

            {activeProofs.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                    {activeProofs.map((proof) => {
                        const canRemove =
                            !disabled &&
                            (uploaderRole === "receiver" ||
                                proof.uploaderRole === "payer");
                        return (
                            <li
                                key={proof.id}
                                className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                            >
                                {proof.downloadUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={proof.downloadUrl}
                                        alt=""
                                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                                    />
                                ) : (
                                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-white/5">
                                        <FileImage
                                            className="h-5 w-5 text-slate-400"
                                            aria-hidden="true"
                                        />
                                    </span>
                                )}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-white">
                                        {proof.originalFilename}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {(proof.sizeBytes / 1024 / 1024).toFixed(
                                            2,
                                        )}{" "}
                                        MiB
                                    </span>
                                </span>
                                {canRemove ? (
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm min-h-11 min-w-11"
                                        aria-label={`Remove ${proof.originalFilename}`}
                                        disabled={
                                            mutationBusy ||
                                            removingId === proof.id
                                        }
                                        onClick={() =>
                                            void removeExisting(proof)
                                        }
                                    >
                                        <Trash2
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                    </button>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            ) : null}

            {staged.length > 0 ? (
                <ul className="space-y-3" aria-label="Staged proof images">
                    {staged.map((entry) => (
                        <li
                            key={entry.id}
                            aria-label={entry.file.name}
                            className="flex items-center gap-3 rounded-xl border border-sky-900/60 bg-sky-950/20 p-3"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={entry.previewUrl}
                                alt=""
                                className="h-14 w-14 shrink-0 rounded-lg object-cover"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-white">
                                    {entry.file.name}
                                </p>
                                <progress
                                    className="progress progress-info mt-2 h-1.5 w-full"
                                    value={entry.progress}
                                    max={100}
                                    aria-label={`${entry.file.name} upload progress`}
                                />
                                {entry.error ? (
                                    <p
                                        className="mt-1 text-sm text-rose-200"
                                        role="alert"
                                    >
                                        {entry.error}
                                    </p>
                                ) : null}
                            </div>
                            {entry.status === "error" ? (
                                <button
                                    type="button"
                                    className="btn btn-outline btn-sm min-h-11"
                                    aria-label={`Retry ${entry.file.name}`}
                                    disabled={disabled || mutationBusy}
                                    onClick={() =>
                                        void runMutation(() =>
                                            uploadOne(
                                                entry,
                                                revisionRef.current,
                                            ),
                                        )
                                    }
                                >
                                    <RotateCcw
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    Retry
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm min-h-11 min-w-11"
                                aria-label={`Remove staged ${entry.file.name}`}
                                disabled={
                                    mutationBusy ||
                                    (entry.status !== "ready" &&
                                        entry.status !== "error")
                                }
                                onClick={() => removeStaged(entry.id)}
                            >
                                <Trash2
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="btn btn-outline min-h-11">
                    Choose images
                    <input
                        className="sr-only"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        aria-label="Choose proof images"
                        disabled={selectionDisabled || mutationBusy}
                        onChange={(event) => {
                            addFiles(Array.from(event.currentTarget.files ?? []));
                            event.currentTarget.value = "";
                        }}
                    />
                </label>
                {staged.length > 0 ? (
                    <button
                        type="button"
                        className="btn btn-info min-h-11"
                        disabled={disabled || mutationBusy}
                        onClick={() => void uploadAll()}
                    >
                        <Upload className="h-4 w-4" aria-hidden="true" />
                        Upload {staged.length} proof{" "}
                        {staged.length === 1 ? "image" : "images"}
                    </button>
                ) : null}
            </div>
        </section>
    );
}
