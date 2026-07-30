import { render, screen } from "@testing-library/react";
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

import TransactionReferencePicker from "@/components/acknowledgements/TransactionReferencePicker";

describe("TransactionReferencePicker", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("gives the failed-load retry control a mobile-sized tap target", async () => {
        receiptApiMocks.requestJson.mockRejectedValue(
            new Error("Transaction options unavailable"),
        );

        render(
            <TransactionReferencePicker
                payerPersonId="4f2dc79d-62f7-4db4-b661-6cf95dfca3aa"
                selectedIds={[]}
                onChange={vi.fn()}
            />,
        );

        expect(
            await screen.findByRole("button", {
                name: "Retry transactions",
            }),
        ).toHaveClass("min-h-11");
    });
});
