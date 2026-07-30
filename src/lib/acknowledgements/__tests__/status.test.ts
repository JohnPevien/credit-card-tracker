import { describe, expect, it } from "vitest";

import {
    formatReceiptAmount,
    formatReceiptDate,
    formatReceiptDateTime,
} from "../format";
import { deriveReceiptStatus } from "../status";

describe("deriveReceiptStatus", () => {
    it("returns draft before the receipt is published", () => {
        expect(
            deriveReceiptStatus({
                published_at: null,
                payer_confirmed_at: null,
                receiver_confirmed_at: null,
                completed_at: null,
                voided_at: null,
            }),
        ).toBe("draft");
    });

    it("returns awaiting_both when a published receipt has no confirmations", () => {
        expect(
            deriveReceiptStatus({
                published_at: "2026-07-30T00:00:00Z",
                payer_confirmed_at: null,
                receiver_confirmed_at: null,
                completed_at: null,
                voided_at: null,
            }),
        ).toBe("awaiting_both");
    });

    it("returns awaiting_payer when only the receiver has confirmed", () => {
        expect(
            deriveReceiptStatus({
                published_at: "2026-07-30T00:00:00Z",
                payer_confirmed_at: null,
                receiver_confirmed_at: "2026-07-30T00:01:00Z",
                completed_at: null,
                voided_at: null,
            }),
        ).toBe("awaiting_payer");
    });

    it("returns awaiting_receiver when only the payer has confirmed", () => {
        expect(
            deriveReceiptStatus({
                published_at: "2026-07-30T00:00:00Z",
                payer_confirmed_at: "2026-07-30T00:01:00Z",
                receiver_confirmed_at: null,
                completed_at: null,
                voided_at: null,
            }),
        ).toBe("awaiting_receiver");
    });

    it("returns completed only when completed_at belongs to the current revision", () => {
        expect(
            deriveReceiptStatus({
                published_at: "2026-07-30T00:00:00Z",
                payer_confirmed_at: "2026-07-30T00:01:00Z",
                receiver_confirmed_at: "2026-07-30T00:02:00Z",
                completed_at: "2026-07-30T00:02:00Z",
                voided_at: null,
            }),
        ).toBe("completed");
    });

    it("does not treat a stale completed_at without both confirmations as completed", () => {
        expect(
            deriveReceiptStatus({
                published_at: "2026-07-30T00:00:00Z",
                payer_confirmed_at: null,
                receiver_confirmed_at: null,
                completed_at: "2026-07-29T23:00:00Z",
                voided_at: null,
            }),
        ).toBe("awaiting_both");
    });

    it("gives a voided receipt precedence over every other lifecycle field", () => {
        expect(
            deriveReceiptStatus({
                published_at: "2026-07-30T00:00:00Z",
                payer_confirmed_at: "2026-07-30T00:01:00Z",
                receiver_confirmed_at: "2026-07-30T00:02:00Z",
                completed_at: "2026-07-30T00:02:00Z",
                voided_at: "2026-07-30T00:03:00Z",
            }),
        ).toBe("voided");
    });
});

describe("receipt formatting", () => {
    it("formats PHP amounts with two decimal places", () => {
        expect(formatReceiptAmount(12500, "PHP")).toContain("12,500.00");
        expect(formatReceiptAmount(12500, "PHP")).toContain("₱");
    });

    it("renders date-only values without shifting the calendar day", () => {
        expect(formatReceiptDate("2026-07-30")).toBe("Jul 30, 2026");
    });

    it("renders timestamps in Asia/Manila", () => {
        expect(formatReceiptDateTime("2026-07-30T16:30:00Z")).toContain(
            "Jul 31, 2026",
        );
    });
});
