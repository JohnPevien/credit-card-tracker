import { supabase, CreditCard, CreditCardInsert } from "@/lib/supabase";

export class CreditCardService {
    static async loadCards(): Promise<CreditCard[]> {
        try {
            const { data, error } = await supabase
                .from("credit_cards")
                .select("*, principal_card:principal_card_id(*)");

            if (error) throw error;

            // Transform data to match the expected format with expand property
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
            throw new Error("Could not load credit cards.");
        }
    }

    static async createCard(cardData: CreditCardInsert): Promise<void> {
        try {
            const { error } = await supabase
                .from("credit_cards")
                .insert(cardData);
            if (error) throw error;
        } catch (error) {
            console.error("Error creating credit card:", error);
            throw new Error("Could not create credit card.");
        }
    }

    static async updateCard(
        cardId: string,
        cardData: CreditCardInsert,
    ): Promise<void> {
        try {
            const { error } = await supabase
                .from("credit_cards")
                .update(cardData)
                .eq("id", cardId);
            if (error) throw error;
        } catch (error) {
            console.error("Error updating credit card:", error);
            throw new Error("Could not update credit card.");
        }
    }

    static async deleteCard(cardId: string): Promise<void> {
        try {
            const { error } = await supabase
                .from("credit_cards")
                .delete()
                .eq("id", cardId);
            if (error) throw error;
        } catch (error) {
            console.error("Error deleting credit card:", error);
            throw new Error("Could not delete credit card.");
        }
    }
}
