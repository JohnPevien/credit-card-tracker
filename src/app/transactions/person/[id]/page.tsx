"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase, Transaction } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import DataTable from "@/components/DataTable";

export default function PersonTransactionsPage() {
  const { id: personId } = useParams() as { id: string };
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (personId) loadTransactions();
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

  const isPayment = (amount: number) => amount < 0;

  async function handlePaidChange(transactionId: string, paid: boolean) {
    setUpdatingId(transactionId);
    const { error } = await supabase
      .from("transactions")
      .update({ paid })
      .eq("id", transactionId);
    if (!error) {
      setTransactions((prev) =>
        prev.map((t) => (t.id === transactionId ? { ...t, paid } : t))
      );
    }
    setUpdatingId(null);
  }

  return (
    <div className="container space-y-5 mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        {transactions[0]?.expand?.person?.name || "Person"} Transactions
      </h1>
      <DataTable
        data={transactions}
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
