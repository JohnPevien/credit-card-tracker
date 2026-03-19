import { CreditCard, Person } from "@/lib/supabase";

export type ImportErrorCategory =
    | "parse"
    | "validation"
    | "reference"
    | "ambiguous"
    | "import";

export interface ImportError {
    row: number;
    field?: string;
    category: ImportErrorCategory;
    message: string;
    suggestion?: string;
}

export interface ParsedCSVRow {
    card_last4: string;
    person_name: string;
    purchase_date: string;
    billing_start_date: string;
    total_amount: number;
    description: string;
    num_installments: number;
    is_bnpl: boolean;
}

export interface InstallmentDetail {
    installmentNumber: number;
    date: string;
    amount: number;
}

export interface PreviewRow {
    rowNumber: number;
    rawData: Record<string, string>;
    parsedData: ParsedCSVRow | null;
    card: CreditCard | null;
    cardOptions?: CreditCard[];
    selectedCardId?: string;
    person: Person | null;
    errors: ImportError[];
    isExpanded: boolean;
}

export interface PreviewSummary {
    totalRows: number;
    validRows: number;
    errorRows: number;
    totalAmount: number;
    totalInstallments: number;
}

export interface PreviewData {
    rows: PreviewRow[];
    summary: PreviewSummary;
}

export interface ImportResult {
    totalImported: number;
    totalFailed: number;
    totalAmount: number;
    totalInstallments: number;
    errors: ImportError[];
}

export type ImportState =
    | { status: "empty" }
    | { status: "uploading"; fileName: string }
    | { status: "preview"; data: PreviewData; errors: ImportError[] }
    | { status: "importing"; progress: number }
    | { status: "success"; summary: ImportResult }
    | { status: "error"; error: string };

export const CSV_EXPECTED_HEADERS = [
    "card_last4",
    "person_name",
    "purchase_date",
    "billing_start_date",
    "total_amount",
    "description",
    "num_installments",
    "is_bnpl",
] as const;

export type CSVHeader = (typeof CSV_EXPECTED_HEADERS)[number];
