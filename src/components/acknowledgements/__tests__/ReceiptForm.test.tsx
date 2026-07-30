import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReceiptForm from "@/components/acknowledgements/ReceiptForm";

const payerId = "4f2dc79d-62f7-4db4-b661-6cf95dfca3aa";
const transactionId = "eac4c1b6-bde0-42db-a42f-0d8139729046";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("ReceiptForm", () => {
    it("requires the payer, receiver name, amount, and payment date", async () => {
        const onSubmit = vi.fn();

        render(
            <ReceiptForm
                persons={[{ id: payerId, name: "Alex Rivera" }]}
                onSubmit={onSubmit}
            />,
        );

        fireEvent.submit(
            screen.getByRole("button", { name: "Save draft" }).closest("form")!,
        );

        expect(
            await screen.findByText("Choose the payer for this receipt."),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Enter the receiver name."),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Enter an amount greater than zero."),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Choose the payment date."),
        ).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("submits optional, payer-filtered transaction references without reconciling totals", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                persons: [{ id: payerId, name: "Alex Rivera" }],
                transactions: [
                    {
                        id: transactionId,
                        personId: payerId,
                        date: "2026-07-20",
                        description: "Card settlement",
                        amount: 2400,
                        paid: true,
                        alreadyReferenced: false,
                    },
                ],
            }),
        });
        vi.stubGlobal("fetch", fetchMock);

        render(
            <ReceiptForm
                persons={[{ id: payerId, name: "Alex Rivera" }]}
                onSubmit={onSubmit}
            />,
        );

        await user.selectOptions(screen.getByLabelText("Payer"), payerId);
        expect(fetchMock).toHaveBeenCalledWith(
            `/api/acknowledgements/meta?payerPersonId=${payerId}`,
            expect.objectContaining({ cache: "no-store" }),
        );

        await user.type(screen.getByLabelText("Receiver name"), "Jamie Cruz");
        await user.type(screen.getByLabelText("Amount received"), "1250");
        await user.type(screen.getByLabelText("Payment date"), "2026-07-30");

        const reference = await screen.findByRole("checkbox", {
            name: /Card settlement/,
        });
        await user.click(reference);

        expect(screen.getByText(/Selected reference total/)).toHaveTextContent(
            "₱2,400.00",
        );
        expect(screen.getByText(/For context only/)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Save draft" }));

        await waitFor(() =>
            expect(onSubmit).toHaveBeenCalledWith({
                payerPersonId: payerId,
                receiverName: "Jamie Cruz",
                amount: 1250,
                currency: "PHP",
                paymentDate: "2026-07-30",
                notes: null,
                transactionIds: [transactionId],
            }),
        );
    });

    it("shows the confirmation reset and history warning when editing a completed revision", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    persons: [{ id: payerId, name: "Alex Rivera" }],
                    transactions: [],
                }),
            }),
        );

        render(
            <ReceiptForm
                persons={[{ id: payerId, name: "Alex Rivera" }]}
                initialValue={{
                    payerPersonId: payerId,
                    receiverName: "Jamie Cruz",
                    amount: 1250,
                    currency: "PHP",
                    paymentDate: "2026-07-30",
                    notes: null,
                    transactionIds: [],
                }}
                confirmationWarning="completed"
                onSubmit={vi.fn()}
            />,
        );

        expect(
            screen.getByText(/Saving changes resets both confirmations/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/completed revision remains in audit history/),
        ).toBeInTheDocument();
        expect(
            await screen.findByText(/No transactions are available/),
        ).toBeInTheDocument();
    });
});
