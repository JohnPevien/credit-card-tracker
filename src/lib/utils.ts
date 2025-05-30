import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from "./supabase"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date string into a more readable format based on the runtime's locale settings.
 * @param {string} dateString - A date string in ISO 8601 format (e.g., "2023-03-15T00:00:00Z").
 * @returns {string} A locale-formatted date string.
 * @remarks The output format depends on the runtime's locale settings and may vary across environments.
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

/**
 * Update the paid status of a transaction
 * @param transactionId The ID of the transaction to update
 * @param paid The new paid status
 * @param setUpdatingId Function to set the ID of the transaction being updated
 * @param setTransactions Function to update the transactions state
 * @returns Promise that resolves when the operation is complete
 */
export async function handleTransactionPaidChange<T extends { id: string; paid: boolean }>(
  transactionId: string,
  paid: boolean,
  setUpdatingId: (id: string | null) => void,
  setTransactions: React.Dispatch<React.SetStateAction<T[]>>
): Promise<void> {
  setUpdatingId(transactionId);
  const { error } = await supabase
    .from("transactions")
    .update({ paid })
    .eq("id", transactionId);
  if (!error) {
    setTransactions((prev: T[]) =>
      prev.map((t) => (t.id === transactionId ? { ...t, paid } : t))
    );
  }
  setUpdatingId(null);
}

