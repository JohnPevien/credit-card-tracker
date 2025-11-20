"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, Transaction, CreditCard } from "@/lib/supabase";
import { formatDate, handleTransactionPaidChange } from "@/lib/utils";
import DataTable from "@/components/DataTable";
import { CURRENCY_DECIMAL_PLACES } from "@/lib/constants";
import TransactionFilters, {
    TransactionFiltersState,
} from "@/components/transactions/TransactionFilters";

export default function PersonTransactionsPage() {
    const { id: personId } = useParams() as { id: string };
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<TransactionFiltersState>({
        person: "",
        card: "",
        description: "",
        dateFrom: "",
        dateTo: "",
        paidStatus: "all",
    });

    useEffect(() => {
        if (personId) {
            loadTransactions();
            loadCreditCards();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [personId]);

    async function loadTransactions() {
        try {
            setError(null);
            const { data, error } = await supabase
                .from("transactions")
                .select(
                    `
          *,
          credit_cards:credit_card_id(*),
          persons:person_id(*)
        `,
                )
                .eq("person_id", personId)
                .order("date", { ascending: false });

            if (error) throw error;

            const recordsWithExpand =
                data?.map((transaction) => ({
                    ...transaction,
                    expand: {
                        credit_card: transaction.credit_cards,
                        person: transaction.persons,
                    },
                })) || [];
            setTransactions(recordsWithExpand);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load transactions",
            );
            console.error("Error loading person transactions:", err);
        }
    }

    async function loadCreditCards() {
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

            setCreditCards(recordsWithExpand);
        } catch (error) {
            console.error("Error loading credit cards:", error);
        }
    }

    const isPayment = (amount: number) => amount < 0;

    function handlePaidChange(transactionId: string, paid: boolean) {
        handleTransactionPaidChange(
            transactionId,
            paid,
            setUpdatingId,
            setTransactions,
        );
    }

    const filteredTransactions = useMemo(() => {
        return transactions.filter((tr) => {
            const matchesCard = filters.card
                ? tr.expand?.credit_card?.id === filters.card
                : true;
            const matchesDescription = filters.description
                ? tr.description
                      .toLowerCase()
                      .includes(filters.description.toLowerCase())
                : true;
            const matchesFrom = filters.dateFrom
                ? new Date(tr.date) >= new Date(filters.dateFrom)
                : true;
            const matchesTo = filters.dateTo
                ? new Date(tr.date) <= new Date(filters.dateTo)
                : true;
            const matchesPaid =
                filters.paidStatus === "all"
                    ? true
                    : filters.paidStatus === "paid"
                      ? tr.paid
                      : !tr.paid;
            return (
                matchesCard &&
                matchesDescription &&
                matchesFrom &&
                matchesTo &&
                matchesPaid
            );
        });
    }, [transactions, filters]);

    return (
        <div className="container space-y-5 mx-auto">
            {error && (
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                    <button
                        onClick={loadTransactions}
                        className="btn btn-sm btn-primary"
                    >
                        Retry
                    </button>
                </div>
            )}
            <button
                onClick={() => router.back()}
                className="btn btn-outline mb-4"
            >
                ← Back
            </button>
            <h1 className="heading-page">
                {transactions[0]?.expand?.person?.name || "Person"} Transactions
            </h1>

            <TransactionFilters
                config={{
                    showCard: true,
                    showDescription: true,
                    showDateRange: true,
                    showPaidStatus: true,
                }}
                filters={filters}
                onFilterChange={setFilters}
                creditCards={creditCards}
            />

            <DataTable
                data={filteredTransactions}
                keyField="id"
                emptyMessage="No transactions found"
                className="overflow-x-auto"
                columns={[
                    {
                        header: "Paid",
                        accessorKey: "paid",
                        cell: (transaction: Transaction) => (
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary"
                                checked={transaction.paid}
                                onChange={(e) =>
                                    handlePaidChange(
                                        transaction.id,
                                        e.target.checked,
                                    )
                                }
                                disabled={updatingId === transaction.id}
                            />
                        ),
                    },
                    {
                        header: "Date",
                        accessorKey: "date",
                        cell: (transaction: Transaction) =>
                            formatDate(transaction.date),
                    },
                    { header: "Description", accessorKey: "description" },
                    {
                        header: "Amount",
                        accessorKey: "amount",
                        cell: (transaction: Transaction) => (
                            <span>
                                ₱
                                {Math.abs(transaction.amount).toFixed(
                                    CURRENCY_DECIMAL_PLACES,
                                )}
                                {isPayment(transaction.amount)
                                    ? " (payment)"
                                    : ""}
                            </span>
                        ),
                    },
                    {
                        header: "Card",
                        cell: (transaction: Transaction) =>
                            transaction.expand?.credit_card ? (
                                <span>
                                    {transaction.expand.credit_card
                                        .credit_card_name ||
                                        transaction.expand.credit_card
                                            .issuer}{" "}
                                    *
                                    {
                                        transaction.expand.credit_card
                                            .last_four_digits
                                    }
                                    {transaction.expand.credit_card
                                        .is_supplementary &&
                                        transaction.expand.credit_card.expand
                                            ?.principal_card && (
                                            <span className="text-xs text-gray-500 block">
                                                Supplementary of{" "}
                                                {
                                                    transaction.expand
                                                        .credit_card.expand
                                                        .principal_card
                                                        .credit_card_name
                                                }
                                            </span>
                                        )}
                                </span>
                            ) : (
                                "Unknown Card"
                            ),
                    },
                    {
                        header: "Person",
                        cell: (transaction: Transaction) =>
                            transaction.expand?.person?.name || "Unknown",
                    },
                ]}
            />
        </div>
    );
}
