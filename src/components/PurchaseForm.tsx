import React, { useState, useEffect } from "react";
import {
    Select,
    DateInput,
    Input,
    Textarea,
    Checkbox,
    Button,
} from "@/components/base";
import { CreditCard, Person } from "@/lib/supabase";

interface PurchaseFormData {
    credit_card_id: string;
    person_id: string;
    purchase_date: string;
    billing_start_date: string;
    total_amount: string;
    description: string;
    num_installments: string;
    is_bnpl: boolean;
}

interface PurchaseFormProps {
    creditCards: CreditCard[];
    persons: Person[];
    onSubmit: (formData: {
        credit_card_id: string;
        person_id: string;
        purchase_date: string;
        billing_start_date: string;
        total_amount: number;
        description: string;
        num_installments: number;
        is_bnpl: boolean;
    }) => Promise<void>;
    onCancel: () => void;
}

export default function PurchaseForm({
    creditCards,
    persons,
    onSubmit,
    onCancel,
}: PurchaseFormProps) {
    const [formData, setFormData] = useState<PurchaseFormData>({
        credit_card_id: "",
        person_id: "",
        purchase_date: "",
        billing_start_date: "",
        total_amount: "",
        description: "",
        num_installments: "1",
        is_bnpl: false,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Initialize form with default values when data is available
        if (creditCards.length > 0 && persons.length > 0) {
            const today = new Date().toISOString().split("T")[0];
            const billingDate = today;

            setFormData({
                credit_card_id: creditCards[0].id,
                person_id: persons[0].id,
                purchase_date: today,
                billing_start_date: billingDate,
                total_amount: "",
                description: "",
                num_installments: "1",
                is_bnpl: false,
            });
        }
    }, [creditCards, persons]);

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
        } else {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        }
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const parsedAmount = Number.parseFloat(formData.total_amount);
            const parsedInstallments = Number.parseInt(
                formData.num_installments,
                10,
            );
            const submitData = {
                ...formData,
                total_amount: Number.isNaN(parsedAmount) ? 0 : parsedAmount,
                num_installments: Number.isNaN(parsedInstallments)
                    ? 1
                    : Math.max(1, parsedInstallments),
            };

            await onSubmit(submitData);
        } catch (error) {
            console.error("Error submitting form:", error);
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
        <form onSubmit={handleSubmit} data-component="PurchaseForm">
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
                <div className="label">
                    <span className="label-text">Date</span>
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
                    type="number"
                    name="total_amount"
                    value={formData.total_amount}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
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
                <Input
                    label="Number of Installments"
                    type="number"
                    name="num_installments"
                    value={formData.num_installments}
                    onChange={handleInputChange}
                    min="1"
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
                    {isSubmitting ? "Saving..." : "Save"}
                </Button>
            </div>
        </form>
    );
}
