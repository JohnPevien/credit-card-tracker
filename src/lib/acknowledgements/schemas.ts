import { z } from "zod";

import type {
    CreateReceiptInput,
    ParsedCreateReceiptInput,
    ParsedUpdateReceiptInput,
    UpdateReceiptInput,
} from "./types";

const MAX_RECEIPT_AMOUNT = 999_999_999_999.99;

const uuidSchema = z.string().uuid();
const positiveRevisionSchema = z.number().int().positive();

const isoDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date")
    .refine((value) => {
        const parsed = new Date(`${value}T00:00:00.000Z`);
        return (
            !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === value
        );
    }, "Must be a valid calendar date");

const amountSchema = z
    .number()
    .finite()
    .positive("Amount must be positive")
    .max(MAX_RECEIPT_AMOUNT, "Amount exceeds numeric(14,2)")
    .multipleOf(0.01, "Amount must have at most two decimal places");

const currencySchema = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be three letters");

const receiverNameSchema = z
    .string()
    .trim()
    .min(1, "Receiver name is required")
    .max(200, "Receiver name must be 200 characters or fewer");

const notesSchema = z
    .string()
    .max(5_000, "Notes must be 5,000 characters or fewer")
    .nullable()
    .optional();

const transactionIdsSchema = z
    .array(uuidSchema)
    .superRefine((ids, context) => {
        if (new Set(ids).size !== ids.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Transaction ids must be unique",
            });
        }
    })
    .default([]);

const createReceiptObjectSchema = z.object({
    payerPersonId: uuidSchema,
    receiverName: receiverNameSchema,
    amount: amountSchema,
    currency: currencySchema.default("PHP"),
    paymentDate: isoDateSchema,
    notes: notesSchema,
    transactionIds: transactionIdsSchema,
});

export const createReceiptSchema: z.ZodType<
    ParsedCreateReceiptInput,
    z.ZodTypeDef,
    CreateReceiptInput
> = createReceiptObjectSchema;

export const updateReceiptSchema: z.ZodType<
    ParsedUpdateReceiptInput,
    z.ZodTypeDef,
    UpdateReceiptInput
> = createReceiptObjectSchema.extend({
    expectedRevision: positiveRevisionSchema,
});

export const receiptActionSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("publish"),
        expectedRevision: positiveRevisionSchema,
    }),
    z.object({
        type: z.literal("confirm"),
        expectedRevision: positiveRevisionSchema,
    }),
    z.object({
        type: z.literal("void"),
        expectedRevision: positiveRevisionSchema,
        reason: z
            .string()
            .trim()
            .min(1, "Void reason is required")
            .max(1_000, "Void reason must be 1,000 characters or fewer"),
    }),
]);

export const paidStatusSchema = z
    .object({
        paid: z.boolean(),
        receiptId: uuidSchema.nullish(),
        expectedRevision: positiveRevisionSchema.nullish(),
    })
    .superRefine((value, context) => {
        const hasReceipt = value.receiptId != null;
        const hasRevision = value.expectedRevision != null;

        if (hasReceipt && !value.paid) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["receiptId"],
                message: "A receipt can only be linked while marking paid",
            });
        }

        if (hasReceipt !== hasRevision) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: hasReceipt ? ["expectedRevision"] : ["receiptId"],
                message:
                    "Receipt id and expected revision must be supplied together",
            });
        }
    });
