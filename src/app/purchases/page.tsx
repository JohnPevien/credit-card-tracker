"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, Purchase, CreditCard, Person } from "../lib/supabase";
import DataTable from "@/components/DataTable";

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
        `
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
    setFormData({
      credit_card_id: creditCards.length > 0 ? creditCards[0].id : "",
      person_id: persons.length > 0 ? persons[0].id : "",
      purchase_date: new Date().toISOString().split("T")[0],
      billing_start_date: new Date().toISOString().split("T")[0],
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
    >
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const purchaseData = {
        ...formData,
        billing_start_date: formData.is_bnpl
          ? formData.billing_start_date
          : undefined,
        total_amount: parseFloat(formData.total_amount),
        num_installments: parseInt(formData.num_installments),
      };

      // Insert the purchase and get back the ID
      const { data: purchaseResult, error: purchaseError } = await supabase
        .from("purchases")
        .insert(purchaseData)
        .select();

      if (purchaseError) throw purchaseError;

      if (!purchaseResult || purchaseResult.length === 0) {
        throw new Error("Failed to create purchase");
      }

      const purchase = purchaseResult[0];

      // Create the transactions for installments
      const installmentAmount =
        purchaseData.total_amount / purchaseData.num_installments;

      for (let i = 0; i < purchaseData.num_installments; i++) {
        // Calculate the transaction date
        const startDate = formData.billing_start_date
          ? new Date(formData.billing_start_date)
          : new Date(formData.purchase_date);
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
                ? `${formData.description} (Installment ${i + 1}/${
                    purchaseData.num_installments
                  })`
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

  const filteredPurchases = purchases.filter((purchase) => {
    const matchesPerson = filterPerson
      ? purchase.expand?.person?.id === filterPerson
      : true;
    const matchesCard = filterCard
      ? purchase.expand?.credit_card?.id === filterCard
      : true;
    const matchesDescription = filterDescription
      ? purchase.description.toLowerCase().includes(filterDescription.toLowerCase())
      : true;
    return matchesPerson && matchesCard && matchesDescription;
  });

  return (
    <div className="container space-y-5 mx-auto">
      <h1 className="text-2xl font-bold mb-4">Purchases</h1>
      <button onClick={openAddModal} className="btn btn-primary">
        Add Purchase
      </button>
      <div className="flex gap-4 mb-4 max-w-3xl">
        <div className="fieldset">
          <label className="block mb-1">Person:</label>
          <select
            value={filterPerson}
            onChange={(e) => setFilterPerson(e.target.value)}
            className="select select-bordered w-full"
          >
            <option value="">All</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="fieldset">
          <label className="block mb-1">Card:</label>
          <select
            value={filterCard}
            onChange={(e) => setFilterCard(e.target.value)}
            className="select select-bordered w-full"
          >
            <option value="">All</option>
            {creditCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.credit_card_name || c.issuer} **** {c.last_four_digits}
              </option>
            ))}
          </select>
        </div>
        <div className="fieldset">
          <label className="block mb-1">Description:</label>
          <input
            type="text"
            value={filterDescription}
            onChange={(e) => setFilterDescription(e.target.value)}
            placeholder="Search description"
            className="input input-bordered w-full"
          />
        </div>
        <button onClick={clearFilters} className="self-end btn btn-secondary">
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
            cell: (purchase) => `$${purchase.total_amount.toFixed(2)}`,
          },
          {
            header: "Card",
            cell: (purchase) =>
              purchase.expand?.credit_card ? (
                <span>
                  {purchase.expand.credit_card.credit_card_name ||
                    purchase.expand.credit_card.last_four_digits}
                  {purchase.expand.credit_card.is_supplementary &&
                    purchase.expand.credit_card.expand?.principal_card && (
                      <span className="text-xs block">
                        (Supplementary of{" "}
                        {
                          purchase.expand.credit_card.expand.principal_card
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
            header: "Details",
            cell: (purchase) => (
              <Link
                href={`/purchases/${purchase.id}`}
                className="hover:underline"
              >
                View
              </Link>
            ),
          },
        ]}
      />

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <div className="rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Add Purchase</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block mb-1">Credit Card</label>
                <select
                  name="credit_card_id"
                  value={formData.credit_card_id}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                >
                  {creditCards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.credit_card_name || card.issuer} ****{" "}
                      {card.last_four_digits}
                      {card.is_supplementary ? " (Supplementary)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block mb-1">Person</label>
                <select
                  name="person_id"
                  value={formData.person_id}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                >
                  {persons.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block mb-1">Date</label>
                <input
                  type="date"
                  name="purchase_date"
                  value={formData.purchase_date}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Total Amount</label>
                <input
                  type="number"
                  name="total_amount"
                  value={formData.total_amount}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                ></textarea>
              </div>
              <div className="mb-4">
                <label className="block mb-1">Number of Installments</label>
                <input
                  type="number"
                  name="num_installments"
                  value={formData.num_installments}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  min="1"
                  required
                />
              </div>
              <div className="mb-4 flex items-center">
                <input
                  type="checkbox"
                  name="is_bnpl"
                  checked={formData.is_bnpl}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                <label>Buy Now Pay Later (BNPL)</label>
              </div>
              {formData.is_bnpl && (
                <div className="mb-4">
                  <label className="block mb-1">Billing Start Date</label>
                  <input
                    type="date"
                    name="billing_start_date"
                    value={formData.billing_start_date}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
