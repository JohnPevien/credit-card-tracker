import { CreditCard, Person } from "@/lib/supabase";
import { Select, DateInput, Input, Button } from "@/components/base";

export interface TransactionFiltersConfig {
    showPerson?: boolean;
    showCard?: boolean;
    showDescription?: boolean;
    showDateRange?: boolean;
    showPaidStatus?: boolean;
}

export interface TransactionFiltersState {
    person: string;
    card: string;
    description: string;
    dateFrom: string;
    dateTo: string;
    paidStatus: string;
}

interface TransactionFiltersProps {
    config: TransactionFiltersConfig;
    filters: TransactionFiltersState;
    onFilterChange: (filters: TransactionFiltersState) => void;
    persons?: Person[];
    creditCards?: CreditCard[];
}

const DEFAULT_FILTERS: TransactionFiltersState = {
    person: "",
    card: "",
    description: "",
    dateFrom: "",
    dateTo: "",
    paidStatus: "all",
};

export default function TransactionFilters({
    config,
    filters,
    onFilterChange,
    persons = [],
    creditCards = [],
}: TransactionFiltersProps) {
    const handleFilterChange = (
        key: keyof TransactionFiltersState,
        value: string,
    ) => {
        onFilterChange({
            ...filters,
            [key]: value,
        });
    };

    const clearFilters = () => {
        onFilterChange(DEFAULT_FILTERS);
    };

    const formatCardLabel = (card: CreditCard) => {
        return `${card.credit_card_name || card.issuer} *${card.last_four_digits}`;
    };

    const visibleFiltersCount = Object.values(config).filter(Boolean).length;

    if (visibleFiltersCount === 0) return null;

    return (
        <div
            className="mb-6 p-4 bg-base-200 rounded-lg"
            data-component="TransactionFilters"
        >
            <h2 className="text-lg font-semibold mb-3">Filters</h2>
            <div
                className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(visibleFiltersCount, 5)} gap-4`}
            >
                {config.showPerson && (
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Person</span>
                        </label>
                        <Select
                            value={filters.person}
                            onChange={(value) =>
                                handleFilterChange("person", value)
                            }
                            options={[
                                { value: "", label: "All Persons" },
                                ...persons.map((p) => ({
                                    value: p.id,
                                    label: p.name,
                                })),
                            ]}
                        />
                    </div>
                )}

                {config.showCard && (
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Credit Card</span>
                        </label>
                        <Select
                            value={filters.card}
                            onChange={(value) =>
                                handleFilterChange("card", value)
                            }
                            options={[
                                { value: "", label: "All Cards" },
                                ...creditCards.map((card) => ({
                                    value: card.id,
                                    label: formatCardLabel(card),
                                })),
                            ]}
                        />
                    </div>
                )}

                {config.showDescription && (
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Description</span>
                        </label>
                        <Input
                            type="text"
                            placeholder="Filter by description"
                            value={filters.description}
                            onChange={(e) =>
                                handleFilterChange(
                                    "description",
                                    e.target.value,
                                )
                            }
                        />
                    </div>
                )}

                {config.showDateRange && (
                    <>
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">From Date</span>
                            </label>
                            <DateInput
                                value={filters.dateFrom}
                                onChange={(e) =>
                                    handleFilterChange(
                                        "dateFrom",
                                        e.target.value,
                                    )
                                }
                            />
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">To Date</span>
                            </label>
                            <DateInput
                                value={filters.dateTo}
                                onChange={(e) =>
                                    handleFilterChange("dateTo", e.target.value)
                                }
                            />
                        </div>
                    </>
                )}

                {config.showPaidStatus && (
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Payment Status</span>
                        </label>
                        <Select
                            value={filters.paidStatus}
                            onChange={(value) =>
                                handleFilterChange("paidStatus", value)
                            }
                            options={[
                                { value: "all", label: "All" },
                                { value: "paid", label: "Paid" },
                                { value: "unpaid", label: "Unpaid" },
                            ]}
                        />
                    </div>
                )}
            </div>

            <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                </Button>
            </div>
        </div>
    );
}
