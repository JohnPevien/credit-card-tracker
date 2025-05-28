"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, Transaction, CreditCard, Person } from "@/lib/supabase";
import DataTable from "@/components/DataTable";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [formData, setFormData] = useState({
    credit_card_id: "",
    person_id: "",
    date: "",
    amount: "",
    description: "",
    purchase_id: "",
  });
  const [filterPerson, setFilterPerson] = useState<string>("");
  const [filterCard, setFilterCard] = useState<string>("");
  const [filterDescription, setFilterDescription] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");

  const clearFilters = () => {
    setFilterPerson("");
    setFilterCard("");
    setFilterDescription("");
    setFilterFrom("");
    setFilterTo("");
  };

  useEffect(() => {
    loadTransactions();
    loadCreditCards();
    loadPersons();
  }, []);

  async function loadTransactions() {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          credit_cards:credit_card_id(*),
          persons:person_id(*),
          purchases:purchase_id(*)
        `
        )
        .order("date", { ascending: false });

      if (error) throw error;

      // Transform data to match expected format with expand property
      const recordsWithExpand =
        data?.map((transaction) => ({
          ...transaction,
          expand: {
            credit_card: transaction.credit_cards,
            person: transaction.persons,
            purchase: transaction.purchases,
          },
        })) || [];

      setTransactions(recordsWithExpand);
    } catch (error) {
      console.error("Error loading transactions:", error);
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
      date: new Date().toISOString().split("T")[0],
      amount: "",
      description: "",
      purchase_id: "", // No purchase relation for standalone transactions
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
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      // Create the transaction
      const transactionData = {
        ...formData,
        amount: parseFloat(formData.amount),
        // Only include purchase_id field if it has a value
        ...(formData.purchase_id ? { purchase_id: formData.purchase_id } : {}),
      };

      const { error } = await supabase
        .from("transactions")
        .insert(transactionData);

      if (error) throw error;

      closeModal();
      loadTransactions();
    } catch (error) {
      console.error("Error saving transaction:", error);
    }
  }



  // Determine if a transaction is a payment (negative amount)
  function isPayment(amount: number) {
    return amount < 0;
  }

  const filteredTransactions = transactions.filter((tr) => {
    const matchesPerson = filterPerson
      ? tr.expand?.person?.id === filterPerson
      : true;
    const matchesCard = filterCard
      ? tr.expand?.credit_card?.id === filterCard
      : true;
    const matchesDescription = filterDescription
      ? tr.description.toLowerCase().includes(filterDescription.toLowerCase())
      : true;
    const matchesFrom = filterFrom ? new Date(tr.date) >= new Date(filterFrom) : true;
    const matchesTo = filterTo ? new Date(tr.date) <= new Date(filterTo) : true;
    return matchesPerson && matchesCard && matchesDescription && matchesFrom && matchesTo;
  });

  return (
    <div className="container space-y-5 mx-auto">
      <h1 className="text-2xl font-bold mb-4">Transactions</h1>
      <button onClick={openAddModal} className="btn btn-primary">
        Add Transaction
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
        <div className="fieldset">
          <label className="block mb-1">Date Range:</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              className="input input-bordered w-full"
              placeholder="From"
            />
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              className="input input-bordered w-full"
              placeholder="To"
            />
          </div>
        </div>
        <button onClick={clearFilters} className="self-end btn btn-secondary mb-1">
          Clear Filters
        </button>
      </div>
      <DataTable
        data={filteredTransactions}
        keyField="id"
        emptyMessage="No transactions found"
        className="overflow-x-auto"
        columns={[
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
            cell: (transaction) => (
              <span>
                ${Math.abs(transaction.amount).toFixed(2)}
                {isPayment(transaction.amount) ? " (payment)" : ""}
              </span>
            ),
          },
          {
            header: "Card",
            cell: (transaction) =>
              transaction.expand?.credit_card ? (
                <span>
                  {transaction.expand.credit_card.credit_card_name ||
                    transaction.expand.credit_card.issuer}{" "}
                  *{transaction.expand.credit_card.last_four_digits}
                  {transaction.expand.credit_card.is_supplementary &&
                    transaction.expand.credit_card.expand?.principal_card && (
                      <span className="text-xs text-gray-500 block">
                        Supplementary of{" "}
                        {
                          transaction.expand.credit_card.expand.principal_card
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
            cell: (transaction) =>
              transaction.expand?.person?.name || "Unknown",
          },
          {
            header: "Purchase",
            cell: (transaction) =>
              transaction.expand?.purchase ? (
                <Link
                  href={`/purchases/${transaction.purchase_id}`}
                  className="text-blue-500 hover:underline"
                >
                  View
                </Link>
              ) : (
                "N/A"
              ),
          },
        ]}
      />

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <div className="rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Add Transaction</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Credit Card</label>
                <select
                  name="credit_card_id"
                  value={formData.credit_card_id}
                  onChange={handleInputChange}
                  className="select select-bordered w-full"
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
                <label className="block text-gray-700 mb-1">Person</label>
                <select
                  name="person_id"
                  value={formData.person_id}
                  onChange={handleInputChange}
                  className="select select-bordered w-full"
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
                <label className="block text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className="input input-bordered w-full"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">
                  Amount (negative for payments)
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  className="input input-bordered w-full"
                  step="0.01"
                  required
                  placeholder="Use negative value for payments"
                />
                <small className="text-gray-500">
                  Enter a positive amount for purchases or a negative amount for
                  payments (e.g., -50.00)
                </small>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="textarea textarea-bordered w-full"
                  required
                  placeholder="E.g., 'Monthly payment' or 'Refund'"
                ></textarea>
              </div>
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
