import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurchaseService } from "../purchaseService";
import { supabase } from "@/lib/supabase";

// Mock the supabase client
vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn(),
        rpc: vi.fn(),
    },
}));

describe("PurchaseService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("updatePurchase", () => {
        it("should update purchase fields and return transformed data", async () => {
            const mockPurchase = {
                id: "purchase-1",
                description: "Updated Description",
                purchase_date: "2024-01-15",
                is_bnpl: true,
                credit_card_id: "card-1",
                person_id: "person-1",
                total_amount: 1000,
                num_installments: 3,
                credit_cards: { id: "card-1", credit_card_name: "Test Card" },
                persons: { id: "person-1", name: "Test Person" },
            };

            const mockFrom = vi.fn().mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: mockPurchase,
                                error: null,
                            }),
                        }),
                    }),
                }),
            });

            (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(mockFrom);

            const result = await PurchaseService.updatePurchase("purchase-1", {
                description: "Updated Description",
                purchase_date: "2024-01-15",
                is_bnpl: true,
            });

            expect(result).toEqual({
                ...mockPurchase,
                expand: {
                    credit_card: mockPurchase.credit_cards,
                    person: mockPurchase.persons,
                },
            });
        });

        it("should throw error when update fails", async () => {
            const mockError = new Error("Database error");

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: null,
                                error: mockError,
                            }),
                        }),
                    }),
                }),
            });

            await expect(
                PurchaseService.updatePurchase("purchase-1", { description: "Test" }),
            ).rejects.toThrow("Database error");
        });
    });

    describe("updatePurchaseWithCascade", () => {
        it("should call RPC with correct parameters and return transformed data", async () => {
            const mockResult = {
                purchase: {
                    id: "purchase-1",
                    description: "Test",
                    credit_card_id: "card-2",
                    person_id: "person-1",
                },
                credit_cards: [{ id: "card-2", credit_card_name: "New Card" }],
                persons: [{ id: "person-1", name: "Test Person" }],
            };

            (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: mockResult,
                error: null,
            });

            const result = await PurchaseService.updatePurchaseWithCascade(
                "purchase-1",
                {
                    description: "Test",
                    credit_card_id: "card-2",
                },
            );

            expect(supabase.rpc).toHaveBeenCalledWith("update_purchase_with_cascade", {
                p_id: "purchase-1",
                p_description: "Test",
                p_purchase_date: undefined,
                p_is_bnpl: undefined,
                p_credit_card_id: "card-2",
                p_person_id: undefined,
            });

            expect(result).toEqual({
                ...mockResult.purchase,
                expand: {
                    credit_card: mockResult.credit_cards[0],
                    person: mockResult.persons[0],
                },
            });
        });

        it("should handle null credit_cards and persons arrays", async () => {
            const mockResult = {
                purchase: {
                    id: "purchase-1",
                    description: "Test",
                },
                credit_cards: null,
                persons: null,
            };

            (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: mockResult,
                error: null,
            });

            const result = await PurchaseService.updatePurchaseWithCascade(
                "purchase-1",
                { description: "Test" },
            );

            expect(result.expand).toEqual({
                credit_card: null,
                person: null,
            });
        });

        it("should throw error when RPC fails", async () => {
            const mockError = new Error("RPC error");

            (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: null,
                error: mockError,
            });

            await expect(
                PurchaseService.updatePurchaseWithCascade("purchase-1", {
                    description: "Test",
                }),
            ).rejects.toThrow("RPC error");
        });
    });

    describe("updatePurchaseFull", () => {
        it("should call RPC with all parameters and return purchase with transactions", async () => {
            const mockResult = {
                purchase: {
                    id: "purchase-1",
                    description: "Updated",
                    total_amount: 1500,
                    billing_start_date: "2024-02-01",
                },
                credit_cards: [{ id: "card-1", credit_card_name: "Card" }],
                persons: [{ id: "person-1", name: "Person" }],
                transactions: [
                    { id: "tx-1", amount: 500, date: "2024-02-01" },
                    { id: "tx-2", amount: 500, date: "2024-03-01" },
                    { id: "tx-3", amount: 500, date: "2024-04-01" },
                ],
            };

            (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: mockResult,
                error: null,
            });

            const result = await PurchaseService.updatePurchaseFull("purchase-1", {
                description: "Updated",
                total_amount: 1500,
                billing_start_date: "2024-02-01",
                num_installments: 4,
            });

            expect(supabase.rpc).toHaveBeenCalledWith("update_purchase_full", {
                p_id: "purchase-1",
                p_description: "Updated",
                p_purchase_date: null,
                p_is_bnpl: null,
                p_credit_card_id: null,
                p_person_id: null,
                p_total_amount: 1500,
                p_billing_start_date: "2024-02-01",
                p_num_installments: 4,
            });

            expect(result.purchase).toEqual({
                ...mockResult.purchase,
                expand: {
                    credit_card: mockResult.credit_cards[0],
                    person: mockResult.persons[0],
                },
            });

            expect(result.transactions).toHaveLength(3);
            expect(result.transactions[0]).toEqual({
                ...mockResult.transactions[0],
                expand: {
                    credit_card: mockResult.credit_cards[0],
                    person: mockResult.persons[0],
                },
            });
        });

        it("should use null for undefined parameters", async () => {
            const mockResult = {
                purchase: { id: "purchase-1" },
                credit_cards: [],
                persons: [],
                transactions: [],
            };

            (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: mockResult,
                error: null,
            });

            await PurchaseService.updatePurchaseFull("purchase-1", {});

            expect(supabase.rpc).toHaveBeenCalledWith("update_purchase_full", {
                p_id: "purchase-1",
                p_description: null,
                p_purchase_date: null,
                p_is_bnpl: null,
                p_credit_card_id: null,
                p_person_id: null,
                p_total_amount: null,
                p_billing_start_date: null,
                p_num_installments: null,
            });
        });

        it("should handle empty transactions array", async () => {
            const mockResult = {
                purchase: { id: "purchase-1" },
                credit_cards: [],
                persons: [],
                transactions: null,
            };

            (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: mockResult,
                error: null,
            });

            const result = await PurchaseService.updatePurchaseFull("purchase-1", {});

            expect(result.transactions).toEqual([]);
        });

        it("should throw error when RPC fails", async () => {
            const mockError = new Error("Full update failed");

            (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: null,
                error: mockError,
            });

            await expect(
                PurchaseService.updatePurchaseFull("purchase-1", {
                    total_amount: 2000,
                }),
            ).rejects.toThrow("Full update failed");
        });
    });
});
