import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "./supabase";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
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
 * Formats an amount as Philippine Peso (PHP)
 * @param amount The amount to format
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number): string {
    return `₱${Math.abs(amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/**
 * Update the paid status of a transaction
 * @param transactionId The ID of the transaction to update
 * @param paid The new paid status
 * @param setUpdatingId Function to set the ID of the transaction being updated
 * @param setTransactions Function to update the transactions state
 * @returns Promise that resolves when the operation is complete
 */
export async function handleTransactionPaidChange<
    T extends { id: string; paid: boolean },
>(
    transactionId: string,
    paid: boolean,
    setUpdatingId: (id: string | null) => void,
    setTransactions: React.Dispatch<React.SetStateAction<T[]>>,
): Promise<void> {
    setUpdatingId(transactionId);
    const { error } = await supabase
        .from("transactions")
        .update({ paid })
        .eq("id", transactionId);
    if (!error) {
        setTransactions((prev: T[]) =>
            prev.map((t) => (t.id === transactionId ? { ...t, paid } : t)),
        );
    }
    setUpdatingId(null);
}

/**
 * Adds months to a date string (YYYY-MM-DD) preserving month-end clamping behavior (Postgres semantics).
 * E.g., Jan 31 + 1 month = Feb 28 (or 29 in leap year), not March 3rd.
 * @param dateStr Date string in YYYY-MM-DD format
 * @param monthsToAdd Number of months to add
 * @returns Date string in YYYY-MM-DD format
 */
export function addMonthsPreservingMonthEnd(dateStr: string, monthsToAdd: number): string {
    const [yearStr, monthStr, dayStr] = dateStr.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // 0-indexed month
    const day = parseInt(dayStr, 10);

    let targetMonth = month + monthsToAdd;
    const targetYear = year + Math.floor(targetMonth / 12);
    targetMonth = ((targetMonth % 12) + 12) % 12; // handle negative offset if any

    const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const daysInMonths = [31, isLeapYear(targetYear) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const targetDay = Math.min(day, daysInMonths[targetMonth]);

    const formattedMonth = String(targetMonth + 1).padStart(2, "0");
    const formattedDay = String(targetDay).padStart(2, "0");

    return `${targetYear}-${formattedMonth}-${formattedDay}`;
}
