"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Person } from "@/lib/supabase";
import { DataService } from "@/lib/services/dataService";
import {
    ImportState,
    PreviewRow,
    ImportError,
    ParsedCSVRow,
    CSV_EXPECTED_HEADERS,
} from "@/lib/types/csv-import";
import { LoadingSpinner } from "@/components/base";
import { ArrowLeft, Download } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const CSV_TEMPLATE_CONTENT = `card_last4,person_name,purchase_date,billing_start_date,total_amount,description,num_installments,is_bnpl
1234,John Doe,2024-03-15,2024-04-01,15000.00,MacBook Pro,12,false
5678,Jane Smith,2024-03-20,2024-04-15,5000.00,iPhone 15,6,true
9012,John Doe,2024-03-25,2024-05-01,2500.00,AirPods Pro,1,false`;

function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE_CONTENT], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "purchase_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCSV(content: string): {
    headers: string[];
    rows: Record<string, string>[];
    errors: ImportError[];
} {
    const lines = content.trim().split("\n");
    const errors: ImportError[] = [];

    if (lines.length < 2) {
        return {
            headers: [],
            rows: [],
            errors: [
                {
                    row: 0,
                    category: "parse",
                    message:
                        "CSV file must have headers and at least one data row",
                },
            ],
        };
    }

    const headers = parseCSVLine(lines[0]);
    const missingHeaders = CSV_EXPECTED_HEADERS.filter(
        (h) => !headers.includes(h),
    );

    if (missingHeaders.length > 0) {
        errors.push({
            row: 0,
            category: "parse",
            message: `Missing required headers: ${missingHeaders.join(", ")}`,
            suggestion: "Download the template to see the correct format",
        });
    }

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
            const values = parseCSVLine(lines[i]);
            const row: Record<string, string> = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || "";
            });
            rows.push(row);
        }
    }

    return { headers, rows, errors };
}

function validateRow(
    row: Record<string, string>,
    rowNumber: number,
): { data: ParsedCSVRow | null; errors: ImportError[] } {
    const errors: ImportError[] = [];

    const cardLast4 = row.card_last4 || "";
    if (!/^\d{4}$/.test(cardLast4)) {
        errors.push({
            row: rowNumber,
            field: "card_last4",
            category: "validation",
            message: "Card last 4 digits must be exactly 4 numeric characters",
        });
    }

    const personName = row.person_name || "";
    if (!personName.trim()) {
        errors.push({
            row: rowNumber,
            field: "person_name",
            category: "validation",
            message: "Person name is required",
        });
    }

    const purchaseDate = row.purchase_date || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
        errors.push({
            row: rowNumber,
            field: "purchase_date",
            category: "validation",
            message: "Purchase date must be in YYYY-MM-DD format",
        });
    }

    const billingStartDate = row.billing_start_date || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(billingStartDate)) {
        errors.push({
            row: rowNumber,
            field: "billing_start_date",
            category: "validation",
            message: "Billing start date must be in YYYY-MM-DD format",
        });
    }

    const totalAmountStr = row.total_amount || "";
    const totalAmount = parseFloat(totalAmountStr);
    if (isNaN(totalAmount) || totalAmount <= 0) {
        errors.push({
            row: rowNumber,
            field: "total_amount",
            category: "validation",
            message: "Total amount must be a positive number",
        });
    }

    const description = row.description || "";
    if (!description.trim()) {
        errors.push({
            row: rowNumber,
            field: "description",
            category: "validation",
            message: "Description is required",
        });
    }

    const numInstallmentsStr = row.num_installments || "";
    const numInstallments = parseInt(numInstallmentsStr, 10);
    if (isNaN(numInstallments) || numInstallments < 1) {
        errors.push({
            row: rowNumber,
            field: "num_installments",
            category: "validation",
            message: "Number of installments must be at least 1",
        });
    }

    const isBnplStr = (row.is_bnpl || "false").toLowerCase().trim();
    let isBnpl = false;
    if (isBnplStr === "true" || isBnplStr === "1" || isBnplStr === "yes") {
        isBnpl = true;
    } else if (
        isBnplStr !== "false" &&
        isBnplStr !== "0" &&
        isBnplStr !== "no" &&
        isBnplStr !== ""
    ) {
        errors.push({
            row: rowNumber,
            field: "is_bnpl",
            category: "validation",
            message: "is_bnpl must be 'true' or 'false'",
        });
    }

    if (errors.length > 0) {
        return { data: null, errors };
    }

    return {
        data: {
            card_last4: cardLast4,
            person_name: personName,
            purchase_date: purchaseDate,
            billing_start_date: billingStartDate,
            total_amount: totalAmount,
            description: description,
            num_installments: numInstallments,
            is_bnpl: isBnpl,
        },
        errors: [],
    };
}

function matchReferences(
    parsedData: ParsedCSVRow,
    rowNumber: number,
    cards: CreditCard[],
    persons: Person[],
): {
    card: CreditCard | null;
    cardOptions?: CreditCard[];
    person: Person | null;
    errors: ImportError[];
} {
    const errors: ImportError[] = [];

    const matchingCards = cards.filter(
        (c) => c.last_four_digits === parsedData.card_last4,
    );

    let card: CreditCard | null = null;
    let cardOptions: CreditCard[] | undefined;

    if (matchingCards.length === 0) {
        errors.push({
            row: rowNumber,
            field: "card_last4",
            category: "reference",
            message: `No card found ending in '${parsedData.card_last4}'`,
            suggestion: "Create the card first or check the last 4 digits",
        });
    } else if (matchingCards.length === 1) {
        card = matchingCards[0];
    } else {
        cardOptions = matchingCards;
        errors.push({
            row: rowNumber,
            field: "card_last4",
            category: "ambiguous",
            message: `Multiple cards found ending in '${parsedData.card_last4}'`,
            suggestion: "Select the correct card from the dropdown",
        });
    }

    const matchingPerson = persons.find(
        (p) => p.name.toLowerCase() === parsedData.person_name.toLowerCase(),
    );

    if (!matchingPerson) {
        errors.push({
            row: rowNumber,
            field: "person_name",
            category: "reference",
            message: `No person found with name '${parsedData.person_name}'`,
            suggestion: "Create the person first or check the spelling",
        });
    }

    return {
        card,
        cardOptions,
        person: matchingPerson || null,
        errors,
    };
}

export default function ImportPurchasesPage() {
    const router = useRouter();
    const [state, setState] = useState<ImportState>({ status: "empty" });
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [persons, setPersons] = useState<Person[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const [cardsData, personsData] = await Promise.all([
                    DataService.loadCreditCards(),
                    DataService.loadPersons(),
                ]);
                setCreditCards(cardsData);
                setPersons(personsData);
            } catch (error) {
                console.error("Error loading reference data:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, []);

    const handleFileUpload = useCallback(
        async (file: File) => {
            setState({ status: "uploading", fileName: file.name });

            try {
                const content = await file.text();
                const { rows, errors: parseErrors } = parseCSV(content);

                if (parseErrors.length > 0) {
                    setState({
                        status: "preview",
                        data: {
                            rows: [],
                            summary: {
                                totalRows: 0,
                                validRows: 0,
                                errorRows: 0,
                                totalAmount: 0,
                                totalInstallments: 0,
                            },
                        },
                        errors: parseErrors,
                    });
                    return;
                }

                const previewRows: PreviewRow[] = rows.map((row, index) => {
                    const rowNumber = index + 1;
                    const { data: parsedData, errors: validationErrors } =
                        validateRow(row, rowNumber);

                    let card: CreditCard | null = null;
                    let cardOptions: CreditCard[] | undefined;
                    let person: Person | null = null;
                    let referenceErrors: ImportError[] = [];

                    if (parsedData) {
                        const refResult = matchReferences(
                            parsedData,
                            rowNumber,
                            creditCards,
                            persons,
                        );
                        card = refResult.card;
                        cardOptions = refResult.cardOptions;
                        person = refResult.person;
                        referenceErrors = refResult.errors;
                    }

                    return {
                        rowNumber,
                        rawData: row,
                        parsedData,
                        card,
                        cardOptions,
                        person,
                        errors: [...validationErrors, ...referenceErrors],
                        isExpanded: false,
                    };
                });

                const validRows = previewRows.filter(
                    (r) =>
                        r.errors.length === 0 ||
                        r.errors.every((e) => e.category === "ambiguous"),
                );
                const errorRows = previewRows.filter((r) =>
                    r.errors.some((e) => e.category !== "ambiguous"),
                );

                const totalAmount = validRows.reduce(
                    (sum, r) => sum + (r.parsedData?.total_amount || 0),
                    0,
                );
                const totalInstallments = validRows.reduce(
                    (sum, r) => sum + (r.parsedData?.num_installments || 0),
                    0,
                );

                setState({
                    status: "preview",
                    data: {
                        rows: previewRows,
                        summary: {
                            totalRows: previewRows.length,
                            validRows: validRows.length,
                            errorRows: errorRows.length,
                            totalAmount,
                            totalInstallments,
                        },
                    },
                    errors: [],
                });
            } catch (error) {
                setState({
                    status: "error",
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to parse CSV",
                });
            }
        },
        [creditCards, persons],
    );

    const handleCardSelect = useCallback(
        (rowNumber: number, cardId: string) => {
            if (state.status !== "preview") return;

            const selectedCard = creditCards.find((c) => c.id === cardId);
            if (!selectedCard) return;

            setState((prev) => {
                if (prev.status !== "preview") return prev;

                const updatedRows = prev.data.rows.map((row) => {
                    if (row.rowNumber === rowNumber) {
                        return {
                            ...row,
                            card: selectedCard,
                            selectedCardId: cardId,
                            errors: row.errors.filter(
                                (e) => e.category !== "ambiguous",
                            ),
                        };
                    }
                    return row;
                });

                const validRows = updatedRows.filter(
                    (r) => r.errors.length === 0,
                );

                return {
                    ...prev,
                    data: {
                        ...prev.data,
                        rows: updatedRows,
                        summary: {
                            ...prev.data.summary,
                            validRows: validRows.length,
                            errorRows: updatedRows.length - validRows.length,
                            totalAmount: validRows.reduce(
                                (sum, r) =>
                                    sum + (r.parsedData?.total_amount || 0),
                                0,
                            ),
                            totalInstallments: validRows.reduce(
                                (sum, r) =>
                                    sum + (r.parsedData?.num_installments || 0),
                                0,
                            ),
                        },
                    },
                };
            });
        },
        [creditCards, state.status],
    );

    const handleImport = useCallback(async () => {
        if (state.status !== "preview") return;

        const validRows = state.data.rows.filter((r) => r.errors.length === 0);
        let imported = 0;
        let failed = 0;
        const errors: ImportError[] = [];

        setState({ status: "importing", progress: 0 });

        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];

            if (!row.parsedData || !row.card || !row.person) {
                failed++;
                continue;
            }

            try {
                await DataService.createPurchaseWithTransactions({
                    credit_card_id: row.card.id,
                    person_id: row.person.id,
                    purchase_date: row.parsedData.purchase_date,
                    billing_start_date: row.parsedData.billing_start_date,
                    total_amount: row.parsedData.total_amount,
                    description: row.parsedData.description,
                    num_installments: row.parsedData.num_installments,
                    is_bnpl: row.parsedData.is_bnpl,
                });
                imported++;
            } catch (error) {
                failed++;
                errors.push({
                    row: row.rowNumber,
                    category: "import",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Failed to import",
                });
            }

            setState({
                status: "importing",
                progress: (i + 1) / validRows.length,
            });
        }

        setState({
            status: "success",
            summary: {
                totalImported: imported,
                totalFailed: failed,
                totalAmount: validRows
                    .filter((r) => r.parsedData)
                    .reduce(
                        (sum, r) => sum + (r.parsedData!.total_amount || 0),
                        0,
                    ),
                totalInstallments: validRows
                    .filter((r) => r.parsedData)
                    .reduce(
                        (sum, r) => sum + (r.parsedData!.num_installments || 0),
                        0,
                    ),
                errors,
            },
        });
    }, [state]);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith(".csv")) {
                handleFileUpload(file);
            }
        },
        [handleFileUpload],
    );

    const handleFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                handleFileUpload(file);
            }
        },
        [handleFileUpload],
    );

    const resetState = useCallback(() => {
        setState({ status: "empty" });
    }, []);

    if (isLoading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="container space-y-5 mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/purchases")}
                        className="btn btn-ghost btn-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>
                    <h1 className="heading-page">Import Purchases</h1>
                </div>
                <button
                    onClick={downloadTemplate}
                    className="btn btn-outline btn-sm"
                >
                    <Download className="w-4 h-4" />
                    Download Template
                </button>
            </div>

            {state.status === "empty" && (
                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-base-300 rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
                >
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                        id="csv-upload"
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer">
                        <div className="text-4xl mb-4">📄</div>
                        <p className="text-lg font-medium">
                            Drop CSV file here or click to browse
                        </p>
                        <p className="text-sm text-base-content/60 mt-2">
                            Supported format: .csv
                        </p>
                    </label>
                </div>
            )}

            {state.status === "uploading" && (
                <div className="flex items-center justify-center p-12">
                    <span className="loading loading-spinner loading-lg"></span>
                    <span className="ml-4">Processing {state.fileName}...</span>
                </div>
            )}

            {state.status === "preview" && (
                <div className="space-y-4">
                    {state.errors.length > 0 && (
                        <div className="alert alert-error">
                            <div className="flex flex-col gap-2">
                                {state.errors.map((error, i) => (
                                    <span key={i}>{error.message}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="card bg-base-200">
                        <div className="card-body">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="card-title">Preview</h2>
                                <span className="badge badge-primary">
                                    {state.data.summary.validRows} valid /{" "}
                                    {state.data.summary.totalRows} total
                                </span>
                            </div>

                            <div className="space-y-3">
                                {state.data.rows.map((row) => (
                                    <div
                                        key={row.rowNumber}
                                        className={`card bg-base-100 ${
                                            row.errors.length > 0
                                                ? "border border-error"
                                                : ""
                                        }`}
                                    >
                                        <div className="card-body p-4">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="font-medium">
                                                        {row.parsedData
                                                            ?.description ||
                                                            row.rawData
                                                                .description ||
                                                            "Invalid Row"}
                                                    </span>
                                                    {row.parsedData && (
                                                        <span className="text-sm text-base-content/60 ml-2">
                                                            {formatCurrency(
                                                                row.parsedData
                                                                    .total_amount,
                                                            )}{" "}
                                                            •{" "}
                                                            {
                                                                row.parsedData
                                                                    .num_installments
                                                            }
                                                            x
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="badge badge-ghost">
                                                    Row {row.rowNumber}
                                                </span>
                                            </div>

                                            {row.errors.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    {row.errors.map(
                                                        (error, i) => (
                                                            <div
                                                                key={i}
                                                                className="text-sm"
                                                            >
                                                                {error.category ===
                                                                "ambiguous" ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-warning">
                                                                            ⚠️
                                                                        </span>
                                                                        <span>
                                                                            {
                                                                                error.message
                                                                            }
                                                                        </span>
                                                                        <select
                                                                            className="select select-sm select-bordered"
                                                                            value={
                                                                                row.selectedCardId ||
                                                                                ""
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                handleCardSelect(
                                                                                    row.rowNumber,
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                        >
                                                                            <option value="">
                                                                                Select
                                                                                card...
                                                                            </option>
                                                                            {row.cardOptions?.map(
                                                                                (
                                                                                    card,
                                                                                ) => (
                                                                                    <option
                                                                                        key={
                                                                                            card.id
                                                                                        }
                                                                                        value={
                                                                                            card.id
                                                                                        }
                                                                                    >
                                                                                        {
                                                                                            card.credit_card_name
                                                                                        }{" "}
                                                                                        ••••{" "}
                                                                                        {
                                                                                            card.last_four_digits
                                                                                        }
                                                                                    </option>
                                                                                ),
                                                                            )}
                                                                        </select>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-error">
                                                                        ❌{" "}
                                                                        {
                                                                            error.field
                                                                        }
                                                                        :{" "}
                                                                        {
                                                                            error.message
                                                                        }
                                                                        {error.suggestion && (
                                                                            <span className="text-base-content/60 ml-2">
                                                                                →{" "}
                                                                                {
                                                                                    error.suggestion
                                                                                }
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}

                                            {row.parsedData &&
                                                row.card &&
                                                row.person &&
                                                row.errors.length === 0 && (
                                                    <div className="mt-3 text-sm text-base-content/60">
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                            <span>
                                                                Card:{" "}
                                                                {
                                                                    row.card
                                                                        .credit_card_name
                                                                }
                                                            </span>
                                                            <span>
                                                                Person:{" "}
                                                                {
                                                                    row.person
                                                                        .name
                                                                }
                                                            </span>
                                                            <span>
                                                                BNPL:{" "}
                                                                {row.parsedData
                                                                    .is_bnpl
                                                                    ? "Yes"
                                                                    : "No"}
                                                            </span>
                                                            <span>
                                                                Billing:{" "}
                                                                {
                                                                    row
                                                                        .parsedData
                                                                        .billing_start_date
                                                                }
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="divider"></div>

                            <div className="flex justify-between items-center">
                                <div className="stats shadow">
                                    <div className="stat">
                                        <div className="stat-title">
                                            Total Amount
                                        </div>
                                        <div className="stat-value text-lg">
                                            {formatCurrency(
                                                state.data.summary.totalAmount,
                                            )}
                                        </div>
                                    </div>
                                    <div className="stat">
                                        <div className="stat-title">
                                            Installments
                                        </div>
                                        <div className="stat-value text-lg">
                                            {
                                                state.data.summary
                                                    .totalInstallments
                                            }
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={resetState}
                                        className="btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleImport}
                                        className="btn btn-primary"
                                        disabled={
                                            state.data.summary.validRows === 0
                                        }
                                    >
                                        Import {state.data.summary.validRows}{" "}
                                        Purchases
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {state.status === "importing" && (
                <div className="card bg-base-200">
                    <div className="card-body items-center">
                        <span className="loading loading-spinner loading-lg"></span>
                        <p>
                            Importing purchases...{" "}
                            {Math.round(state.progress * 100)}%
                        </p>
                        <progress
                            className="progress progress-primary w-56"
                            value={state.progress * 100}
                            max="100"
                        ></progress>
                    </div>
                </div>
            )}

            {state.status === "success" && (
                <div className="card bg-base-200">
                    <div className="card-body">
                        <h2 className="card-title text-success">
                            ✅ Import Complete
                        </h2>
                        <div className="stats shadow mt-4">
                            <div className="stat">
                                <div className="stat-title">Imported</div>
                                <div className="stat-value text-success">
                                    {state.summary.totalImported}
                                </div>
                            </div>
                            {state.summary.totalFailed > 0 && (
                                <div className="stat">
                                    <div className="stat-title">Failed</div>
                                    <div className="stat-value text-error">
                                        {state.summary.totalFailed}
                                    </div>
                                </div>
                            )}
                            <div className="stat">
                                <div className="stat-title">Total Amount</div>
                                <div className="stat-value text-lg">
                                    {formatCurrency(state.summary.totalAmount)}
                                </div>
                            </div>
                        </div>
                        <div className="card-actions justify-end mt-4">
                            <button
                                onClick={resetState}
                                className="btn btn-outline"
                            >
                                Import More
                            </button>
                            <button
                                onClick={() => router.push("/purchases")}
                                className="btn btn-primary"
                            >
                                View Purchases
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {state.status === "error" && (
                <div className="alert alert-error">
                    <span>{state.error}</span>
                    <button onClick={resetState} className="btn btn-sm">
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
}
