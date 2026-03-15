import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePurchaseDetails } from "../usePurchaseDetails";
import { PurchaseService } from "@/lib/services/purchaseService";
import { DataService } from "@/lib/services/dataService";

// Mock the services
vi.mock("@/lib/services/purchaseService", () => ({
    PurchaseService: {
        loadPurchaseDetails: vi.fn(),
        updateTransactionPaidStatus: vi.fn(),
        updatePurchase: vi.fn(),
        updatePurchaseWithCascade: vi.fn(),
        updatePurchaseFull: vi.fn(),
    },
}));

vi.mock("@/lib/services/dataService", () => ({
    DataService: {
        loadCreditCards: vi.fn(),
        loadPersons: vi.fn(),
    },
}));

const mockPurchase = {
    id: "purchase-1",
    description: "Test Purchase",
    credit_card_id: "card-1",
    person_id: "person-1",
    total_amount: 1000,
    expand: {
        credit_card: { id: "card-1", credit_card_name: "Test Card" },
        person: { id: "person-1", name: "Test Person" },
    },
};

const mockTransactions = [
    {
        id: "tx-1",
        purchase_id: "purchase-1",
        credit_card_id: "card-1",
        person_id: "person-1",
        amount: 500,
        date: "2024-01-01",
        expand: {
            credit_card: { id: "card-1", credit_card_name: "Test Card" },
            person: { id: "person-1", name: "Test Person" },
        },
    },
    {
        id: "tx-2",
        purchase_id: "purchase-1",
        credit_card_id: "card-1",
        person_id: "person-1",
        amount: 500,
        date: "2024-02-01",
        expand: {
            credit_card: { id: "card-1", credit_card_name: "Test Card" },
            person: { id: "person-1", name: "Test Person" },
        },
    },
];

describe("usePurchaseDetails", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mocks
        (PurchaseService.loadPurchaseDetails as ReturnType<typeof vi.fn>).mockResolvedValue({
            purchase: mockPurchase,
            transactions: mockTransactions,
        });
        (DataService.loadCreditCards as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (DataService.loadPersons as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    });

    describe("updatePurchase", () => {
        it("should update purchase state on success", async () => {
            const updatedPurchase = {
                ...mockPurchase,
                description: "Updated Description",
            };

            (PurchaseService.updatePurchase as ReturnType<typeof vi.fn>).mockResolvedValue(
                updatedPurchase,
            );

            const { result } = renderHook(() => usePurchaseDetails("purchase-1"));

            // Wait for initial load
            await vi.waitFor(() => expect(result.current.loading).toBe(false));

            await act(async () => {
                await result.current.updatePurchase({ description: "Updated Description" });
            });

            expect(PurchaseService.updatePurchase).toHaveBeenCalledWith("purchase-1", {
                description: "Updated Description",
            });
            expect(result.current.purchase).toEqual(updatedPurchase);
        });

        it("should throw error on failure", async () => {
            const mockError = new Error("Update failed");
            (PurchaseService.updatePurchase as ReturnType<typeof vi.fn>).mockRejectedValue(
                mockError,
            );

            const { result } = renderHook(() => usePurchaseDetails("purchase-1"));

            await vi.waitFor(() => expect(result.current.loading).toBe(false));

            await expect(
                act(async () => {
                    await result.current.updatePurchase({ description: "Test" });
                }),
            ).rejects.toThrow("Update failed");
        });
    });

    describe("updatePurchaseWithCascade", () => {
        it("should update purchase state", async () => {
            const updatedPurchase = {
                ...mockPurchase,
                description: "Updated",
            };

            (PurchaseService.updatePurchaseWithCascade as ReturnType<typeof vi.fn>).mockResolvedValue(
                updatedPurchase,
            );

            const { result } = renderHook(() => usePurchaseDetails("purchase-1"));

            await vi.waitFor(() => expect(result.current.loading).toBe(false));

            await act(async () => {
                await result.current.updatePurchaseWithCascade({ description: "Updated" });
            });

            expect(result.current.purchase).toEqual(updatedPurchase);
        });

        it("should update transactions when credit_card_id changes", async () => {
            const updatedPurchase = {
                ...mockPurchase,
                credit_card_id: "card-2",
                expand: {
                    ...mockPurchase.expand,
                    credit_card: { id: "card-2", credit_card_name: "New Card" },
                },
            };

            (PurchaseService.updatePurchaseWithCascade as ReturnType<typeof vi.fn>).mockResolvedValue(
                updatedPurchase,
            );

            const { result } = renderHook(() => usePurchaseDetails("purchase-1"));

            await vi.waitFor(() => expect(result.current.loading).toBe(false));

            await act(async () => {
                await result.current.updatePurchaseWithCascade({ credit_card_id: "card-2" });
            });

            expect(result.current.transactions[0].credit_card_id).toBe("card-2");
            expect(result.current.transactions[0].expand?.credit_card).toEqual(
                updatedPurchase.expand.credit_card,
            );
        });

        it("should update transactions when person_id changes", async () => {
            const updatedPurchase = {
                ...mockPurchase,
                person_id: "person-2",
                expand: {
                    ...mockPurchase.expand,
                    person: { id: "person-2", name: "New Person" },
                },
            };

            (PurchaseService.updatePurchaseWithCascade as ReturnType<typeof vi.fn>).mockResolvedValue(
                updatedPurchase,
            );

            const { result } = renderHook(() => usePurchaseDetails("purchase-1"));

            await vi.waitFor(() => expect(result.current.loading).toBe(false));

            await act(async () => {
                await result.current.updatePurchaseWithCascade({ person_id: "person-2" });
            });

            expect(result.current.transactions[0].person_id).toBe("person-2");
            expect(result.current.transactions[0].expand?.person).toEqual(
                updatedPurchase.expand.person,
            );
        });

        it("should update transactions when both credit_card_id and person_id change", async () => {
            const updatedPurchase = {
                ...mockPurchase,
                credit_card_id: "card-2",
                person_id: "person-2",
                expand: {
                    credit_card: { id: "card-2", credit_card_name: "New Card" },
                    person: { id: "person-2", name: "New Person" },
                },
            };

            (PurchaseService.updatePurchaseWithCascade as ReturnType<typeof vi.fn>).mockResolvedValue(
                updatedPurchase,
            );

            const { result } = renderHook(() => usePurchaseDetails("purchase-1"));

            await vi.waitFor(() => expect(result.current.loading).toBe(false));

            await act(async () => {
                await result.current.updatePurchaseWithCascade({
                    credit_card_id: "card-2",
                    person_id: "person-2",
                });
            });

            expect(result.current.transactions[0].credit_card_id).toBe("card-2");
            expect(result.current.transactions[0].person_id).toBe("person-2");
            expect(result.current.transactions[0].expand?.credit_card).toEqual(
                updatedPurchase.expand.credit_card,
            );
            expect(result.current.transactions[0].expand?.person).toEqual(
                updatedPurchase.expand.person,
            );
        });
    });

    describe("updatePurchaseFull", () => {
        it("should update both purchase and transactions from response", async () => {
            const updatedPurchase = {
                ...mockPurchase,
                total_amount: 1500,
                billing_start_date: "2024-02-01",
            };

            const updatedTransactions = [
                {
                    id: "tx-1",
                    purchase_id: "purchase-1",
                    credit_card_id: "card-1",
                    person_id: "person-1",
                    amount: 750,
                    date: "2024-02-01",
                    expand: {
                        credit_card: { id: "card-1", credit_card_name: "Test Card" },
                        person: { id: "person-1", name: "Test Person" },
                    },
                },
                {
                    id: "tx-2",
                    purchase_id: "purchase-1",
                    credit_card_id: "card-1",
                    person_id: "person-1",
                    amount: 750,
                    date: "2024-03-01",
                    expand: {
                        credit_card: { id: "card-1", credit_card_name: "Test Card" },
                        person: { id: "person-1", name: "Test Person" },
                    },
                },
            ];

            (PurchaseService.updatePurchaseFull as ReturnType<typeof vi.fn>).mockResolvedValue({
                purchase: updatedPurchase,
                transactions: updatedTransactions,
            });

            const { result } = renderHook(() => usePurchaseDetails("purchase-1"));

            await vi.waitFor(() => expect(result.current.loading).toBe(false));

            await act(async () => {
                await result.current.updatePurchaseFull({
                    total_amount: 1500,
                    billing_start_date: "2024-02-01",
                });
            });

            expect(PurchaseService.updatePurchaseFull).toHaveBeenCalledWith("purchase-1", {
                total_amount: 1500,
                billing_start_date: "2024-02-01",
            });
            expect(result.current.purchase).toEqual(updatedPurchase);
            expect(result.current.transactions).toEqual(updatedTransactions);
        });

        it("should throw error on failure", async () => {
            const mockError = new Error("Full update failed");
            (PurchaseService.updatePurchaseFull as ReturnType<typeof vi.fn>).mockRejectedValue(
                mockError,
            );

            const { result } = renderHook(() => usePurchaseDetails("purchase-1"));

            await vi.waitFor(() => expect(result.current.loading).toBe(false));

            await expect(
                act(async () => {
                    await result.current.updatePurchaseFull({ total_amount: 2000 });
                }),
            ).rejects.toThrow("Full update failed");
        });
    });
});
