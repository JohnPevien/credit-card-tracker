import { describe, it, expect, vi, beforeEach } from "vitest";
import { DataService } from "../dataService";
import { supabase } from "@/lib/supabase";

// Mock the supabase client
vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn(),
    },
}));

describe("DataService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("loadPurchases", () => {
        it("should return purchases with expand property", async () => {
            const mockData = [
                {
                    id: "purchase-1",
                    description: "Test Purchase",
                    credit_cards: { id: "card-1", credit_card_name: "Test Card" },
                    persons: { id: "person-1", name: "Test Person" },
                },
            ];

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
                }),
            });

            const result = await DataService.loadPurchases();

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty("expand");
            expect(result[0].expand.credit_card).toEqual(mockData[0].credit_cards);
            expect(result[0].expand.person).toEqual(mockData[0].persons);
        });

        it("should return empty array when no data", async () => {
            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });

            const result = await DataService.loadPurchases();

            expect(result).toEqual([]);
        });

        it("should throw error on failure", async () => {
            const mockError = new Error("Database error");

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
                }),
            });

            await expect(DataService.loadPurchases()).rejects.toThrow("Database error");
        });
    });

    describe("loadCreditCards", () => {
        it("should return credit cards with expand property", async () => {
            const mockData = [
                {
                    id: "card-1",
                    credit_card_name: "Test Card",
                    principal_card: { id: "principal-1", credit_card_name: "Principal" },
                },
            ];

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            });

            const result = await DataService.loadCreditCards();

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty("expand");
            expect(result[0].expand.principal_card).toEqual(mockData[0].principal_card);
        });

        it("should return empty array when no data", async () => {
            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: null, error: null }),
            });

            const result = await DataService.loadCreditCards();

            expect(result).toEqual([]);
        });

        it("should throw error on failure", async () => {
            const mockError = new Error("Database error");

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: null, error: mockError }),
            });

            await expect(DataService.loadCreditCards()).rejects.toThrow("Database error");
        });
    });

    describe("loadPersons", () => {
        it("should return persons array", async () => {
            const mockData = [
                { id: "person-1", name: "John Doe", slug: "john-doe" },
                { id: "person-2", name: "Jane Doe", slug: "jane-doe" },
            ];

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            });

            const result = await DataService.loadPersons();

            expect(result).toEqual(mockData);
        });

        it("should return empty array when no data", async () => {
            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: null, error: null }),
            });

            const result = await DataService.loadPersons();

            expect(result).toEqual([]);
        });

        it("should throw error on failure", async () => {
            const mockError = new Error("Database error");

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: null, error: mockError }),
            });

            await expect(DataService.loadPersons()).rejects.toThrow("Database error");
        });
    });

    describe("deletePurchaseAndTransactions", () => {
        it("should delete transactions first, then purchase", async () => {
            const mockTransactionEq = vi.fn().mockResolvedValue({ error: null });
            const mockPurchaseEq = vi.fn().mockResolvedValue({ error: null });

            (supabase.from as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce({
                    delete: vi.fn().mockReturnValue({
                        eq: mockTransactionEq,
                    }),
                })
                .mockReturnValueOnce({
                    delete: vi.fn().mockReturnValue({
                        eq: mockPurchaseEq,
                    }),
                });

            await DataService.deletePurchaseAndTransactions("purchase-1");

            expect(mockTransactionEq).toHaveBeenCalledWith("purchase_id", "purchase-1");
            expect(mockPurchaseEq).toHaveBeenCalledWith("id", "purchase-1");
        });

        it("should throw error if transaction deletion fails", async () => {
            const mockError = new Error("Transaction delete failed");

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                delete: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: mockError }),
                }),
            });

            await expect(
                DataService.deletePurchaseAndTransactions("purchase-1"),
            ).rejects.toThrow("Transaction delete failed");
        });

        it("should throw error if purchase deletion fails", async () => {
            const mockError = new Error("Purchase delete failed");

            (supabase.from as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce({
                    delete: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ error: null }),
                    }),
                })
                .mockReturnValueOnce({
                    delete: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ error: mockError }),
                    }),
                });

            await expect(
                DataService.deletePurchaseAndTransactions("purchase-1"),
            ).rejects.toThrow("Purchase delete failed");
        });
    });

    describe("createPurchaseWithTransactions", () => {
        const purchaseData = {
            credit_card_id: "card-1",
            person_id: "person-1",
            purchase_date: "2024-01-15",
            billing_start_date: "2024-02-01",
            total_amount: 3000,
            description: "Test Purchase",
            num_installments: 3,
            is_bnpl: false,
        };

        it("should create purchase and transactions", async () => {
            const mockPurchaseResult = [{ id: "purchase-1" }];
            const mockTransactionInsert = vi.fn().mockResolvedValue({ error: null });

            (supabase.from as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce({
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockResolvedValue({
                            data: mockPurchaseResult,
                            error: null,
                        }),
                    }),
                })
                .mockReturnValue({
                    insert: mockTransactionInsert,
                });

            await DataService.createPurchaseWithTransactions(purchaseData);

            // Should create 3 transactions (num_installments = 3)
            expect(mockTransactionInsert).toHaveBeenCalledTimes(3);

            // Check first transaction
            expect(mockTransactionInsert).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    credit_card_id: "card-1",
                    person_id: "person-1",
                    amount: 1000, // 3000 / 3
                    purchase_id: "purchase-1",
                }),
            );
        });

        it("should create single transaction without installment suffix", async () => {
            const singleInstallmentData = { ...purchaseData, num_installments: 1 };
            const mockPurchaseResult = [{ id: "purchase-1" }];
            const mockTransactionInsert = vi.fn().mockResolvedValue({ error: null });

            (supabase.from as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce({
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockResolvedValue({
                            data: mockPurchaseResult,
                            error: null,
                        }),
                    }),
                })
                .mockReturnValue({
                    insert: mockTransactionInsert,
                });

            await DataService.createPurchaseWithTransactions(singleInstallmentData);

            expect(mockTransactionInsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: "Test Purchase", // No installment suffix
                }),
            );
        });

        it("should add installment suffix for multiple installments", async () => {
            const mockPurchaseResult = [{ id: "purchase-1" }];
            const mockTransactionInsert = vi.fn().mockResolvedValue({ error: null });

            (supabase.from as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce({
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockResolvedValue({
                            data: mockPurchaseResult,
                            error: null,
                        }),
                    }),
                })
                .mockReturnValue({
                    insert: mockTransactionInsert,
                });

            await DataService.createPurchaseWithTransactions(purchaseData);

            expect(mockTransactionInsert).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    description: "Test Purchase (Installment 1/3)",
                }),
            );
            expect(mockTransactionInsert).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    description: "Test Purchase (Installment 2/3)",
                }),
            );
            expect(mockTransactionInsert).toHaveBeenNthCalledWith(
                3,
                expect.objectContaining({
                    description: "Test Purchase (Installment 3/3)",
                }),
            );
        });

        it("should throw error if purchase creation fails", async () => {
            const mockError = new Error("Insert failed");

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockResolvedValue({ data: null, error: mockError }),
                }),
            });

            await expect(
                DataService.createPurchaseWithTransactions(purchaseData),
            ).rejects.toThrow("Insert failed");
        });

        it("should throw error if purchase result is empty", async () => {
            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
            });

            await expect(
                DataService.createPurchaseWithTransactions(purchaseData),
            ).rejects.toThrow("Failed to create purchase");
        });

        it("should throw error if transaction creation fails", async () => {
            const mockPurchaseResult = [{ id: "purchase-1" }];
            const mockError = new Error("Transaction insert failed");

            (supabase.from as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce({
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockResolvedValue({
                            data: mockPurchaseResult,
                            error: null,
                        }),
                    }),
                })
                .mockReturnValue({
                    insert: vi.fn().mockResolvedValue({ error: mockError }),
                });

            await expect(
                DataService.createPurchaseWithTransactions(purchaseData),
            ).rejects.toThrow("Transaction insert failed");
        });
    });
});
