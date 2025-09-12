"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Purchase, CreditCard, Person } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PurchaseForm from "@/components/PurchaseForm";
import PurchaseFilters from "@/components/purchases/PurchaseFilters";
import { DataService } from "@/lib/services/dataService";
import { CURRENCY_DECIMAL_PLACES } from "@/lib/constants";
import { LoadingSpinner } from "@/components/base";

export default function PurchasesPage() {
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [persons, setPersons] = useState<Person[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState({
        person: "",
        card: "",
        description: "",
    });

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setIsLoading(true);
            const [purchasesData, creditCardsData, personsData] =
                await Promise.all([
                    DataService.loadPurchases(),
                    DataService.loadCreditCards(),
                    DataService.loadPersons(),
                ]);

            setPurchases(purchasesData);
            setCreditCards(creditCardsData);
            setPersons(personsData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    }

    function openAddModal() {
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
    }

    async function handleFormSubmit(formData: {
        credit_card_id: string;
        person_id: string;
        purchase_date: string;
        billing_start_date: string;
        total_amount: number;
        description: string;
        num_installments: number;
        is_bnpl: boolean;
    }) {
        try {
            await DataService.createPurchaseWithTransactions(formData);
            closeModal();
            await loadData(); // Refresh data
        } catch (error) {
            console.error("Error saving purchase:", error);
            throw error;
        }
    } // Format date to a more readable format
    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString();
    }

    async function handleDeletePurchase(purchaseId: string) {
        if (window.confirm("Are you sure you want to delete this purchase?")) {
            try {
                await DataService.deletePurchaseAndTransactions(purchaseId);
                await loadData(); // Refresh data
            } catch (error) {
                console.error("Failed to delete purchase:", error);
            }
        }
    }

    const filteredPurchases = purchases.filter((purchase) => {
        const matchesPerson = filters.person
            ? purchase.expand?.person?.id === filters.person
            : true;
        const matchesCard = filters.card
            ? purchase.expand?.credit_card?.id === filters.card
            : true;
        const matchesDescription = filters.description
            ? purchase.description
                  .toLowerCase()
                  .includes(filters.description.toLowerCase())
            : true;
        return matchesPerson && matchesCard && matchesDescription;
    });

    if (isLoading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="container space-y-5 mx-auto">
            <h1 className="text-2xl font-bold mb-4">Purchases</h1>
            <button onClick={openAddModal} className="btn btn-primary">
                Add Purchase
            </button>

            <PurchaseFilters
                persons={persons}
                creditCards={creditCards}
                filterPerson={filters.person}
                filterCard={filters.card}
                filterDescription={filters.description}
                onFilterChange={setFilters}
            />

            <DataTable
                data={filteredPurchases}
                keyField="id"
                emptyMessage="No purchases found"
                className="overflow-x-auto"
                columns={[
                    {
                        header: "Date",
                        cell: (purchase) => formatDate(purchase.purchase_date),
                    },
                    {
                        header: "Description",
                        accessorKey: "description",
                    },
                    {
                        header: "Total Amount",
                        cell: (purchase) =>
                            `₱${purchase.total_amount.toFixed(CURRENCY_DECIMAL_PLACES)}`,
                    },
                    {
                        header: "Card",
                        cell: (purchase) =>
                            purchase.expand?.credit_card ? (
                                <span>
                                    {purchase.expand.credit_card
                                        .credit_card_name ||
                                        purchase.expand.credit_card
                                            .last_four_digits}
                                    {purchase.expand.credit_card
                                        .is_supplementary &&
                                        purchase.expand.credit_card.expand
                                            ?.principal_card && (
                                            <span className="text-xs block">
                                                (Supplementary of{" "}
                                                {
                                                    purchase.expand.credit_card
                                                        .expand.principal_card
                                                        .credit_card_name
                                                }
                                                )
                                            </span>
                                        )}
                                </span>
                            ) : (
                                "Unknown Card"
                            ),
                    },
                    {
                        header: "Person",
                        cell: (purchase) => purchase.expand?.person?.name,
                    },
                    {
                        header: "Installments",
                        accessorKey: "num_installments",
                    },
                    {
                        header: "BNPL",
                        cell: (purchase) => (purchase.is_bnpl ? "Yes" : "No"),
                    },
                    {
                        header: "Actions",
                        cell: (purchase: Purchase) => (
                            <div className="flex gap-5 items-center">
                                <Link
                                    href={`/purchases/${purchase.id}`}
                                    className="hover:underline"
                                >
                                    View
                                </Link>
                                <button
                                    onClick={() =>
                                        handleDeletePurchase(purchase.id)
                                    }
                                    className="btn btn-error btn-sm text-white"
                                >
                                    Delete
                                </button>
                            </div>
                        ),
                    },
                ]}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title="Add Purchase"
                className="bg-gray-900"
            >
                <PurchaseForm
                    creditCards={creditCards}
                    persons={persons}
                    onSubmit={handleFormSubmit}
                    onCancel={closeModal}
                />
            </Modal>
        </div>
    );
}
