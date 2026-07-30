"use client";

import { useState } from "react";
import {
    Ban,
    Check,
    Copy,
    KeyRound,
    Link2,
    RefreshCw,
    RotateCw,
} from "lucide-react";

import Button from "@/components/base/Button";
import { formatReceiptDateTime } from "@/lib/acknowledgements/format";
import type {
    PayerPortalAdminView,
    PayerPortalCredentialResult,
    PortalAdminAction,
} from "@/lib/acknowledgements/types";

type PortalAccessCardProps = {
    portal: PayerPortalAdminView | null;
    transientPin: string | null;
    onAction: (
        action: PortalAdminAction,
    ) => Promise<PayerPortalCredentialResult> | PayerPortalCredentialResult;
    onResult?: (result: PayerPortalCredentialResult) => void;
};

export default function PortalAccessCard({
    portal,
    transientPin,
    onAction,
    onResult,
}: PortalAccessCardProps) {
    const [pendingAction, setPendingAction] = useState<
        PortalAdminAction["type"] | null
    >(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const portalUrl = portal
        ? `${typeof window === "undefined" ? "" : window.location.origin}/payer/${portal.publicId}`
        : null;

    async function runAction(action: PortalAdminAction) {
        setPendingAction(action.type);
        setError(null);
        setMessage(null);
        try {
            const result = await onAction(action);
            onResult?.(result);
            setMessage(
                action.type === "generate-pin"
                    ? "Payer portal created. Copy the link and one-time PIN now."
                    : action.type === "reset-pin"
                      ? "PIN reset. Copy the new one-time PIN now."
                      : action.type === "rotate-link"
                        ? "Portal link rotated. The previous link no longer works."
                        : action.type === "revoke"
                          ? "Portal access revoked."
                          : "Portal access reactivated.",
            );
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Portal access could not be changed.",
            );
        } finally {
            setPendingAction(null);
        }
    }

    async function copyValue(value: string, label: string) {
        try {
            await navigator.clipboard.writeText(value);
            setError(null);
            setMessage(`${label} copied.`);
        } catch {
            setError(
                `Could not copy ${label.toLowerCase()}. Select it manually.`,
            );
        }
    }

    return (
        <section
            className="ledger-panel space-y-4"
            aria-labelledby="portal-title"
        >
            <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-300 text-black">
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                    <h2
                        id="portal-title"
                        className="text-lg font-semibold text-white"
                    >
                        Payer portal access
                    </h2>
                    <p className="text-sm text-slate-400">
                        One reusable link for all published receipts for this
                        payer.
                    </p>
                </div>
            </div>

            {message ? (
                <p
                    className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100"
                    role="status"
                >
                    {message}
                </p>
            ) : null}
            {error ? (
                <p
                    className="rounded-lg border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-100"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}

            {!portal ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-5">
                    <p className="text-sm text-slate-300">
                        No portal credential exists for this payer.
                    </p>
                    <Button
                        type="button"
                        color="info"
                        className="mt-3"
                        loading={pendingAction === "generate-pin"}
                        onClick={() => runAction({ type: "generate-pin" })}
                    >
                        Generate portal and PIN
                    </Button>
                </div>
            ) : (
                <>
                    <div className="space-y-2">
                        <label
                            className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                            htmlFor="payer-portal-url"
                        >
                            Payer portal link
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                id="payer-portal-url"
                                className="input input-bordered min-w-0 flex-1 bg-black/30 font-mono text-sm"
                                readOnly
                                value={portalUrl ?? ""}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    portalUrl
                                        ? copyValue(portalUrl, "Portal link")
                                        : undefined
                                }
                            >
                                <Copy className="h-4 w-4" aria-hidden="true" />
                                Copy link
                            </Button>
                        </div>
                    </div>

                    {transientPin ? (
                        <div className="rounded-xl border border-amber-400/50 bg-amber-950/40 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                                One-time PIN — shown once
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <output
                                    className="font-mono text-3xl tracking-[0.28em] text-white"
                                    aria-label="One-time payer PIN"
                                >
                                    {transientPin}
                                </output>
                                <Button
                                    type="button"
                                    color="warning"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        copyValue(transientPin, "PIN")
                                    }
                                >
                                    <Copy
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    Copy PIN
                                </Button>
                            </div>
                            <p className="mt-2 text-sm text-amber-100/70">
                                Store or share it now. The app does not save a
                                recoverable copy.
                            </p>
                        </div>
                    ) : (
                        <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-400">
                            The existing PIN cannot be recovered. Reset it to
                            create a new one-time PIN.
                        </p>
                    )}

                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-slate-500">Access state</dt>
                            <dd className="mt-1 flex items-center gap-1.5 text-slate-100">
                                {portal.revokedAt ? (
                                    <>
                                        <Ban
                                            className="h-4 w-4 text-rose-300"
                                            aria-hidden="true"
                                        />
                                        Revoked
                                    </>
                                ) : (
                                    <>
                                        <Check
                                            className="h-4 w-4 text-emerald-300"
                                            aria-hidden="true"
                                        />
                                        Active
                                    </>
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Last accessed</dt>
                            <dd className="mt-1 text-slate-100">
                                {portal.lastAccessedAt
                                    ? formatReceiptDateTime(
                                          portal.lastAccessedAt,
                                      )
                                    : "Never"}
                            </dd>
                        </div>
                    </dl>

                    <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            loading={pendingAction === "reset-pin"}
                            onClick={() => runAction({ type: "reset-pin" })}
                        >
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            Reset PIN
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            loading={pendingAction === "rotate-link"}
                            onClick={() => runAction({ type: "rotate-link" })}
                        >
                            <RotateCw className="h-4 w-4" aria-hidden="true" />
                            Rotate link
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            color={portal.revokedAt ? "success" : "error"}
                            variant="outline"
                            loading={
                                pendingAction ===
                                (portal.revokedAt ? "reactivate" : "revoke")
                            }
                            onClick={() =>
                                runAction({
                                    type: portal.revokedAt
                                        ? "reactivate"
                                        : "revoke",
                                })
                            }
                        >
                            {portal.revokedAt ? (
                                <Link2 className="h-4 w-4" aria-hidden="true" />
                            ) : (
                                <Ban className="h-4 w-4" aria-hidden="true" />
                            )}
                            {portal.revokedAt ? "Reactivate" : "Revoke"}
                        </Button>
                    </div>
                </>
            )}
        </section>
    );
}
