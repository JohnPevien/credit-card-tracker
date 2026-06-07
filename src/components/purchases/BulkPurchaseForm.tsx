import React, { useState, useEffect } from "react";
import { Select, DateInput, Button } from "@/components/base";
import { CreditCard, Person } from "@/lib/supabase";
import { Trash2, Copy, Plus, RotateCcw } from "lucide-react";

interface BulkRow {
    id: string;
    description: string;
    total_amount: string;
    num_installments: string;
    credit_card_id: string;
    person_id: string;
    purchase_date: string;
    billing_start_date: string;
    is_bnpl: boolean;
}

interface BulkPurchaseFormProps {
    creditCards: CreditCard[];
    persons: Person[];
    onSubmit: (purchases: Array<{
        credit_card_id: string;
        person_id: string;
        purchase_date: string;
        billing_start_date: string;
        total_amount: number;
        description: string;
        num_installments: number;
        is_bnpl: boolean;
    }>) => Promise<void>;
    onCancel: () => void;
}

export default function BulkPurchaseForm({
    creditCards,
    persons,
    onSubmit,
    onCancel,
}: BulkPurchaseFormProps) {
    // Top-level defaults
    const [defaultCard, setDefaultCard] = useState("");
    const [defaultPerson, setDefaultPerson] = useState("");
    const [defaultPurchaseDate, setDefaultPurchaseDate] = useState("");
    const [defaultBillingDate, setDefaultBillingDate] = useState("");

    // Form submission/loading state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Grid rows state
    const [rows, setRows] = useState<BulkRow[]>([]);

    // Initialize defaults and the initial empty row on component mount / metadata load
    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];
        const initialCard = creditCards.length > 0 ? creditCards[0].id : "";
        const initialPerson = persons.length > 0 ? persons[0].id : "";

        setDefaultCard((prev) => prev || initialCard);
        setDefaultPerson((prev) => prev || initialPerson);
        setDefaultPurchaseDate((prev) => prev || today);
        setDefaultBillingDate((prev) => prev || today);

        setRows((prev) => {
            if (prev.length > 0) {
                // Propagate loaded defaults to empty row values
                return prev.map((row) => ({
                    ...row,
                    credit_card_id: row.credit_card_id || initialCard,
                    person_id: row.person_id || initialPerson,
                    purchase_date: row.purchase_date || today,
                    billing_start_date: row.billing_start_date || today,
                }));
            }
            return [
                {
                    id: Math.random().toString(36).substring(2, 9),
                    description: "",
                    total_amount: "",
                    num_installments: "1",
                    credit_card_id: initialCard,
                    person_id: initialPerson,
                    purchase_date: today,
                    billing_start_date: today,
                    is_bnpl: false,
                },
            ];
        });
    }, [creditCards, persons]);

    const createNewRow = (overrides?: Partial<BulkRow>): BulkRow => {
        return {
            id: Math.random().toString(36).substring(2, 9),
            description: "",
            total_amount: "",
            num_installments: "1",
            credit_card_id: overrides?.credit_card_id || defaultCard,
            person_id: overrides?.person_id || defaultPerson,
            purchase_date: overrides?.purchase_date || defaultPurchaseDate,
            billing_start_date: overrides?.billing_start_date || defaultBillingDate,
            is_bnpl: overrides?.is_bnpl ?? false,
            ...overrides,
        };
    };

    const handleAddRow = () => {
        setRows((prev) => [...prev, createNewRow()]);
    };

    const handleDuplicateRow = (row: BulkRow) => {
        const duplicated = createNewRow({
            ...row,
            id: Math.random().toString(36).substring(2, 9), // ensure new ID
        });
        setRows((prev) => [...prev, duplicated]);
    };

    const handleRemoveRow = (id: string) => {
        if (rows.length === 1) {
            // Keep at least one row, just reset it
            setRows([createNewRow()]);
        } else {
            setRows((prev) => prev.filter((r) => r.id !== id));
        }
    };

    const handleRowChange = (id: string, field: keyof BulkRow, value: string | number | boolean) => {
        setRows((prev) =>
            prev.map((row) => {
                if (row.id === id) {
                    const updated = { ...row, [field]: value };
                    
                    // If purchase date changes, we might want billing date to follow it by default (if not manually set differently)
                    if (field === "purchase_date" && row.billing_start_date === row.purchase_date) {
                        updated.billing_start_date = value as string;
                    }
                    
                    return updated;
                }
                return row;
            })
        );
    };

    // Update all rows to match top-level defaults if they match previous defaults
    const handleDefaultCardChange = (cardId: string) => {
        const prevDefault = defaultCard;
        setDefaultCard(cardId);
        setRows((prev) =>
            prev.map((row) =>
                row.credit_card_id === prevDefault ? { ...row, credit_card_id: cardId } : row
            )
        );
    };

    const handleDefaultPersonChange = (personId: string) => {
        const prevDefault = defaultPerson;
        setDefaultPerson(personId);
        setRows((prev) =>
            prev.map((row) =>
                row.person_id === prevDefault ? { ...row, person_id: personId } : row
            )
        );
    };

    const handleDefaultPurchaseDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value;
        const prevDefault = defaultPurchaseDate;
        setDefaultPurchaseDate(date);
        
        // Also sync default billing date if it was matching purchase date
        const shouldSyncBilling = defaultBillingDate === prevDefault;
        if (shouldSyncBilling) {
            setDefaultBillingDate(date);
        }

        setRows((prev) =>
            prev.map((row) => {
                const updated = { ...row };
                if (row.purchase_date === prevDefault) {
                    updated.purchase_date = date;
                }
                if (shouldSyncBilling && row.billing_start_date === prevDefault) {
                    updated.billing_start_date = date;
                }
                return updated;
            })
        );
    };

    const handleDefaultBillingDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value;
        const prevDefault = defaultBillingDate;
        setDefaultBillingDate(date);
        setRows((prev) =>
            prev.map((row) =>
                row.billing_start_date === prevDefault ? { ...row, billing_start_date: date } : row
            )
        );
    };

    const handleReset = () => {
        if (window.confirm("Are you sure you want to clear all rows?")) {
            setRows([createNewRow()]);
            setValidationErrors([]);
        }
    };

    const validateForm = (): boolean => {
        const errors: string[] = [];
        rows.forEach((row, index) => {
            const rowNum = index + 1;
            if (!row.description.trim()) {
                errors.push(`Row ${rowNum}: Description is required`);
            }
            if (!row.credit_card_id) {
                errors.push(`Row ${rowNum}: Credit Card is required`);
            }
            if (!row.person_id) {
                errors.push(`Row ${rowNum}: Person is required`);
            }
            const amount = parseFloat(row.total_amount);
            if (isNaN(amount) || amount <= 0) {
                errors.push(`Row ${rowNum}: Total Amount must be a positive number`);
            }
            const installments = parseInt(row.num_installments, 10);
            if (isNaN(installments) || installments < 1) {
                errors.push(`Row ${rowNum}: Installments must be at least 1`);
            }
            if (!row.purchase_date) {
                errors.push(`Row ${rowNum}: Purchase Date is required`);
            }
            if (!row.billing_start_date) {
                errors.push(`Row ${rowNum}: Billing Start Date is required`);
            }
        });
        setValidationErrors(errors);
        return errors.length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!validateForm()) return;

        setIsSubmitting(true);
        try {
            const formattedData = rows.map((row) => ({
                credit_card_id: row.credit_card_id,
                person_id: row.person_id,
                purchase_date: row.purchase_date,
                billing_start_date: row.billing_start_date,
                total_amount: parseFloat(row.total_amount),
                description: row.description.trim(),
                num_installments: parseInt(row.num_installments, 10),
                is_bnpl: row.is_bnpl,
            }));
            await onSubmit(formattedData);
        } catch (error) {
            console.error("Failed to submit bulk purchases:", error);
            setValidationErrors([
                error instanceof Error ? error.message : "An unexpected database error occurred.",
            ]);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCreditCardLabel = (card: CreditCard): string => {
        return `${card.credit_card_name || card.issuer} **** ${
            card.last_four_digits
        }${card.is_supplementary ? " (Supplementary)" : ""}`;
    };

    const creditCardOptions = creditCards.map((card) => ({
        value: card.id,
        label: formatCreditCardLabel(card),
    }));

    const personOptions = persons.map((person) => ({
        value: person.id,
        label: person.name,
    }));

    return (
        <form onSubmit={handleSubmit} data-component="BulkPurchaseForm" className="space-y-6" noValidate>
            {/* Batch Defaults Card */}
            <div className="card bg-gray-900 border border-gray-800 shadow-xl p-4 rounded-xl">
                <h2 className="text-lg font-semibold mb-3 text-primary flex items-center gap-2">
                    Batch Defaults
                    <span className="text-xs font-normal text-gray-400">
                        (Sets default values for new rows and cascades to unchanged existing rows)
                    </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="form-control">
                        <span className="label-text mb-1">Default Credit Card</span>
                        <Select
                            name="default_card"
                            value={defaultCard}
                            onChange={handleDefaultCardChange}
                            options={creditCardOptions}
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="form-control">
                        <span className="label-text mb-1">Default Person</span>
                        <Select
                            name="default_person"
                            value={defaultPerson}
                            onChange={handleDefaultPersonChange}
                            options={personOptions}
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="form-control">
                        <span className="label-text mb-1">Default Purchase Date</span>
                        <DateInput
                            name="default_purchase_date"
                            value={defaultPurchaseDate}
                            onChange={handleDefaultPurchaseDateChange}
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="form-control">
                        <span className="label-text mb-1">Default Billing Start Date</span>
                        <DateInput
                            name="default_billing_date"
                            value={defaultBillingDate}
                            onChange={handleDefaultBillingDateChange}
                            disabled={isSubmitting}
                        />
                    </div>
                </div>
            </div>

            {/* Error alerts */}
            {validationErrors.length > 0 && (
                <div className="alert alert-error bg-red-950 border border-red-800 text-red-200 p-4 rounded-xl space-y-1">
                    <div className="font-semibold text-sm">Please correct the following errors:</div>
                    <ul className="list-disc pl-5 text-xs space-y-0.5">
                        {validationErrors.slice(0, 5).map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                        {validationErrors.length > 5 && (
                            <li>...and {validationErrors.length - 5} more errors.</li>
                        )}
                    </ul>
                </div>
            )}

            {/* Multi-Row Spreadsheet Table */}
            <div className="overflow-x-auto border border-gray-800 rounded-xl bg-gray-950 shadow-inner">
                <table className="table table-compact w-full text-left border-collapse min-w-[1200px]">
                    <thead>
                        <tr className="bg-gray-900 border-b border-gray-800 text-gray-400 text-xs uppercase">
                            <th className="p-3 w-8">#</th>
                            <th className="p-3 w-1/4">Description</th>
                            <th className="p-3 w-32">Total Amount</th>
                            <th className="p-3 w-24">Installments</th>
                            <th className="p-3 w-48">Credit Card</th>
                            <th className="p-3 w-40">Person</th>
                            <th className="p-3 w-40">Purchase Date</th>
                            <th className="p-3 w-40">Billing Start Date</th>
                            <th className="p-3 w-20 text-center">BNPL</th>
                            <th className="p-3 w-24 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {rows.map((row, index) => {
                            const hasLocalDescError = validationErrors.some(e => e.includes(`Row ${index + 1}: Description`));
                            const hasLocalAmountError = validationErrors.some(e => e.includes(`Row ${index + 1}: Total Amount`));
                            const hasLocalInstError = validationErrors.some(e => e.includes(`Row ${index + 1}: Installments`));
                            
                            return (
                                <tr key={row.id} className="hover:bg-gray-900/50 transition-colors">
                                    <td className="p-3 text-center text-sm font-medium text-gray-500">
                                        {index + 1}
                                    </td>
                                    {/* Description */}
                                    <td className="p-2">
                                        <input
                                            type="text"
                                            className={`input input-bordered input-sm w-full bg-gray-900 border-gray-800 focus:border-primary focus:ring-1 focus:ring-primary ${
                                                hasLocalDescError ? "border-red-600 focus:border-red-600 focus:ring-red-600" : ""
                                            }`}
                                            placeholder="MacBook Pro, Groceries, etc."
                                            value={row.description}
                                            onChange={(e) => handleRowChange(row.id, "description", e.target.value)}
                                            required
                                            disabled={isSubmitting}
                                        />
                                    </td>
                                    {/* Total Amount */}
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            className={`input input-bordered input-sm w-full bg-gray-900 border-gray-800 focus:border-primary focus:ring-1 focus:ring-primary ${
                                                hasLocalAmountError ? "border-red-600 focus:border-red-600 focus:ring-red-600" : ""
                                            }`}
                                            placeholder="0.00"
                                            value={row.total_amount}
                                            onChange={(e) => handleRowChange(row.id, "total_amount", e.target.value)}
                                            required
                                            disabled={isSubmitting}
                                        />
                                    </td>
                                    {/* Installments */}
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            min="1"
                                            className={`input input-bordered input-sm w-full bg-gray-900 border-gray-800 focus:border-primary focus:ring-1 focus:ring-primary ${
                                                hasLocalInstError ? "border-red-600 focus:border-red-600 focus:ring-red-600" : ""
                                            }`}
                                            value={row.num_installments}
                                            onChange={(e) => handleRowChange(row.id, "num_installments", e.target.value)}
                                            required
                                            disabled={isSubmitting}
                                        />
                                    </td>
                                    {/* Credit Card */}
                                    <td className="p-2">
                                        <Select
                                            name={`card-${row.id}`}
                                            value={row.credit_card_id}
                                            onChange={(val) => handleRowChange(row.id, "credit_card_id", val)}
                                            options={creditCardOptions}
                                            disabled={isSubmitting}
                                        />
                                    </td>
                                    {/* Person */}
                                    <td className="p-2">
                                        <Select
                                            name={`person-${row.id}`}
                                            value={row.person_id}
                                            onChange={(val) => handleRowChange(row.id, "person_id", val)}
                                            options={personOptions}
                                            disabled={isSubmitting}
                                        />
                                    </td>
                                    {/* Purchase Date */}
                                    <td className="p-2">
                                        <DateInput
                                            name={`purchase-date-${row.id}`}
                                            value={row.purchase_date}
                                            onChange={(e) => handleRowChange(row.id, "purchase_date", e.target.value)}
                                            disabled={isSubmitting}
                                        />
                                    </td>
                                    {/* Billing Start Date */}
                                    <td className="p-2">
                                        <DateInput
                                            name={`billing-date-${row.id}`}
                                            value={row.billing_start_date}
                                            onChange={(e) => handleRowChange(row.id, "billing_start_date", e.target.value)}
                                            disabled={isSubmitting}
                                        />
                                    </td>
                                    {/* BNPL */}
                                    <td className="p-2 text-center">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-primary checkbox-sm bg-gray-900 border-gray-800"
                                            checked={row.is_bnpl}
                                            onChange={(e) => handleRowChange(row.id, "is_bnpl", e.target.checked)}
                                            disabled={isSubmitting}
                                        />
                                    </td>
                                    {/* Action buttons */}
                                    <td className="p-2 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                type="button"
                                                title="Duplicate Row"
                                                onClick={() => handleDuplicateRow(row)}
                                                className="btn btn-ghost btn-xs text-info hover:bg-info/10 p-1"
                                                disabled={isSubmitting}
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                title="Remove Row"
                                                onClick={() => handleRemoveRow(row.id)}
                                                className="btn btn-ghost btn-xs text-error hover:bg-error/10 p-1"
                                                disabled={isSubmitting}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex gap-2">
                    <Button
                        type="button"
                        onClick={handleAddRow}
                        color="secondary"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 btn-sm"
                    >
                        <Plus className="w-4 h-4" /> Add Row
                    </Button>
                    <Button
                        type="button"
                        onClick={handleReset}
                        color="secondary"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 btn-sm text-yellow-500 hover:bg-yellow-500/10"
                    >
                        <RotateCcw className="w-4 h-4" /> Clear All
                    </Button>
                </div>

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <Button
                        type="button"
                        onClick={onCancel}
                        color="secondary"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        color="primary"
                        disabled={isSubmitting}
                        className="min-w-[120px]"
                    >
                        {isSubmitting ? "Saving Bulk..." : `Save ${rows.length} Purchase${rows.length > 1 ? "s" : ""}`}
                    </Button>
                </div>
            </div>
        </form>
    );
}
