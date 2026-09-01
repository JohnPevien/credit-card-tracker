import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { supabase } from "@/lib/supabase";
import { TransactionService } from "../transactionService";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn(),
    },
}));

const fromMock = supabase.from as unknown as Mock;

function createListQuery(result: { data: unknown; error: unknown }) {
    const query = {
        select: vi.fn(),
        order: vi.fn(),
        eq: vi.fn(),
        ilike: vi.fn(),
        gte: vi.fn(),
        lte: vi.fn(),
        then: (
            resolve: (value: typeof result) => unknown,
            reject: (reason: unknown) => unknown,
        ) => Promise.resolve(result).then(resolve, reject),
    };

    query.select.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.ilike.mockReturnValue(query);
    query.gte.mockReturnValue(query);
    query.lte.mockReturnValue(query);

    return query;
}

describe("TransactionService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads transactions with filters and expanded relations", async () => {
        const data = [
            {
                id: "transaction-1",
                credit_card_id: "card-1",
                person_id: "person-1",
                purchase_id: "purchase-1",
                date: "2026-08-26",
                amount: 25,
                description: "Groceries",
                paid: false,
                credit_cards: { id: "card-1" },
                persons: { id: "person-1" },
                purchases: { id: "purchase-1" },
            },
        ];
        const query = createListQuery({ data, error: null });
        fromMock.mockReturnValue(query);

        const result = await TransactionService.loadTransactions({
            person_id: "person-1",
            credit_card_id: "card-1",
            description: "groc",
            date_from: "2026-08-01",
            date_to: "2026-08-31",
            paid: false,
        });

        expect(supabase.from).toHaveBeenCalledWith("transactions");
        expect(query.order).toHaveBeenCalledWith("date", { ascending: false });
        expect(query.eq).toHaveBeenCalledWith("person_id", "person-1");
        expect(query.eq).toHaveBeenCalledWith("credit_card_id", "card-1");
        expect(query.ilike).toHaveBeenCalledWith("description", "%groc%");
        expect(query.gte).toHaveBeenCalledWith("date", "2026-08-01");
        expect(query.lte).toHaveBeenCalledWith("date", "2026-08-31");
        expect(query.eq).toHaveBeenCalledWith("paid", false);
        expect(result).toEqual([
            expect.objectContaining({
                id: "transaction-1",
                expand: {
                    credit_card: { id: "card-1" },
                    person: { id: "person-1" },
                    purchase: { id: "purchase-1" },
                },
            }),
        ]);
    });

    it("returns an empty array when the list query has no data", async () => {
        const query = createListQuery({ data: null, error: null });
        fromMock.mockReturnValue(query);

        await expect(TransactionService.loadTransactions()).resolves.toEqual(
            [],
        );
    });

    it("propagates list query errors", async () => {
        const query = createListQuery({
            data: null,
            error: new Error("Database unavailable"),
        });
        fromMock.mockReturnValue(query);

        await expect(TransactionService.loadTransactions()).rejects.toThrow(
            "Database unavailable",
        );
    });

    it("loads one transaction with expanded relations", async () => {
        const single = vi.fn().mockResolvedValue({
            data: {
                id: "transaction-1",
                credit_cards: { id: "card-1" },
                persons: { id: "person-1" },
                purchases: { id: "purchase-1" },
            },
            error: null,
        });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        fromMock.mockReturnValue({ select });

        const result =
            await TransactionService.loadTransaction("transaction-1");

        expect(eq).toHaveBeenCalledWith("id", "transaction-1");
        expect(result).toEqual(
            expect.objectContaining({
                id: "transaction-1",
                expand: {
                    credit_card: { id: "card-1" },
                    person: { id: "person-1" },
                    purchase: { id: "purchase-1" },
                },
            }),
        );
    });

    it("returns null when a transaction does not exist", async () => {
        const single = vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116", message: "No rows" },
        });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        fromMock.mockReturnValue({ select });

        await expect(
            TransactionService.loadTransaction("missing-transaction"),
        ).resolves.toBeNull();
    });

    it("propagates unexpected single-record errors", async () => {
        const single = vi.fn().mockResolvedValue({
            data: null,
            error: new Error("Database unavailable"),
        });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        fromMock.mockReturnValue({ select });

        await expect(
            TransactionService.loadTransaction("transaction-1"),
        ).rejects.toThrow("Database unavailable");
    });
});
