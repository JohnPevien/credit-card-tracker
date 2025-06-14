"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, Purchase, CreditCard, Person } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PurchaseForm from "@/components/PurchaseForm";
import { Select } from "@/components/base";
import { DataService } from "@/lib/services/dataService";

export default function PurchasesPage() {
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [persons, setPersons] = useState<Person[]>([]);
    const [formData, setFormData] = useState({
        credit_card_id: "",
        person_id: "",
        purchase_date: "",
        billing_start_date: "",
        total_amount: "",
        description: "",
        num_installments: "1",
        is_bnpl: false,
    });
    const [filterPerson, setFilterPerson] = useState<string>("");
    const [filterCard, setFilterCard] = useState<string>("");
    const [filterDescription, setFilterDescription] = useState<string>("");

    const clearFilters = () => {
        setFilterPerson("");
        setFilterCard("");
        setFilterDescription("");
    };

    useEffect(() => {
        loadPurchases();
        loadCreditCards();
        loadPersons();
    }, []);

    async function loadPurchases() {
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

            setPurchases(recordsWithExpand);
        } catch (error) {
            console.error("Error loading purchases:", error);
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

    async function loadPersons() {
        try {
            const { data, error } = await supabase.from("persons").select("*");

            if (error) throw error;
            setPersons(data || []);
        } catch (error) {
            console.error("Error loading persons:", error);
        }
    }

    function openAddModal() {
        // Calculate date one month from now for billing start date
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        setFormData({
            credit_card_id: creditCards.length > 0 ? creditCards[0].id : "",
            person_id: persons.length > 0 ? persons[0].id : "",
            purchase_date: new Date().toISOString().split("T")[0],
            billing_start_date: nextMonth.toISOString().split("T")[0],
            total_amount: "",
            description: "",
            num_installments: "1",
            is_bnpl: false,
        });
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
    }
    function handleInputChange(
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
    ) {
        const { name, value, type } = e.target as HTMLInputElement;

        if (type === "checkbox") {
            const checkbox = e.target as HTMLInputElement;
            setFormData((prev) => ({
                ...prev,
                [name]: checkbox.checked,
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        }
    }

    function handleSelectChange(name: string, value: string) {
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        try {
            const purchaseData = {
                ...formData,
                billing_start_date: formData.billing_start_date,
                total_amount: parseFloat(formData.total_amount),
                num_installments: Math.max(
                    1,
                    parseInt(formData.num_installments),
                ), // ensure value is at least 1
            };

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
                const startDate = new Date(formData.billing_start_date);
                const transactionDate = new Date(startDate);
                transactionDate.setMonth(startDate.getMonth() + i);

                // Create a transaction for this installment
                const { error: transactionError } = await supabase
                    .from("transactions")
                    .insert({
                        credit_card_id: formData.credit_card_id,
                        person_id: formData.person_id,
                        date: transactionDate.toISOString().split("T")[0],
                        amount: installmentAmount,
                        description:
                            purchaseData.num_installments > 1
                                ? `${formData.description} (Installment ${
                                      i + 1
                                  }/${purchaseData.num_installments})`
                                : formData.description,
                        purchase_id: purchase.id,
                    });

                if (transactionError) throw transactionError;
            }

            closeModal();
            loadPurchases();
        } catch (error) {
            console.error("Error saving purchase:", error);
        }
    }

    // Format date to a more readable format
    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString();
    }

    async function handleDeletePurchase(purchaseId: string) {
        if (window.confirm("Are you sure you want to delete this purchase?")) {
            try {
                await DataService.deletePurchaseAndTransactions(purchaseId);
                await loadPurchases(); // Refresh the list of purchases
            } catch (error) {
                console.error("Failed to delete purchase:", error);
            }
        }
    }

    const filteredPurchases = purchases.filter((purchase) => {
        const matchesPerson = filterPerson
            ? purchase.expand?.person?.id === filterPerson
            : true;
        const matchesCard = filterCard
            ? purchase.expand?.credit_card?.id === filterCard
            : true;
        const matchesDescription = filterDescription
            ? purchase.description
                  .toLowerCase()
                  .includes(filterDescription.toLowerCase())
            : true;
        return matchesPerson && matchesCard && matchesDescription;
    });

    return (
        <div className="container space-y-5 mx-auto">
            <h1 className="text-2xl font-bold mb-4">Purchases</h1>
            <button onClick={openAddModal} className="btn btn-primary">
                Add Purchase
            </button>
            <div className="flex gap-4 mb-4 max-w-5xl">
                <div className="form-control">
                    <div className="label">
                        <span className="label-text">Person:</span>
                    </div>
                    <Select
                        value={filterPerson}
                        onChange={setFilterPerson}
                        options={[
                            { value: "", label: "All" },
                            ...persons.map((p) => ({
                                value: p.id,
                                label: p.name,
                            })),
                        ]}
                    />
                </div>
                <div className="form-control">
                    <div className="label">
                        <span className="label-text">Card:</span>
                    </div>
                    <Select
                        value={filterCard}
                        onChange={setFilterCard}
                        options={[
                            { value: "", label: "All" },
                            ...creditCards.map((c) => ({
                                value: c.id,
                                label: `${
                                    c.credit_card_name || c.issuer
                                } **** ${c.last_four_digits}`,
                            })),
                        ]}
                    />
                </div>
                <div className="form-control">
                    <div className="label">
                        <span className="label-text">Description:</span>
                    </div>
                    <input
                        type="text"
                        value={filterDescription}
                        onChange={(e) => setFilterDescription(e.target.value)}
                        placeholder="Search description"
                        className="input input-bordered w-full"
                    />
                </div>
                <button
                    onClick={clearFilters}
                    className="self-end btn btn-secondary mb-1"
                >
                    Clear Filters
                </button>
            </div>
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
                            `$${purchase.total_amount.toFixed(2)}`,
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
                    formData={formData}
                    creditCards={creditCards}
                    persons={persons}
                    onInputChange={handleInputChange}
                    onSelectChange={handleSelectChange}
                    onSubmit={handleSubmit}
                    onCancel={closeModal}
                />
            </Modal>
        </div>
    );
}
