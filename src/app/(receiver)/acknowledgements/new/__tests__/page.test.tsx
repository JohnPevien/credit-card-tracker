import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const receiptApiMocks = vi.hoisted(() => ({
    createReceiptRequest: vi.fn(),
    requestJson: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

vi.mock("@/components/acknowledgements/receiptApi", () => {
    class ReceiptRequestError extends Error {}

    return {
        ReceiptRequestError,
        ...receiptApiMocks,
    };
});

import NewAcknowledgementPage from "../page";

describe("NewAcknowledgementPage", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("gives the failed-load retry control a mobile-sized tap target", async () => {
        receiptApiMocks.requestJson.mockRejectedValue(
            new Error("Receipt options unavailable"),
        );

        render(<NewAcknowledgementPage />);

        expect(
            await screen.findByRole("button", { name: "Retry loading" }),
        ).toHaveClass("min-h-11");
    });
});
