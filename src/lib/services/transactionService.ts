import { supabase, Transaction } from "@/lib/supabase";

export class TransactionService {
    static async loadTransactions(filters?: {
        person_id?: string;
        credit_card_id?: string;
        description?: string;
        date_from?: string;
        date_to?: string;
        paid?: boolean;
    }): Promise<Transaction[]> {
        try {
            let query = supabase
                .from("transactions")
                .select(
                    "*, credit_cards:credit_card_id(*), persons:person_id(*), purchases:purchase_id(*)",
                )
                .order("date", { ascending: false });

            if (filters?.person_id) {
                query = query.eq("person_id", filters.person_id);
            }
            if (filters?.credit_card_id) {
                query = query.eq("credit_card_id", filters.credit_card_id);
            }
            if (filters?.description) {
                query = query.ilike("description", `%${filters.description}%`);
            }
            if (filters?.date_from) {
                query = query.gte("date", filters.date_from);
            }
            if (filters?.date_to) {
                query = query.lte("date", filters.date_to);
            }
            if (filters?.paid !== undefined) {
                query = query.eq("paid", filters.paid);
            }

            const { data, error } = await query;

            if (error) throw error;

            const recordsWithExpand =
                data?.map((row) => ({
                    ...row,
                    expand: {
                        credit_card: row.credit_cards,
                        person: row.persons,
                        purchase: row.purchases,
                    },
                })) || [];

            return recordsWithExpand as Transaction[];
        } catch (error) {
            console.error("Error loading transactions:", error);
            throw error;
        }
    }

    static async loadTransaction(id: string): Promise<Transaction | null> {
        try {
            const { data, error } = await supabase
                .from("transactions")
                .select(
                    "*, credit_cards:credit_card_id(*), persons:person_id(*), purchases:purchase_id(*)",
                )
                .eq("id", id)
                .single();

            if (error?.code === "PGRST116") return null;
            if (error) throw error;

            if (!data) return null;

            return {
                ...data,
                expand: {
                    credit_card: data.credit_cards,
                    person: data.persons,
                    purchase: data.purchases,
                },
            } as Transaction;
        } catch (error) {
            console.error("Error loading transaction:", error);
            throw error;
        }
    }
}
