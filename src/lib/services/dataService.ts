import { supabase } from "@/lib/supabase";

export class DataService {
  /**
   * Deletes a purchase and all its associated transactions.
   * @param purchaseId The ID of the purchase to delete.
   */
  static async deletePurchaseAndTransactions(purchaseId: string): Promise<void> {
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
}
