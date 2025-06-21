import { supabase, Purchase, CreditCard, Person } from "@/lib/supabase";

export class DataService {
    /**
     * Deletes a purchase and all its associated transactions.
     * @param purchaseId The ID of the purchase to delete.
     */
    static async deletePurchaseAndTransactions(
        purchaseId: string,
    ): Promise<void> {
        try {
            // First, delete all transactions associated with the purchase_id
            const { error: transactionError } = await supabase
                .from("transactions")
                .delete()
                .eq("purchase_id", purchaseId);

            if (transactionError) {
                console.error("Error deleting transactions:", transactionError);
                throw transactionError;
            }

            // Then, delete the purchase itself
            const { error: purchaseError } = await supabase
                .from("purchases")
                .delete()
                .eq("id", purchaseId);

            if (purchaseError) {
                console.error("Error deleting purchase:", purchaseError);
                throw purchaseError;
            }
        } catch (error) {
            console.error(`Failed to delete purchase ${purchaseId}:`, error);
            throw error;
        }
    }

    static async loadPurchases(): Promise<Purchase[]> {
        try {
            const { data, error } = await supabase
                .from("purchases")
                .select(
                    `
          *,
          credit_cards:credit_card_id(*),
          persons:person_id(*)
        `,
                )
                .order("purchase_date", { ascending: false });

            if (error) throw error;

            // Transform data to match expected format with expand property
            const recordsWithExpand =
                data?.map((purchase) => ({
                    ...purchase,
                    expand: {
                        credit_card: purchase.credit_cards,
                        person: purchase.persons,
                    },
                })) || [];

            return recordsWithExpand;
        } catch (error) {
            console.error("Error loading purchases:", error);
            throw error;
        }
    }

    static async loadCreditCards(): Promise<CreditCard[]> {
        try {
            const { data, error } = await supabase.from("credit_cards").select(`
        *,
        principal_card:principal_card_id(*)
      `);

            if (error) throw error;

            // Transform data to match expected format with expand property
            const recordsWithExpand =
                data?.map((card) => ({
                    ...card,
                    expand: {
                        principal_card: card.principal_card,
                    },
                })) || [];

            return recordsWithExpand;
        } catch (error) {
            console.error("Error loading credit cards:", error);
            throw error;
        }
    }

    static async loadPersons(): Promise<Person[]> {
        try {
            const { data, error } = await supabase.from("persons").select("*");
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error loading persons:", error);
            throw error;
        }
    }

    static async createPurchaseWithTransactions(purchaseData: {
        credit_card_id: string;
        person_id: string;
        purchase_date: string;
        billing_start_date: string;
        total_amount: number;
        description: string;
        num_installments: number;
        is_bnpl: boolean;
    }): Promise<void> {
        try {
            // Insert the purchase and get back the ID
            const { data: purchaseResult, error: purchaseError } =
                await supabase.from("purchases").insert(purchaseData).select();

            if (purchaseError) throw purchaseError;

            if (!purchaseResult || purchaseResult.length === 0) {
                throw new Error("Failed to create purchase");
            }

            const purchase = purchaseResult[0];

            // Create the transactions for installments
            const installmentAmount =
                purchaseData.total_amount / purchaseData.num_installments;

            for (let i = 0; i < purchaseData.num_installments; i++) {
                // Calculate the transaction date based on billing start date
                const startDate = new Date(purchaseData.billing_start_date);
                const transactionDate = new Date(startDate);
                transactionDate.setMonth(startDate.getMonth() + i);

                // Create a transaction for this installment
                const { error: transactionError } = await supabase
                    .from("transactions")
                    .insert({
                        credit_card_id: purchaseData.credit_card_id,
                        person_id: purchaseData.person_id,
                        date: transactionDate.toISOString().split("T")[0],
                        amount: installmentAmount,
                        description:
                            purchaseData.num_installments > 1
                                ? `${purchaseData.description} (Installment ${
                                      i + 1
                                  }/${purchaseData.num_installments})`
                                : purchaseData.description,
                        purchase_id: purchase.id,
                    });

                if (transactionError) throw transactionError;
            }
        } catch (error) {
            console.error("Error creating purchase with transactions:", error);
            throw error;
        }
    }
}
