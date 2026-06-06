import { useState, useEffect } from "react";
import { Purchase, Transaction, CreditCard, Person } from "@/lib/supabase";
import { PurchaseService } from "@/lib/services/purchaseService";
import { DataService } from "@/lib/services/dataService";

export function usePurchaseDetails(id: string) {
    const [purchase, setPurchase] = useState<Purchase | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [persons, setPersons] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        setPurchase(null);
        setTransactions([]);
        setError("");

        async function loadPurchaseData() {
            if (!id) return;

            try {
                setLoading(true);

                const [
                    { purchase: purchaseData, transactions: transactionsData },
                    creditCardsData,
                    personsData,
                ] = await Promise.all([
                    PurchaseService.loadPurchaseDetails(id),
                    DataService.loadCreditCards(),
                    DataService.loadPersons(),
                ]);

                setPurchase(purchaseData);
                setTransactions(transactionsData);
                setCreditCards(creditCardsData);
                setPersons(personsData);
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

    const updatePurchase = async (data: {
        description?: string;
        purchase_date?: string;
        is_bnpl?: boolean;
    }) => {
        try {
            const updatedPurchase = await PurchaseService.updatePurchase(
                id,
                data,
            );
            setPurchase(updatedPurchase);
        } catch (error) {
            console.error("Error updating purchase:", error);
            throw error;
        }
    };

    const updatePurchaseWithCascade = async (data: {
        description?: string;
        purchase_date?: string;
        is_bnpl?: boolean;
        credit_card_id?: string;
        person_id?: string;
    }) => {
        try {
            const updatedPurchase =
                await PurchaseService.updatePurchaseWithCascade(id, data);
            setPurchase(updatedPurchase);
            if (data.credit_card_id || data.person_id) {
                setTransactions((prev) =>
                    prev.map((t) => ({
                        ...t,
                        ...(data.credit_card_id
                            ? { credit_card_id: data.credit_card_id }
                            : {}),
                        ...(data.person_id ? { person_id: data.person_id } : {}),
                        expand: {
                            ...t.expand,
                            ...(data.credit_card_id
                                ? {
                                      credit_card:
                                          updatedPurchase.expand?.credit_card,
                                  }
                                : {}),
                            ...(data.person_id
                                ? { person: updatedPurchase.expand?.person }
                                : {}),
                        },
                    })),
                );
            }
        } catch (error) {
            console.error("Error updating purchase with cascade:", error);
            throw error;
        }
    };

    const updatePurchaseFull = async (data: {
        description?: string;
        purchase_date?: string;
        is_bnpl?: boolean;
        credit_card_id?: string;
        person_id?: string;
        total_amount?: number;
        billing_start_date?: string;
        num_installments?: number;
    }) => {
        try {
            const {
                purchase: updatedPurchase,
                transactions: updatedTransactions,
            } = await PurchaseService.updatePurchaseFull(id, data);
            setPurchase(updatedPurchase);
            setTransactions(updatedTransactions);
        } catch (error) {
            console.error("Error updating purchase (full):", error);
            throw error;
        }
    };

    return {
        purchase,
        transactions,
        creditCards,
        persons,
        loading,
        error,
        updateTransactionPaidStatus,
        updatePurchase,
        updatePurchaseWithCascade,
        updatePurchaseFull,
    };
}
