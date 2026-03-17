import React, { useState } from "react";
import {
    Select,
    DateInput,
    Input,
    Textarea,
    Checkbox,
    Button,
} from "@/components/base";
import { Purchase, CreditCard, Person } from "@/lib/supabase";

interface PurchaseEditFormData {
    credit_card_id: string;
    person_id: string;
    description: string;
    purchase_date: string;
    billing_start_date: string;
    total_amount: number;
    num_installments: number;
    is_bnpl: boolean;
}

interface PurchaseEditFormProps {
    purchase: Purchase;
    creditCards: CreditCard[];
    persons: Person[];
    onSubmit: (data: PurchaseEditFormData) => Promise<void>;
    onCancel: () => void;
}

export default function PurchaseEditForm({
    purchase,
    creditCards,
    persons,
    onSubmit,
    onCancel,
}: PurchaseEditFormProps) {
    const [formData, setFormData] = useState<PurchaseEditFormData>({
        credit_card_id: purchase.credit_card_id,
        person_id: purchase.person_id,
        description: purchase.description,
        purchase_date: purchase.purchase_date,
        billing_start_date: purchase.billing_start_date || "",
        total_amount: purchase.total_amount,
        num_installments: purchase.num_installments,
        is_bnpl: purchase.is_bnpl,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleInputChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
    ) => {
        const { name, value, type } = e.target as HTMLInputElement;

        if (type === "checkbox") {
            const checkbox = e.target as HTMLInputElement;
            setFormData((prev) => ({
                ...prev,
                [name]: checkbox.checked,
            }));
        } else if (type === "number") {
            if (name === "num_installments") {
                const parsed = Number.parseInt(value, 10);
                setFormData((prev) => ({
                    ...prev,
                    [name]: Number.isNaN(parsed) ? 1 : Math.max(1, parsed),
                }));
                return;
            }
            setFormData((prev) => ({
                ...prev,
                [name]: parseFloat(value) || 0,
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onSubmit(formData);
        } catch (error) {
            console.error("Error submitting form:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCreditCardLabel = (card: CreditCard): string => {
        return `${card.credit_card_name || card.issuer} **** ${card.last_four_digits}${
            card.is_supplementary ? " (Supplementary)" : ""
        }`;
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
        <form onSubmit={handleSubmit} data-component="PurchaseEditForm">
            <div className="form-control mb-4">
                <div className="label">
                    <span className="label-text">Credit Card</span>
                </div>
                <Select
                    name="credit_card_id"
                    value={formData.credit_card_id}
                    onChange={(value) =>
                        handleSelectChange("credit_card_id", value)
                    }
                    options={creditCardOptions}
                    required
                    disabled={isSubmitting}
                />
            </div>

            <div className="form-control mb-4">
                <div className="label">
                    <span className="label-text">Person</span>
                </div>
                <Select
                    name="person_id"
                    value={formData.person_id}
                    onChange={(value) => handleSelectChange("person_id", value)}
                    options={personOptions}
                    required
                    disabled={isSubmitting}
                />
            </div>

            <div className="form-control mb-4">
                <Textarea
                    label="Description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                />
            </div>

            <div className="form-control mb-4">
                <div className="label">
                    <span className="label-text">Purchase Date</span>
                </div>
                <DateInput
                    name="purchase_date"
                    value={formData.purchase_date}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                />
            </div>

            <div className="form-control mb-4">
                <Input
                    label="Total Amount"
                    name="total_amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.total_amount}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                />
            </div>

            <div className="form-control mb-4">
                <Input
                    label="Number of Installments"
                    name="num_installments"
                    type="number"
                    min="1"
                    value={formData.num_installments}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                />
            </div>

            <div className="form-control mb-4">
                <div className="label">
                    <span className="label-text">Billing Start Date</span>
                </div>
                <DateInput
                    name="billing_start_date"
                    value={formData.billing_start_date}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                />
            </div>

            <div className="form-control mb-4">
                <Checkbox
                    label="Buy Now Pay Later (BNPL)"
                    name="is_bnpl"
                    checked={formData.is_bnpl}
                    onChange={handleInputChange}
                    labelPosition="right"
                    disabled={isSubmitting}
                />
            </div>

            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    onClick={onCancel}
                    color="secondary"
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button type="submit" color="primary" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
            </div>
        </form>
    );
}
