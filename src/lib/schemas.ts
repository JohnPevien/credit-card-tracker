import { z } from "zod";

// Credit Card Schema
export const creditCardSchema = z.object({
    credit_card_name: z.string().min(1, "Card name is required"),
    last_four_digits: z
        .string()
        .length(4, "Must be exactly 4 digits")
        .regex(/^\d{4}$/, "Must contain only digits"),
    cardholder_name: z.string().min(1, "Cardholder name is required"),
    issuer: z.string().min(1, "Issuer is required"),
    is_supplementary: z.boolean(),
    principal_card_id: z.string().optional().default(""),
});

// Refined Credit Card Schema (with conditional validation)
export const refinedCreditCardSchema = creditCardSchema.refine(
    (data) =>
        !data.is_supplementary ||
        (data.principal_card_id && data.principal_card_id.length > 0),
    {
        message: "Principal card is required for supplementary cards",
        path: ["principal_card_id"],
    },
);

// Person Schema
export const personSchema = z.object({
    name: z.string().min(1, "Name is required"),
});

// Purchase Schema
export const purchaseSchema = z.object({
    credit_card_id: z.string().min(1, "Credit card is required"),
    person_id: z.string().min(1, "Person is required"),
    purchase_date: z.string().min(1, "Purchase date is required"),
    total_amount: z.number().positive("Amount must be positive"),
    description: z.string().min(1, "Description is required"),
    num_installments: z
        .number()
        .int()
        .min(1, "Number of installments must be at least 1"),
    is_bnpl: z.boolean(),
});

// Transaction Schema
export const transactionSchema = z.object({
    credit_card_id: z.string().min(1, "Credit card is required"),
    person_id: z.string().min(1, "Person is required"),
    purchase_id: z.string().optional(),
    date: z.string().min(1, "Date is required"),
    amount: z.number(),
    description: z.string().min(1, "Description is required"),
});

// Schema Types
export type CreditCardFormData = z.infer<typeof creditCardSchema>;
export type RefinedCreditCardFormData = z.infer<typeof refinedCreditCardSchema>;
export type PersonFormData = z.infer<typeof personSchema>;
export type PurchaseFormData = z.infer<typeof purchaseSchema>;
export type TransactionFormData = z.infer<typeof transactionSchema>;
