import { CreditCard, Person } from "@/lib/supabase";
import { Select } from "@/components/base";

interface PurchaseFiltersProps {
    persons: Person[];
    creditCards: CreditCard[];
    filterPerson: string;
    filterCard: string;
    filterDescription: string;
    filterPaid: string;
    onFilterChange: (filters: {
        person: string;
        card: string;
        description: string;
        paid: string;
    }) => void;
}

export default function PurchaseFilters({
    persons,
    creditCards,
    filterPerson,
    filterCard,
    filterDescription,
    filterPaid,
    onFilterChange,
}: PurchaseFiltersProps) {
    const handlePersonChange = (value: string) => {
        onFilterChange({
            person: value,
            card: filterCard,
            description: filterDescription,
            paid: filterPaid,
        });
    };

    const handleCardChange = (value: string) => {
        onFilterChange({
            person: filterPerson,
            card: value,
            description: filterDescription,
            paid: filterPaid,
        });
    };

    const handleDescriptionChange = (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        onFilterChange({
            person: filterPerson,
            card: filterCard,
            description: e.target.value,
            paid: filterPaid,
        });
    };

    const handlePaidChange = (value: string) => {
        onFilterChange({
            person: filterPerson,
            card: filterCard,
            description: filterDescription,
            paid: value,
        });
    };

    const clearFilters = () => {
        onFilterChange({
            person: "",
            card: "",
            description: "",
            paid: "",
        });
    };

    return (
        <div className="flex gap-4 mb-4 max-w-5xl">
            <div className="form-control">
                <div className="label">
                    <span className="label-text">Person:</span>
                </div>
                <Select
                    value={filterPerson}
                    onChange={handlePersonChange}
                    options={[
                        { value: "", label: "All" },
                        ...persons.map((p) => ({
                            value: p.id,
                            label: p.name,
                        })),
                    ]}
                />
            </div>
            <div className="form-control">
                <div className="label">
                    <span className="label-text">Card:</span>
                </div>
                <Select
                    value={filterCard}
                    onChange={handleCardChange}
                    options={[
                        { value: "", label: "All" },
                        ...creditCards.map((c) => ({
                            value: c.id,
                            label: `${c.credit_card_name || c.issuer} **** ${
                                c.last_four_digits
                            }`,
                        })),
                    ]}
                />
            </div>
            <div className="form-control">
                <div className="label">
                    <span className="label-text">Paid Status:</span>
                </div>
                <Select
                    value={filterPaid}
                    onChange={handlePaidChange}
                    options={[
                        { value: "", label: "All" },
                        { value: "paid", label: "Paid" },
                        { value: "unpaid", label: "Unpaid" },
                    ]}
                />
            </div>
            <div className="form-control">
                <div className="label">
                    <span className="label-text">Description:</span>
                </div>
                <input
                    type="text"
                    value={filterDescription}
                    onChange={handleDescriptionChange}
                    placeholder="Search description"
                    className="input input-bordered w-full"
                />
            </div>
            <button
                onClick={clearFilters}
                className="self-end btn btn-secondary mb-1"
            >
                Clear Filters
            </button>
        </div>
    );
}
