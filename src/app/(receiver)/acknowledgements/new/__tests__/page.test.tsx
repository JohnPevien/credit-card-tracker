import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const receiptApiMocks = vi.hoisted(() => ({
    createReceiptRequest: vi.fn(),
    requestJson: vi.fn(),
}));
const proofMocks = vi.hoisted(() => ({
    proofApiBase: vi.fn(
        (receiptId: string) =>
            `/api/acknowledgements/${receiptId}/files`,
    ),
    uploadProofFile: vi.fn(),
}));
const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: routerPush,
    }),
}));

vi.mock("@/components/acknowledgements/receiptApi", () => {
    class ReceiptRequestError extends Error {}

    return {
        ReceiptRequestError,
        ...receiptApiMocks,
    };
});

vi.mock("@/components/acknowledgements/ProofUploader", () => proofMocks);

import NewAcknowledgementPage from "../page";

describe("NewAcknowledgementPage", () => {
    afterEach(() => {
        vi.clearAllMocks();
        window.history.replaceState({}, "", "/acknowledgements/new");
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

    it("creates one draft, uploads staged proofs sequentially, and routes a partial failure to that receipt for retry", async () => {
        const user = userEvent.setup();
        const personId = "00000000-0000-4000-8000-000000000020";
        const receiptId = "00000000-0000-4000-8000-000000000010";
        receiptApiMocks.requestJson.mockResolvedValue({
            persons: [{ id: personId, name: "Ada Payer" }],
            transactions: [],
        });
        receiptApiMocks.createReceiptRequest.mockResolvedValue({
            receipt: {
                id: receiptId,
                revisionNumber: 1,
            },
        });
        proofMocks.uploadProofFile
            .mockResolvedValueOnce({
                proof: { id: "proof-one" },
                revisionNumber: 2,
            })
            .mockRejectedValueOnce(new Error("upload failed"));
        render(<NewAcknowledgementPage />);

        await user.selectOptions(
            await screen.findByLabelText("Payer"),
            personId,
        );
        await user.type(
            screen.getByLabelText("Receiver name"),
            "Rene Receiver",
        );
        await user.type(screen.getByLabelText("Amount received"), "1250");
        fireEvent.change(screen.getByLabelText("Payment date"), {
            target: { value: "2026-07-30" },
        });
        const first = new File(["one"], "one.png", { type: "image/png" });
        const second = new File(["two"], "two.png", {
            type: "image/png",
        });
        fireEvent.change(screen.getByLabelText("Stage proof images"), {
            target: { files: [first, second] },
        });
        await user.click(
            screen.getByRole("button", { name: "Save draft" }),
        );

        await waitFor(() =>
            expect(proofMocks.uploadProofFile).toHaveBeenCalledTimes(2),
        );
        expect(receiptApiMocks.createReceiptRequest).toHaveBeenCalledOnce();
        expect(proofMocks.uploadProofFile).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                file: first,
                expectedRevision: 1,
                apiBase: `/api/acknowledgements/${receiptId}/files`,
            }),
        );
        expect(proofMocks.uploadProofFile).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                file: second,
                expectedRevision: 2,
                apiBase: `/api/acknowledgements/${receiptId}/files`,
            }),
        );
        expect(routerPush).toHaveBeenCalledWith(
            expect.stringMatching(
                new RegExp(
                    `^/acknowledgements/${receiptId}\\?proofUpload=retry`,
                ),
            ),
        );
    });
});
