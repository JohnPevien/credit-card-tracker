"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, Transaction, CreditCard } from "@/lib/supabase";
import { formatDate, handleTransactionPaidChange } from "@/lib/utils";
import DataTable from "@/components/DataTable";

export default function PersonTransactionsPage() {
  const { id: personId } = useParams() as { id: string };
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterCard, setFilterCard] = useState<string>("");
  const [filterDescription, setFilterDescription] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");

  const clearFilters = () => {
    setFilterCard("");
    setFilterDescription("");
    setFilterFrom("");
    setFilterTo("");
  };

  useEffect(() => {
    if (personId) {
      loadTransactions();
      loadCreditCards();
    }
  }, [personId]);

  async function loadTransactions() {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          credit_cards:credit_card_id(*),
          persons:person_id(*)
        `
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
    } catch (error) {
      console.error("Error loading person transactions:", error);
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
    handleTransactionPaidChange(transactionId, paid, setUpdatingId, setTransactions);
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tr) => {
      const matchesCard = filterCard
        ? tr.expand?.credit_card?.id === filterCard
        : true;
      const matchesDescription = filterDescription
        ? tr.description.toLowerCase().includes(filterDescription.toLowerCase())
        : true;
      const matchesFrom = filterFrom ? new Date(tr.date) >= new Date(filterFrom) : true;
      const matchesTo = filterTo ? new Date(tr.date) <= new Date(filterTo) : true;
      return matchesCard && matchesDescription && matchesFrom && matchesTo;
    });
  }, [transactions, filterCard, filterDescription, filterFrom, filterTo]);

  return (
    <div className="container space-y-5 mx-auto">
      <button 
        onClick={() => router.back()} 
        className="btn btn-outline mb-4">
        ← Back
      </button>
      <h1 className="text-2xl font-bold mb-4">
        {transactions[0]?.expand?.person?.name || "Person"} Transactions
      </h1>

      <div className="mb-6 p-4 bg-base-200 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Credit Card</label>
            <select
              className="select select-bordered w-full"
              value={filterCard}
              onChange={(e) => setFilterCard(e.target.value)}
            >
              <option value="">All Cards</option>
              {creditCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.credit_card_name || card.issuer} *{card.last_four_digits}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label">Description</label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Filter by description"
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
            />
          </div>
          
          <div>
            <label className="label">From Date</label>
            <input
              type="date"
              className="input input-bordered w-full"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
            />
          </div>
          
          <div>
            <label className="label">To Date</label>
            <input
              type="date"
              className="input input-bordered w-full"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
            />
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            className="btn btn-outline btn-sm"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </div>
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
          { header: "Description", accessorKey: "description" },
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
            header: "Card",
            cell: (transaction: Transaction) =>
              transaction.expand?.credit_card ? (
                <span>
                  {transaction.expand.credit_card.credit_card_name ||
                    transaction.expand.credit_card.issuer}{" "}
                  *{transaction.expand.credit_card.last_four_digits}
                  {transaction.expand.credit_card.is_supplementary &&
                    transaction.expand.credit_card.expand?.principal_card && (
                      <span className="text-xs text-gray-500 block">
                        Supplementary of {transaction.expand.credit_card.expand.principal_card.credit_card_name}
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
