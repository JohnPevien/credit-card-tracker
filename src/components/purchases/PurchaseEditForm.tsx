import React, { useState } from "react";
import { DateInput, Textarea, Checkbox, Button } from "@/components/base";
import { Purchase } from "@/lib/supabase";

interface PurchaseEditFormData {
    description: string;
    purchase_date: string;
    is_bnpl: boolean;
}

interface PurchaseEditFormProps {
    purchase: Purchase;
    onSubmit: (data: PurchaseEditFormData) => Promise<void>;
    onCancel: () => void;
}

export default function PurchaseEditForm({
    purchase,
    onSubmit,
    onCancel,
}: PurchaseEditFormProps) {
    const [formData, setFormData] = useState<PurchaseEditFormData>({
        description: purchase.description,
        purchase_date: purchase.purchase_date,
        is_bnpl: purchase.is_bnpl,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    return (
        <form onSubmit={handleSubmit} data-component="PurchaseEditForm">
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
