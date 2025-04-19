"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase, Purchase, Transaction } from "../../lib/supabase";
import DataTable from "@/components/DataTable";

export default function PurchaseDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null); // For loading state per transaction

  useEffect(() => {
    async function loadPurchaseData() {
      try {
        setLoading(true);

        // Load the purchase details with expanded relations
        const { data: purchaseData, error: purchaseError } = await supabase
          .from("purchases")
          .select(
            `
            *,
            credit_cards:credit_card_id(*),
            persons:person_id(*)
          `
          )
          .eq("id", id)
          .single();

        if (purchaseError) throw purchaseError;

        // Transform to match expected format with expand property
        const purchaseWithExpand = purchaseData
          ? {
              ...purchaseData,
              expand: {
                credit_card: purchaseData.credit_cards,
                person: purchaseData.persons,
              },
            }
          : null;

        setPurchase(purchaseWithExpand);

        // Load the related transactions
        const { data: transactionsData, error: transactionsError } =
          await supabase
            .from("transactions")
            .select(
              `
            *,
            credit_cards:credit_card_id(*),
            persons:person_id(*)
          `
            )
            .eq("purchase_id", id)
            .order("date", { ascending: true });

        if (transactionsError) throw transactionsError;

        // Transform to match expected format with expand property
        const transactionsWithExpand =
          transactionsData?.map((transaction) => ({
            ...transaction,
            expand: {
              credit_card: transaction.credit_cards,
              person: transaction.persons,
            },
          })) || [];

        setTransactions(transactionsWithExpand);
        setLoading(false);
      } catch (error) {
        console.error("Error loading purchase details:", error);
        setError("Failed to load purchase details");
        setLoading(false);
      }
    }

    if (id) {
      loadPurchaseData();
    }
  }, [id]);

  // Format date to a more readable format
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  // Handler to update paid status
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

  if (loading) {
    return <div className="text-center p-8">Loading purchase details...</div>;
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
    <div>
      <div className="mb-4">
        <Link href="/purchases" className="hover:underline">
          &larr; Back to Purchases
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-4">Purchase Details</h1>

      <div className="rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">{purchase.description}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p >Date</p>
            <p className="font-medium">{formatDate(purchase.purchase_date)}</p>
          </div>
          <div>
            <p >Total Amount</p>
            <p className="font-medium">${purchase.total_amount.toFixed(2)}</p>
          </div>
          <div>
            <p >Credit Card</p>
            <p className="font-medium">
              {purchase.expand?.credit_card ? (
                <span>
                  {purchase.expand.credit_card.credit_card_name ||
                    purchase.expand.credit_card.issuer}{" "}
                  **** {purchase.expand.credit_card.last_four_digits}
                  {purchase.expand.credit_card.is_supplementary && (
                    <span className="text-sm block">
                      Supplementary Card
                    </span>
                  )}
                </span>
              ) : (
                "Unknown Card"
              )}
            </p>
          </div>
          <div>
            <p >Person</p>
            <p className="font-medium">
              {purchase.expand?.person
                ? purchase.expand.person.name
                : "Unknown Person"}
            </p>
          </div>
          <div>
            <p >Installments</p>
            <p className="font-medium">{purchase.num_installments}</p>
          </div>
          <div>
            <p >Buy Now Pay Later</p>
            <p className="font-medium">{purchase.is_bnpl ? "Yes" : "No"}</p>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">Transactions</h2>

      <DataTable
        data={transactions}
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
                  handlePaidChange(transaction.id, e.target.checked)
                }
                className="w-5 h-5 accent-green-500"
                aria-label={
                  transaction.paid ? "Mark as unpaid" : "Mark as paid"
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
            cell: (transaction) => `$${transaction.amount.toFixed(2)}`,
          },
          {
            header: "Card",
            cell: (transaction) =>
              transaction.expand?.credit_card ? (
                <span>
                  {transaction.expand.credit_card.credit_card_name ||
                    transaction.expand.credit_card.issuer}{" "}
                  **** {transaction.expand.credit_card.last_four_digits}
                  {transaction.expand.credit_card.is_supplementary && (
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
