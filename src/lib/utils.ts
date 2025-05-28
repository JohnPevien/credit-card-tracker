import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date to a more readable format
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

