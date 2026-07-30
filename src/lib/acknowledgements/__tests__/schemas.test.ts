import { describe, expect, it } from "vitest";

import {
    createReceiptSchema,
    paidStatusSchema,
    receiptActionSchema,
    updateReceiptSchema,
} from "../schemas";

const payerPersonId = "3a0e8cb3-b8f6-49b7-b5b4-c92396e56bb4";
const transactionId = "32103207-5563-4947-8a63-a18b8fdf6d8f";

const validCreateInput = {
    payerPersonId,
    receiverName: "Receiver Name",
    amount: 12500,
    currency: "PHP",
    paymentDate: "2026-07-30",
    notes: "Includes an advance.",
    transactionIds: [transactionId],
};

describe("createReceiptSchema", () => {
    it("accepts reference-only transaction ids without allocations", () => {
        expect(
            createReceiptSchema.parse({
                ...validCreateInput,
                transactionIds: [],
            }),
        ).toMatchObject({ currency: "PHP", transactionIds: [] });
    });

    it("normalizes names and currency for storage", () => {
        expect(
            createReceiptSchema.parse({
                ...validCreateInput,
                receiverName: "  Receiver Name  ",
                currency: "php",
            }),
        ).toMatchObject({
            receiverName: "Receiver Name",
            currency: "PHP",
        });
    });

    it.each([0, -1, 12.345, 1_000_000_000_000])(
        "rejects an amount that numeric(14,2) cannot store: %s",
        (amount) => {
            expect(() =>
                createReceiptSchema.parse({ ...validCreateInput, amount }),
            ).toThrow();
        },
    );

    it.each(["PH", "PHPS", "P1P"])(
        "rejects invalid three-letter currency %s",
        (currency) => {
            expect(() =>
                createReceiptSchema.parse({ ...validCreateInput, currency }),
            ).toThrow();
        },
    );

    it.each(["2026-7-30", "2026-02-30", "not-a-date"])(
        "rejects invalid ISO payment date %s",
        (paymentDate) => {
            expect(() =>
                createReceiptSchema.parse({ ...validCreateInput, paymentDate }),
            ).toThrow();
        },
    );

    it("rejects blank and overlong receiver names", () => {
        expect(() =>
            createReceiptSchema.parse({
                ...validCreateInput,
                receiverName: "   ",
            }),
        ).toThrow();
        expect(() =>
            createReceiptSchema.parse({
                ...validCreateInput,
                receiverName: "R".repeat(201),
            }),
        ).toThrow();
    });

    it("rejects notes longer than 5,000 characters", () => {
        expect(() =>
            createReceiptSchema.parse({
                ...validCreateInput,
                notes: "N".repeat(5001),
            }),
        ).toThrow();
    });

    it("rejects invalid and duplicate transaction ids", () => {
        expect(() =>
            createReceiptSchema.parse({
                ...validCreateInput,
                transactionIds: ["not-a-uuid"],
            }),
        ).toThrow();
        expect(() =>
            createReceiptSchema.parse({
                ...validCreateInput,
                transactionIds: [transactionId, transactionId],
            }),
        ).toThrow();
    });
});

describe("updateReceiptSchema", () => {
    it("requires a positive current revision", () => {
        expect(
            updateReceiptSchema.parse({
                ...validCreateInput,
                expectedRevision: 3,
            }),
        ).toMatchObject({ expectedRevision: 3 });
        expect(() =>
            updateReceiptSchema.parse({
                ...validCreateInput,
                expectedRevision: 0,
            }),
        ).toThrow();
    });
});

describe("receiptActionSchema", () => {
    it("accepts publish and confirm actions with an expected revision", () => {
        expect(
            receiptActionSchema.parse({ type: "publish", expectedRevision: 1 }),
        ).toEqual({ type: "publish", expectedRevision: 1 });
        expect(
            receiptActionSchema.parse({ type: "confirm", expectedRevision: 2 }),
        ).toEqual({ type: "confirm", expectedRevision: 2 });
    });

    it("requires a nonblank reason when voiding", () => {
        expect(() =>
            receiptActionSchema.parse({
                type: "void",
                expectedRevision: 1,
                reason: "   ",
            }),
        ).toThrow();
        expect(
            receiptActionSchema.parse({
                type: "void",
                expectedRevision: 1,
                reason: "Entered in error",
            }),
        ).toMatchObject({ type: "void", reason: "Entered in error" });
    });
});

describe("paidStatusSchema", () => {
    it("accepts paid status without a receipt reference", () => {
        expect(paidStatusSchema.parse({ paid: true })).toEqual({
            paid: true,
        });
        expect(paidStatusSchema.parse({ paid: false })).toEqual({
            paid: false,
        });
    });

    it("requires an expected revision when linking a paid transaction", () => {
        expect(() =>
            paidStatusSchema.parse({
                paid: true,
                receiptId: payerPersonId,
            }),
        ).toThrow();
        expect(
            paidStatusSchema.parse({
                paid: true,
                receiptId: payerPersonId,
                expectedRevision: 4,
            }),
        ).toMatchObject({
            paid: true,
            receiptId: payerPersonId,
            expectedRevision: 4,
        });
    });

    it("rejects receipt links when marking a transaction unpaid", () => {
        expect(() =>
            paidStatusSchema.parse({
                paid: false,
                receiptId: payerPersonId,
                expectedRevision: 4,
            }),
        ).toThrow();
    });
});
