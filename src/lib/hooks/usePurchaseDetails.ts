import { useState, useEffect } from "react";
import { Purchase, Transaction } from "@/lib/supabase";
import { PurchaseService } from "@/lib/services/purchaseService";

export function usePurchaseDetails(id: string) {
    const [purchase, setPurchase] = useState<Purchase | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadPurchaseData() {
            if (!id) return;

            try {
                setLoading(true);
                setError("");

                const {
                    purchase: purchaseData,
                    transactions: transactionsData,
                } = await PurchaseService.loadPurchaseDetails(id);

                setPurchase(purchaseData);
                setTransactions(transactionsData);
            } catch (error) {
                console.error("Error loading purchase details:", error);
                setError("Failed to load purchase details");
            } finally {
                setLoading(false);
            }
        }

        loadPurchaseData();
    }, [id]);

    const updateTransactionPaidStatus = async (
        transactionId: string,
        paid: boolean,
    ) => {
        try {
            await PurchaseService.updateTransactionPaidStatus(
                transactionId,
                paid,
            );
            setTransactions((prev) =>
                prev.map((t) => (t.id === transactionId ? { ...t, paid } : t)),
            );
        } catch (error) {
            console.error("Error updating transaction:", error);
            throw error;
        }
    };

    return {
        purchase,
        transactions,
        loading,
        error,
        updateTransactionPaidStatus,
    };
}
