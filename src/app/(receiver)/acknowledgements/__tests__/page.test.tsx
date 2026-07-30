import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const receiptApiMocks = vi.hoisted(() => ({
    requestJson: vi.fn(),
}));

vi.mock("@/components/acknowledgements/receiptApi", () => {
    class ReceiptRequestError extends Error {}
    return {
        ReceiptRequestError,
        ...receiptApiMocks,
    };
});

import AcknowledgementsPage from "../page";

const receipt = {
    id: "0f11ad9a-f95d-4ca6-a45c-6d9d96f40790",
    receiptNumber: "AR-2026-000001",
    payerPersonId: "4f2dc79d-62f7-4db4-b661-6cf95dfca3aa",
    payerName: "Alex Rivera",
    receiverName: "Jamie Cruz",
    amount: 1250,
    currency: "PHP",
    paymentDate: "2026-07-30",
    notes: null,
    revisionNumber: 2,
    publishedAt: "2026-07-30T00:00:00.000Z",
    payerConfirmedAt: "2026-07-30T00:05:00.000Z",
    receiverConfirmedAt: "2026-07-30T00:06:00.000Z",
    completedAt: "2026-07-30T00:06:00.000Z",
    isCompleted: true,
    voidedAt: null,
    voidReason: null,
    status: "completed" as const,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:06:00.000Z",
    transactionCount: 0,
    proofCount: 1,
};

afterEach(() => {
    vi.clearAllMocks();
});

describe("AcknowledgementsPage", () => {
    it("renders confirmation timestamps visibly and mobile-sized receipt actions", async () => {
        receiptApiMocks.requestJson.mockImplementation((url: string) =>
            Promise.resolve(
                url.includes("/meta")
                    ? {
                          persons: [
                              {
                                  id: receipt.payerPersonId,
                                  name: receipt.payerName,
                              },
                          ],
                          transactions: [],
                      }
                    : { receipts: [receipt] },
            ),
        );

        render(<AcknowledgementsPage />);

        await screen.findAllByRole("link", { name: "View" });
        await waitFor(() => {
            const confirmationTimes = Array.from(
                document.querySelectorAll("time"),
            );
            expect(confirmationTimes.length).toBeGreaterThan(0);
            expect(
                confirmationTimes.every((node) =>
                    node.textContent?.includes("Jul 30, 2026"),
                ),
            ).toBe(true);
        });

        for (const action of screen.getAllByRole("link", { name: "View" })) {
            expect(action).toHaveClass("min-h-11");
        }
        for (const action of screen.getAllByRole("link", { name: "Edit" })) {
            expect(action).toHaveClass("min-h-11");
        }
    });

    it("keeps filters disabled until the initial metadata and list request finish", () => {
        receiptApiMocks.requestJson.mockReturnValue(new Promise(() => {}));

        render(<AcknowledgementsPage />);

        expect(screen.getByLabelText("Payer")).toBeDisabled();
        expect(screen.getByLabelText("Status")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
        expect(
            screen.getByRole("button", { name: "Clear receipt filters" }),
        ).toBeDisabled();
    });
});
