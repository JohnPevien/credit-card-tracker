import { supabase, Purchase, Transaction } from "@/lib/supabase";

export class PurchaseService {
    static async loadPurchaseDetails(id: string): Promise<{
        purchase: Purchase | null;
        transactions: Transaction[];
    }> {
        try {
            // Load the purchase details with expanded relations
            const { data: purchaseData, error: purchaseError } = await supabase
                .from("purchases")
                .select(
                    `
          *,
          credit_cards:credit_card_id(*),
          persons:person_id(*)
        `,
                )
                .eq("id", id)
                .single();

            if (purchaseError) throw purchaseError;

            // Transform to match expected format with expand property
            const purchaseWithExpand = purchaseData
                ? {
                      ...purchaseData,
                      expand: {
                          credit_card: purchaseData.credit_cards,
                          person: purchaseData.persons,
                      },
                  }
                : null;

            // Load the related transactions
            const { data: transactionsData, error: transactionsError } =
                await supabase
                    .from("transactions")
                    .select(
                        `
          *,
          credit_cards:credit_card_id(*),
          persons:person_id(*)
        `,
                    )
                    .eq("purchase_id", id)
                    .order("date", { ascending: true });

            if (transactionsError) throw transactionsError;

            // Transform to match expected format with expand property
            const transactionsWithExpand =
                transactionsData?.map((transaction) => ({
                    ...transaction,
                    expand: {
                        credit_card: transaction.credit_cards,
                        person: transaction.persons,
                    },
                })) || [];

            return {
                purchase: purchaseWithExpand,
                transactions: transactionsWithExpand,
            };
        } catch (error) {
            console.error("Error loading purchase details:", error);
            throw error;
        }
    }

    static async updateTransactionPaidStatus(
        transactionId: string,
        paid: boolean,
    ): Promise<void> {
        try {
            const { error } = await supabase
                .from("transactions")
                .update({ paid })
                .eq("id", transactionId);

            if (error) throw error;
        } catch (error) {
            console.error("Error updating transaction paid status:", error);
            throw error;
        }
    }
}
