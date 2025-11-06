"use client";

import { useEffect } from "react";
import { CreditCard, CreditCardInsert } from "@/lib/supabase";
import { useZodForm } from "@/lib/hooks/useZodForm";
import { refinedCreditCardSchema } from "@/lib/schemas";
import { FormSelect } from "@/components/FormSelect";
import { PHILIPPINE_BANKS, FORM_LABELS } from "@/lib/constants";

interface CreditCardFormProps {
    onSubmit: (data: CreditCardInsert) => void;
    onCancel: () => void;
    initialData: CreditCardInsert;
    principalCards: CreditCard[];
}

export default function CreditCardForm({
    onSubmit,
    onCancel,
    initialData,
    principalCards,
}: CreditCardFormProps) {
    const {
        values: formData,
        errors,
        handleChange,
        validate,
        reset,
    } = useZodForm(refinedCreditCardSchema, {
        ...initialData,
        principal_card_id: initialData.principal_card_id || "",
    });

    useEffect(() => {
        reset({
            ...initialData,
            principal_card_id: initialData.principal_card_id || "",
        });
    }, [initialData, reset]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isValid = validate();
        if (!isValid) return;

        const submitData = {
            ...formData,
            principal_card_id: formData.is_supplementary
                ? formData.principal_card_id
                : null,
        };
        onSubmit(submitData);
    };

    return (
        <form onSubmit={handleSubmit} data-component="CreditCardForm">
            <div className="mb-4">
                <label className="block mb-1">{FORM_LABELS.CARD_NAME}</label>
                <input
                    type="text"
                    name="credit_card_name"
                    value={formData.credit_card_name}
                    onChange={handleChange}
                    className="w-full p-2 border rounded"
                />
                {errors.credit_card_name && (
                    <p className="text-sm mt-1 text-error">
                        {errors.credit_card_name}
                    </p>
                )}
            </div>

            <div className="mb-4">
                <label className="block mb-1">
                    {FORM_LABELS.LAST_FOUR_DIGITS}
                </label>
                <input
                    type="text"
                    name="last_four_digits"
                    value={formData.last_four_digits}
                    onChange={handleChange}
                    className="w-full p-2 border rounded"
                    maxLength={4}
                />
                {errors.last_four_digits && (
                    <p className="text-sm mt-1 text-error">
                        {errors.last_four_digits}
                    </p>
                )}
            </div>

            <div className="mb-4">
                <label className="block mb-1">
                    {FORM_LABELS.CARDHOLDER_NAME}
                </label>
                <input
                    type="text"
                    name="cardholder_name"
                    value={formData.cardholder_name}
                    onChange={handleChange}
                    className="w-full p-2 border rounded"
                />
                {errors.cardholder_name && (
                    <p className="text-sm mt-1 text-error">
                        {errors.cardholder_name}
                    </p>
                )}
            </div>

            <div className="mb-4">
                <label className="block mb-1">{FORM_LABELS.ISSUER}</label>
                <FormSelect
                    name="issuer"
                    value={formData.issuer}
                    onChange={handleChange}
                    options={PHILIPPINE_BANKS.map((bank) => ({
                        value: bank,
                        label: bank,
                    }))}
                    placeholder="Select issuer"
                    className="w-full"
                />
                {errors.issuer && (
                    <p className="text-sm mt-1 text-error">{errors.issuer}</p>
                )}
            </div>

            <div className="mb-4">
                <label className="flex items-center">
                    <input
                        type="checkbox"
                        name="is_supplementary"
                        checked={formData.is_supplementary}
                        onChange={handleChange}
                        className="mr-2"
                    />
                    {FORM_LABELS.SUPPLEMENTARY_CARD}
                </label>
            </div>

            {formData.is_supplementary && (
                <div className="mb-4">
                    <label className="block mb-1">
                        {FORM_LABELS.PRINCIPAL_CARD}
                    </label>
                    <FormSelect
                        name="principal_card_id"
                        value={formData.principal_card_id}
                        onChange={handleChange}
                        options={principalCards.map((card) => ({
                            value: card.id,
                            label: `${card.credit_card_name} (${card.last_four_digits})`,
                        }))}
                        placeholder="Select principal card"
                        className="w-full"
                    />
                    {errors.principal_card_id && (
                        <p className="text-sm mt-1 text-error">
                            {errors.principal_card_id}
                        </p>
                    )}
                </div>
            )}

            <div className="flex justify-end space-x-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="btn btn-secondary"
                >
                    Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                    Save
                </button>
            </div>
        </form>
    );
}
