"use client";
import { useState, useEffect } from "react";
import { supabase, Transaction, CreditCard, Person } from "@/lib/supabase";
import { formatDate, handleTransactionPaidChange } from "@/lib/utils";
import DataTable from "@/components/DataTable";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [filterPerson, setFilterPerson] = useState<string>("");
  const [filterCard, setFilterCard] = useState<string>("");
  const [filterDescription, setFilterDescription] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  // Determine if a transaction is a payment (negative amount)
  function isPayment(amount: number) {
    return amount < 0;
  }

  // Handler to update paid status
  function handlePaidChange(transactionId: string, paid: boolean) {
    handleTransactionPaidChange(transactionId, paid, setUpdatingId, setTransactions);
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
            header: "Paid",
            accessorKey: "paid",
            cell: (transaction: Transaction) => (
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={transaction.paid}
                onChange={(e) =>
                  handlePaidChange(transaction.id, e.target.checked)
                }
                disabled={updatingId === transaction.id}
              />
            ),
          },
          {
            header: "Date",
            accessorKey: "date",
            cell: (transaction: Transaction) => formatDate(transaction.date),
          },
          {
            header: "Description",
            accessorKey: "description",
          },
          {
            header: "Amount",
            accessorKey: "amount",
            cell: (transaction: Transaction) => (
              <span>
                ${Math.abs(transaction.amount).toFixed(2)}
                {isPayment(transaction.amount) ? " (payment)" : ""}
              </span>
            ),
          },
          {
            header: "Card", // No accessorKey needed if cell handles everything
            cell: (transaction: Transaction) =>
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
            header: "Person", // No accessorKey needed if cell handles everything
            cell: (transaction: Transaction) =>
              transaction.expand?.person?.name || "Unknown",
          }
        ]}
      />


    </div>
  );
}
