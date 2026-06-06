import { describe, it, expect, vi, beforeEach } from "vitest";
import { cn, formatDate, formatCurrency, handleTransactionPaidChange } from "../utils";
import { supabase } from "../supabase";

// Mock the supabase client
vi.mock("../supabase", () => ({
    supabase: {
        from: vi.fn(),
    },
}));

describe("utils", () => {
    describe("cn", () => {
        it("should merge class names", () => {
            const result = cn("foo", "bar");
            expect(result).toBe("foo bar");
        });

        it("should handle conditional classes", () => {
            const result = cn("base", true && "included", false && "excluded");
            expect(result).toBe("base included");
        });

        it("should merge tailwind classes correctly", () => {
            // twMerge should handle conflicting tailwind classes
            const result = cn("p-4", "p-2");
            expect(result).toBe("p-2");
        });

        it("should handle undefined and null values", () => {
            const result = cn("base", undefined, null, "end");
            expect(result).toBe("base end");
        });

        it("should handle object notation", () => {
            const result = cn({ active: true, disabled: false });
            expect(result).toBe("active");
        });
    });

    describe("formatDate", () => {
        it("should format ISO date string", () => {
            const result = formatDate("2024-03-15T00:00:00Z");
            // Result depends on locale, but should be a valid date string
            expect(result).toBeTruthy();
            expect(typeof result).toBe("string");
        });

        it("should handle date-only strings", () => {
            const result = formatDate("2024-03-15");
            expect(result).toBeTruthy();
        });

        it("should handle different date formats", () => {
            const result = formatDate("2024/03/15");
            expect(result).toBeTruthy();
        });
    });

    describe("formatCurrency", () => {
        it("should format positive amounts with peso sign", () => {
            const result = formatCurrency(1000);
            expect(result).toBe("₱1,000.00");
        });

        it("should format amounts with decimals", () => {
            const result = formatCurrency(1234.56);
            expect(result).toBe("₱1,234.56");
        });

        it("should handle zero", () => {
            const result = formatCurrency(0);
            expect(result).toBe("₱0.00");
        });

        it("should use absolute value for negative amounts", () => {
            const result = formatCurrency(-500);
            expect(result).toBe("₱500.00");
        });

        it("should format large numbers with commas", () => {
            const result = formatCurrency(1000000);
            expect(result).toBe("₱1,000,000.00");
        });

        it("should round to 2 decimal places", () => {
            const result = formatCurrency(100.999);
            expect(result).toBe("₱101.00");
        });

        it("should pad to 2 decimal places", () => {
            const result = formatCurrency(100.5);
            expect(result).toBe("₱100.50");
        });
    });

    describe("handleTransactionPaidChange", () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should update transaction paid status", async () => {
            const mockSetUpdatingId = vi.fn();
            const mockSetTransactions = vi.fn();

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                }),
            });

            await handleTransactionPaidChange(
                "tx-1",
                true,
                mockSetUpdatingId,
                mockSetTransactions,
            );

            expect(mockSetUpdatingId).toHaveBeenCalledWith("tx-1");
            expect(mockSetUpdatingId).toHaveBeenLastCalledWith(null);
            expect(mockSetTransactions).toHaveBeenCalled();
        });

        it("should not update state if error occurs", async () => {
            const mockSetUpdatingId = vi.fn();
            const mockSetTransactions = vi.fn();

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: new Error("Update failed") }),
                }),
            });

            await handleTransactionPaidChange(
                "tx-1",
                true,
                mockSetUpdatingId,
                mockSetTransactions,
            );

            expect(mockSetUpdatingId).toHaveBeenCalledWith("tx-1");
            expect(mockSetUpdatingId).toHaveBeenLastCalledWith(null);
            expect(mockSetTransactions).not.toHaveBeenCalled();
        });

        it("should call setTransactions with correct updater", async () => {
            const mockSetUpdatingId = vi.fn();
            const mockSetTransactions = vi.fn();
            const mockTransactions = [{ id: "tx-1", paid: false }];

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                }),
            });

            await handleTransactionPaidChange(
                "tx-1",
                true,
                mockSetUpdatingId,
                mockSetTransactions,
            );

            // Get the updater function that was passed to setTransactions
            const updater = mockSetTransactions.mock.calls[0][0];
            const result = updater(mockTransactions);

            expect(result[0]).toEqual({ id: "tx-1", paid: true });
        });

        it("should not modify other transactions", async () => {
            const mockSetUpdatingId = vi.fn();
            const mockSetTransactions = vi.fn();
            const mockTransactions = [
                { id: "tx-1", paid: false },
                { id: "tx-2", paid: false },
            ];

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                }),
            });

            await handleTransactionPaidChange(
                "tx-2",
                true,
                mockSetUpdatingId,
                mockSetTransactions,
            );

            const updater = mockSetTransactions.mock.calls[0][0];
            const result = updater(mockTransactions);

            expect(result[0]).toEqual({ id: "tx-1", paid: false });
            expect(result[1]).toEqual({ id: "tx-2", paid: true });
        });
    });
});
