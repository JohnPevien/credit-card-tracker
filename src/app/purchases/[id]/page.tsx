"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDate } from "@/lib/utils";
import DataTable from "@/components/DataTable";
import PurchaseDetailsCard from "@/components/purchases/PurchaseDetailsCard";
import { usePurchaseDetails } from "@/lib/hooks/usePurchaseDetails";
import { CURRENCY_DECIMAL_PLACES } from "@/lib/constants";
import TransactionFilters, {
    TransactionFiltersState,
} from "@/components/transactions/TransactionFilters";

export default function PurchaseDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [filters, setFilters] = useState<TransactionFiltersState>({
        person: "",
        card: "",
        description: "",
        dateFrom: "",
        dateTo: "",
        paidStatus: "all",
    });

    const {
        purchase,
        transactions,
        loading,
        error,
        updateTransactionPaidStatus,
    } = usePurchaseDetails(id);

    // Must call useMemo before any early returns (React Hooks rules)
    const filteredTransactions = useMemo(() => {
        return transactions.filter((tr) => {
            if (filters.paidStatus === "all") return true;
            return filters.paidStatus === "paid" ? tr.paid : !tr.paid;
        });
    }, [transactions, filters.paidStatus]);

    // Handler to update paid status
    async function handlePaidChange(transactionId: string, paid: boolean) {
        setUpdatingId(transactionId);
        try {
            await updateTransactionPaidStatus(transactionId, paid);
        } catch (error) {
            console.error("Error updating transaction:", error);
        } finally {
            setUpdatingId(null);
        }
    }

    if (loading) {
        return (
            <div className="text-center p-8">Loading purchase details...</div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-8">
                <p className="mb-4">{error}</p>
                <Link href="/purchases" className="hover:underline">
                    Back to Purchases
                </Link>
            </div>
        );
    }

    if (!purchase) {
        return (
            <div className="text-center p-8">
                <p className="mb-4">Purchase not found</p>
                <Link href="/purchases" className="hover:underline">
                    Back to Purchases
                </Link>
            </div>
        );
    }

    return (
        <div className="container space-y-5 mx-auto">
            <div className="mb-4">
                <Link href="/purchases" className="hover:underline">
                    &larr; Back to Purchases
                </Link>
            </div>

            <h1 className="heading-page">Purchase Details</h1>

            <PurchaseDetailsCard purchase={purchase} />

            <h2 className="heading-section">Transactions</h2>

            <div className="max-w-md">
                <TransactionFilters
                    config={{
                        showPaidStatus: true,
                    }}
                    filters={filters}
                    onFilterChange={setFilters}
                />
            </div>

            <DataTable
                data={filteredTransactions}
                keyField="id"
                emptyMessage="No transactions found"
                columns={[
                    {
                        header: "Paid",
                        cell: (transaction) => (
                            <input
                                type="checkbox"
                                checked={!!transaction.paid}
                                disabled={updatingId === transaction.id}
                                onChange={(e) =>
                                    handlePaidChange(
                                        transaction.id,
                                        e.target.checked,
                                    )
                                }
                                className="checkbox checkbox-primary"
                                aria-label={
                                    transaction.paid
                                        ? "Mark as unpaid"
                                        : "Mark as paid"
                                }
                            />
                        ),
                    },
                    {
                        header: "Date",
                        cell: (transaction) => formatDate(transaction.date),
                    },
                    {
                        header: "Description",
                        accessorKey: "description",
                    },
                    {
                        header: "Amount",
                        cell: (transaction) =>
                            `₱${transaction.amount.toFixed(
                                CURRENCY_DECIMAL_PLACES,
                            )}`,
                    },
                    {
                        header: "Card",
                        cell: (transaction) =>
                            transaction.expand?.credit_card ? (
                                <span>
                                    {transaction.expand.credit_card
                                        .credit_card_name ||
                                        transaction.expand.credit_card
                                            .issuer}{" "}
                                    ****{" "}
                                    {
                                        transaction.expand.credit_card
                                            .last_four_digits
                                    }
                                    {transaction.expand.credit_card
                                        .is_supplementary && (
                                        <span className="text-sm block">
                                            Supplementary Card
                                        </span>
                                    )}
                                </span>
                            ) : (
                                "Unknown Card"
                            ),
                    },
                ]}
            />
        </div>
    );
}
