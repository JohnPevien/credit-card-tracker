"use client";

import { useState } from "react";
import { AlertTriangle, FileText, Link2 } from "lucide-react";

import Button from "@/components/base/Button";
import type {
    CreateReceiptInput,
    ReceiptFormPerson,
} from "@/lib/acknowledgements/types";
import TransactionReferencePicker from "./TransactionReferencePicker";

export type ReceiptFormValue = Required<
    Pick<
        CreateReceiptInput,
        | "payerPersonId"
        | "receiverName"
        | "amount"
        | "currency"
        | "paymentDate"
        | "transactionIds"
    >
> &
    Pick<CreateReceiptInput, "notes">;

type ReceiptFormErrors = Partial<
    Record<"payerPersonId" | "receiverName" | "amount" | "paymentDate", string>
>;

type ReceiptFormProps = {
    persons: ReceiptFormPerson[];
    initialValue?: ReceiptFormValue;
    onSubmit: (value: ReceiptFormValue) => void | Promise<void>;
    onCancel?: () => void;
    submitLabel?: string;
    isSubmitting?: boolean;
    confirmationWarning?: "confirmed" | "completed" | null;
};

const emptyValue: ReceiptFormValue = {
    payerPersonId: "",
    receiverName: "",
    amount: 0,
    currency: "PHP",
    paymentDate: "",
    notes: null,
    transactionIds: [],
};

function validateReceipt(value: ReceiptFormValue): ReceiptFormErrors {
    const errors: ReceiptFormErrors = {};

    if (!value.payerPersonId) {
        errors.payerPersonId = "Choose the payer for this receipt.";
    }
    if (!value.receiverName.trim()) {
        errors.receiverName = "Enter the receiver name.";
    }
    if (!Number.isFinite(value.amount) || value.amount <= 0) {
        errors.amount = "Enter an amount greater than zero.";
    }
    if (!value.paymentDate) {
        errors.paymentDate = "Choose the payment date.";
    }

    return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
    return message ? (
        <p id={id} className="mt-1 text-sm text-rose-300" role="alert">
            {message}
        </p>
    ) : null;
}

export default function ReceiptForm({
    persons,
    initialValue,
    onSubmit,
    onCancel,
    submitLabel = "Save draft",
    isSubmitting = false,
    confirmationWarning = null,
}: ReceiptFormProps) {
    const [value, setValue] = useState<ReceiptFormValue>(() => ({
        ...emptyValue,
        ...initialValue,
        transactionIds: initialValue?.transactionIds ?? [],
    }));
    const [errors, setErrors] = useState<ReceiptFormErrors>({});

    function setField<Key extends keyof ReceiptFormValue>(
        field: Key,
        nextValue: ReceiptFormValue[Key],
    ) {
        setValue((current) => ({ ...current, [field]: nextValue }));
        if (field in errors) {
            setErrors((current) => ({ ...current, [field]: undefined }));
        }
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const nextValue = {
            ...value,
            receiverName: value.receiverName.trim(),
            currency: value.currency.toUpperCase(),
            notes: value.notes?.trim() || null,
        };
        const nextErrors = validateReceipt(nextValue);
        setErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        await onSubmit(nextValue);
    }

    return (
        <form
            className="space-y-7"
            onSubmit={handleSubmit}
            noValidate
            aria-busy={isSubmitting}
        >
            {confirmationWarning ? (
                <div
                    className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-4 text-amber-50"
                    role="note"
                >
                    <p className="flex items-start gap-2 font-semibold">
                        <AlertTriangle
                            className="mt-0.5 h-5 w-5 shrink-0"
                            aria-hidden="true"
                        />
                        Saving changes resets both confirmations for the current
                        revision.
                    </p>
                    {confirmationWarning === "completed" ? (
                        <p className="mt-2 pl-7 text-sm text-amber-100/80">
                            The completed revision remains in audit history.
                        </p>
                    ) : null}
                </div>
            ) : null}

            <section
                className="ledger-panel space-y-5"
                aria-labelledby="parties-title"
            >
                <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-300 text-black">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                        <h2
                            id="parties-title"
                            className="text-lg font-semibold text-white"
                        >
                            Parties and payment
                        </h2>
                        <p className="text-sm text-slate-400">
                            Select the payer; enter the receiver name manually.
                        </p>
                    </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                    <div>
                        <label
                            className="mb-2 block text-sm font-medium text-slate-200"
                            htmlFor="receipt-payer"
                        >
                            Payer
                        </label>
                        <select
                            id="receipt-payer"
                            className="select select-bordered w-full bg-black/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
                            value={value.payerPersonId}
                            onChange={(event) => {
                                setValue((current) => ({
                                    ...current,
                                    payerPersonId: event.target.value,
                                    transactionIds: [],
                                }));
                                setErrors((current) => ({
                                    ...current,
                                    payerPersonId: undefined,
                                }));
                            }}
                            aria-invalid={Boolean(errors.payerPersonId)}
                            aria-describedby={
                                errors.payerPersonId
                                    ? "receipt-payer-error"
                                    : undefined
                            }
                            disabled={isSubmitting}
                        >
                            <option value="">Choose a person</option>
                            {persons.map((person) => (
                                <option key={person.id} value={person.id}>
                                    {person.name}
                                </option>
                            ))}
                        </select>
                        <FieldError
                            id="receipt-payer-error"
                            message={errors.payerPersonId}
                        />
                    </div>

                    <div>
                        <label
                            className="mb-2 block text-sm font-medium text-slate-200"
                            htmlFor="receipt-receiver"
                        >
                            Receiver name
                        </label>
                        <input
                            id="receipt-receiver"
                            className="input input-bordered w-full bg-black/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
                            value={value.receiverName}
                            onChange={(event) =>
                                setField("receiverName", event.target.value)
                            }
                            maxLength={200}
                            autoComplete="name"
                            aria-invalid={Boolean(errors.receiverName)}
                            aria-describedby={
                                errors.receiverName
                                    ? "receipt-receiver-error"
                                    : undefined
                            }
                            disabled={isSubmitting}
                        />
                        <FieldError
                            id="receipt-receiver-error"
                            message={errors.receiverName}
                        />
                    </div>

                    <div>
                        <label
                            className="mb-2 block text-sm font-medium text-slate-200"
                            htmlFor="receipt-amount"
                        >
                            Amount received
                        </label>
                        <div className="join w-full">
                            <input
                                className="input input-bordered join-item w-24 bg-black/30 font-mono uppercase"
                                value={value.currency}
                                onChange={(event) =>
                                    setField("currency", event.target.value)
                                }
                                aria-label="Currency"
                                maxLength={3}
                                disabled={isSubmitting}
                            />
                            <input
                                id="receipt-amount"
                                className="input input-bordered join-item min-w-0 flex-1 bg-black/30 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300"
                                type="number"
                                inputMode="decimal"
                                min="0.01"
                                step="0.01"
                                value={value.amount || ""}
                                onChange={(event) =>
                                    setField(
                                        "amount",
                                        Number(event.target.value),
                                    )
                                }
                                aria-invalid={Boolean(errors.amount)}
                                aria-describedby={
                                    errors.amount
                                        ? "receipt-amount-error"
                                        : undefined
                                }
                                disabled={isSubmitting}
                            />
                        </div>
                        <FieldError
                            id="receipt-amount-error"
                            message={errors.amount}
                        />
                    </div>

                    <div>
                        <label
                            className="mb-2 block text-sm font-medium text-slate-200"
                            htmlFor="receipt-payment-date"
                        >
                            Payment date
                        </label>
                        <input
                            id="receipt-payment-date"
                            className="input input-bordered w-full bg-black/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
                            type="date"
                            value={value.paymentDate}
                            onChange={(event) =>
                                setField("paymentDate", event.target.value)
                            }
                            aria-invalid={Boolean(errors.paymentDate)}
                            aria-describedby={
                                errors.paymentDate
                                    ? "receipt-payment-date-error"
                                    : undefined
                            }
                            disabled={isSubmitting}
                        />
                        <FieldError
                            id="receipt-payment-date-error"
                            message={errors.paymentDate}
                        />
                    </div>
                </div>

                <div>
                    <label
                        className="mb-2 block text-sm font-medium text-slate-200"
                        htmlFor="receipt-notes"
                    >
                        Notes <span className="text-slate-500">(optional)</span>
                    </label>
                    <textarea
                        id="receipt-notes"
                        className="textarea textarea-bordered min-h-28 w-full bg-black/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
                        value={value.notes ?? ""}
                        onChange={(event) =>
                            setField("notes", event.target.value)
                        }
                        maxLength={5000}
                        disabled={isSubmitting}
                    />
                </div>
            </section>

            <section
                className="ledger-panel space-y-4"
                aria-labelledby="references-title"
            >
                <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5">
                        <Link2
                            className="h-4 w-4 text-amber-200"
                            aria-hidden="true"
                        />
                    </span>
                    <div>
                        <h2
                            id="references-title"
                            className="text-lg font-semibold text-white"
                        >
                            Transaction references
                        </h2>
                        <p className="text-sm text-slate-400">
                            Optional, many-to-many references for context.
                        </p>
                    </div>
                </div>
                <TransactionReferencePicker
                    payerPersonId={value.payerPersonId}
                    selectedIds={value.transactionIds}
                    onChange={(transactionIds) =>
                        setField("transactionIds", transactionIds)
                    }
                    disabled={isSubmitting}
                />
            </section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                {onCancel ? (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                ) : null}
                <Button
                    type="submit"
                    color="warning"
                    loading={isSubmitting}
                    className="min-w-36"
                >
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}
