import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const receiptApiMocks = vi.hoisted(() => ({
    requestJson: vi.fn(),
    requestPortal: vi.fn(),
    requestPortalAction: vi.fn(),
    requestReceiptAction: vi.fn(),
    updateReceiptRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useParams: () => ({
        id: "0f11ad9a-f95d-4ca6-a45c-6d9d96f40790",
    }),
}));

vi.mock("@/components/acknowledgements/receiptApi", () => {
    class ReceiptRequestError extends Error {
        readonly status: number;

        constructor(message: string, status: number) {
            super(message);
            this.status = status;
        }

        get isConflict() {
            return this.status === 409;
        }
    }

    return {
        ReceiptRequestError,
        ...receiptApiMocks,
    };
});

import AcknowledgementDetailPage from "../page";

const oldPayerId = "4f2dc79d-62f7-4db4-b661-6cf95dfca3aa";
const newPayerId = "7b69f0ca-5c79-4b33-a9ef-ce66aed2a30b";

const baseReceipt = {
    id: "0f11ad9a-f95d-4ca6-a45c-6d9d96f40790",
    receiptNumber: "AR-2026-000001",
    payerPersonId: oldPayerId,
    payerName: "Old Payer",
    receiverName: "Jamie Cruz",
    amount: 1250,
    currency: "PHP",
    paymentDate: "2026-07-30",
    notes: "Settled in person.",
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
    transactions: [],
    proofs: [],
    revisions: [],
    events: [],
};

const oldPortal = {
    personId: oldPayerId,
    payerName: "Old Payer",
    publicId: "39ecc191-2dde-430a-80c4-472aeb46a85f",
    credentialVersion: 1,
    revokedAt: null,
    lastAccessedAt: null,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
};

const meta = {
    persons: [
        { id: oldPayerId, name: "Old Payer" },
        { id: newPayerId, name: "New Payer" },
    ],
    transactions: [],
};

describe("AcknowledgementDetailPage", () => {
    beforeEach(() => {
        receiptApiMocks.requestJson.mockImplementation((url: string) =>
            Promise.resolve(
                url.includes("/meta")
                    ? meta
                    : {
                          receipt: baseReceipt,
                      },
            ),
        );
        receiptApiMocks.requestPortal.mockResolvedValue({ portal: oldPortal });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("keeps a successful payer edit while isolating a failed new portal refresh", async () => {
        const user = userEvent.setup();
        const updatedReceipt = {
            ...baseReceipt,
            payerPersonId: newPayerId,
            payerName: "New Payer",
            revisionNumber: 3,
            payerConfirmedAt: null,
            receiverConfirmedAt: null,
            completedAt: null,
            isCompleted: false,
            status: "draft" as const,
        };
        receiptApiMocks.updateReceiptRequest.mockResolvedValue({
            receipt: updatedReceipt,
        });
        receiptApiMocks.requestPortal
            .mockResolvedValueOnce({ portal: oldPortal })
            .mockRejectedValueOnce(new Error("Portal refresh unavailable"));

        render(<AcknowledgementDetailPage />);

        await user.click(
            await screen.findByRole("button", { name: "Edit receipt" }),
        );
        await user.selectOptions(screen.getByLabelText("Payer"), newPayerId);
        await user.click(
            screen.getByRole("button", { name: "Save new revision" }),
        );

        expect(
            await screen.findByRole("heading", { name: "New Payer" }),
        ).toBeInTheDocument();
        expect(screen.getByText(/Receipt updated/i)).toBeInTheDocument();
        expect(
            screen.getByText(/Portal access could not be refreshed/i),
        ).toBeInTheDocument();
        expect(
            screen.queryByDisplayValue(/39ecc191-2dde-430a-80c4-472aeb46a85f/),
        ).not.toBeInTheDocument();
    });

    it("shows only active current proofs and readable, sanitized audit snapshots", async () => {
        const receiptWithHistory = {
            ...baseReceipt,
            proofs: [
                {
                    id: "active-proof",
                    originalFilename: "current-proof.jpg",
                    contentType: "image/jpeg" as const,
                    sizeBytes: 1024,
                    uploaderRole: "receiver" as const,
                    removedAt: null,
                    createdAt: "2026-07-30T00:02:00.000Z",
                },
                {
                    id: "removed-proof",
                    originalFilename: "removed-current-proof.jpg",
                    contentType: "image/jpeg" as const,
                    sizeBytes: 2048,
                    uploaderRole: "payer" as const,
                    removedAt: "2026-07-30T00:03:00.000Z",
                    createdAt: "2026-07-30T00:01:00.000Z",
                },
            ],
            revisions: [
                {
                    id: "revision-1",
                    revisionNumber: 1,
                    snapshot: {
                        receipt: {
                            ...baseReceipt,
                            receiverName: "Old Receiver",
                            revisionNumber: 1,
                        },
                        transactions: [
                            {
                                id: "historical-transaction",
                                transactionId: null,
                                transactionDate: "2026-07-29",
                                description: "Historical transfer",
                                amount: 1250,
                                createdAt: "2026-07-29T00:00:00.000Z",
                            },
                        ],
                        proofs: [
                            {
                                id: "historical-proof",
                                originalFilename: "old-proof.jpg",
                                contentType: "image/jpeg" as const,
                                sizeBytes: 4096,
                                uploaderRole: "payer" as const,
                                removedAt: null,
                                createdAt: "2026-07-29T00:00:00.000Z",
                            },
                        ],
                    },
                    changeReason: "Receiver name corrected",
                    changedByRole: "receiver" as const,
                    createdAt: "2026-07-30T00:04:00.000Z",
                },
            ],
            events: [
                {
                    id: "event-1",
                    eventType: "proof_removed",
                    actorRole: "receiver" as const,
                    revisionNumber: 2,
                    details: {
                        reason: "Duplicate evidence",
                        originalFilename: "removed-current-proof.jpg",
                        storage_path: "private/raw/path.jpg",
                    },
                    createdAt: "2026-07-30T00:04:00.000Z",
                },
            ],
        };
        receiptApiMocks.requestJson.mockImplementation((url: string) =>
            Promise.resolve(
                url.includes("/meta") ? meta : { receipt: receiptWithHistory },
            ),
        );

        render(<AcknowledgementDetailPage />);

        const proofHeading = await screen.findByRole("heading", {
            name: "Current proof metadata",
        });
        const proofSection = proofHeading.closest("section");
        expect(proofSection).not.toBeNull();
        expect(
            within(proofSection!).getByText(/1 of 5 active/),
        ).toBeInTheDocument();
        expect(
            within(proofSection!).getByText("current-proof.jpg"),
        ).toBeInTheDocument();
        expect(
            within(proofSection!).queryByText("removed-current-proof.jpg"),
        ).not.toBeInTheDocument();

        const revisionSummary = screen.getByText("Revision 1");
        fireEvent.click(revisionSummary);

        expect(screen.getByText("Old Receiver")).toBeInTheDocument();
        expect(screen.getByText("Historical transfer")).toBeInTheDocument();
        expect(screen.getByText("old-proof.jpg")).toBeInTheDocument();
        expect(screen.getByText("Duplicate evidence")).toBeInTheDocument();
        expect(
            screen.queryByText("private/raw/path.jpg"),
        ).not.toBeInTheDocument();
    });
});
