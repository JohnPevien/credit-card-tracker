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
    const [metaLoading, setMetaLoading] = useState(false);
    const [metaLoaded, setMetaLoaded] = useState(false);

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }

        setPurchase(null);
        setTransactions([]);
        setCreditCards([]);
        setPersons([]);
        setMetaLoaded(false);
        setMetaLoading(false);
        setError("");

        async function loadPurchaseData() {
            try {
                setLoading(true);

                const { purchase: purchaseData, transactions: transactionsData } =
                    await PurchaseService.loadPurchaseDetails(id);

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

    const loadEditMeta = async () => {
        if (metaLoaded || metaLoading) return;
        setMetaLoading(true);
        try {
            const [creditCardsData, personsData] = await Promise.all([
                DataService.loadCreditCards(),
                DataService.loadPersons(),
            ]);
            setCreditCards(creditCardsData);
            setPersons(personsData);
            setMetaLoaded(true);
        } catch (error) {
            console.error("Error loading edit metadata:", error);
            throw error;
        } finally {
            setMetaLoading(false);
        }
    };

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
        metaLoading,
        error,
        updateTransactionPaidStatus,
        updatePurchase,
        updatePurchaseWithCascade,
        updatePurchaseFull,
        loadEditMeta,
    };
}
