import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BulkPurchaseForm from "../BulkPurchaseForm";
import { CreditCard, Person } from "@/lib/supabase";

// Mock base components
vi.mock("@/components/base", () => ({
    Select: ({
        name,
        value,
        onChange,
        options,
        disabled,
    }: {
        name: string;
        value: string;
        onChange: (value: string) => void;
        options: { value: string; label: string }[];
        disabled?: boolean;
    }) => (
        <select
            data-testid={`select-${name}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
        >
            {options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    ),
    DateInput: ({
        name,
        value,
        onChange,
        disabled,
    }: {
        name: string;
        value: string;
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        disabled?: boolean;
    }) => (
        <input
            data-testid={`date-${name}`}
            type="date"
            name={name}
            value={value}
            onChange={onChange}
            disabled={disabled}
        />
    ),
    Input: ({
        label,
        name,
        type,
        value,
        onChange,
        disabled,
    }: {
        label: string;
        name: string;
        type?: string;
        value: string | number;
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        disabled?: boolean;
    }) => (
        <div>
            <label>{label}</label>
            <input
                data-testid={`input-${name}`}
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                disabled={disabled}
            />
        </div>
    ),
    Checkbox: ({
        label,
        name,
        checked,
        onChange,
        disabled,
    }: {
        label: string;
        name: string;
        checked: boolean;
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        disabled?: boolean;
    }) => (
        <div>
            <label>
                <input
                    data-testid={`checkbox-${name}`}
                    type="checkbox"
                    name={name}
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                />
                {label}
            </label>
        </div>
    ),
    Button: ({
        type,
        onClick,
        disabled,
        children,
    }: {
        type?: "button" | "submit" | "reset";
        onClick?: () => void;
        disabled?: boolean;
        children: React.ReactNode;
    }) => (
        <button type={type} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}));

const mockCreditCards: CreditCard[] = [
    {
        id: "card-1",
        credit_card_name: "Test Card 1",
        last_four_digits: "1234",
        cardholder_name: "John Doe",
        issuer: "Visa",
        is_supplementary: false,
    },
    {
        id: "card-2",
        credit_card_name: "Test Card 2",
        last_four_digits: "5678",
        cardholder_name: "Jane Doe",
        issuer: "Mastercard",
        is_supplementary: false,
    },
];

const mockPersons: Person[] = [
    { id: "person-1", name: "John Doe", slug: "john-doe" },
    { id: "person-2", name: "Jane Doe", slug: "jane-doe" },
];

describe("BulkPurchaseForm", () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderForm = () => {
        return render(
            <BulkPurchaseForm
                creditCards={mockCreditCards}
                persons={mockPersons}
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
            />
        );
    };

    it("should render default inputs and initial single empty row using defaults", async () => {
        renderForm();

        // Defaults card values
        expect(screen.getByTestId("select-default_card")).toHaveValue("card-1");
        expect(screen.getByTestId("select-default_person")).toHaveValue("person-1");

        // Table elements
        expect(screen.getByPlaceholderText("MacBook Pro, Groceries, etc.")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });

    it("should allow adding a new row", async () => {
        const user = userEvent.setup();
        renderForm();

        const addButton = screen.getByText("Add Row");
        await user.click(addButton);

        // Now we should have 2 rows
        const descriptions = screen.getAllByPlaceholderText("MacBook Pro, Groceries, etc.");
        expect(descriptions).toHaveLength(2);
    });

    it("should allow removing a row", async () => {
        const user = userEvent.setup();
        renderForm();

        // Add a row first
        await user.click(screen.getByText("Add Row"));
        expect(screen.getAllByPlaceholderText("MacBook Pro, Groceries, etc.")).toHaveLength(2);

        // Click delete on the first row (the layout renders duplicate and trash icons)
        // Wait, since we are using inline icons, let's find the trash button by Title or selector.
        // We added title="Remove Row" in the code. Let's find by title.
        const removeButtons = screen.getAllByTitle("Remove Row");
        await user.click(removeButtons[0]);

        expect(screen.getAllByPlaceholderText("MacBook Pro, Groceries, etc.")).toHaveLength(1);
    });

    it("should allow duplicating a row", async () => {
        const user = userEvent.setup();
        renderForm();

        // Type description on the first row
        const descInput = screen.getByPlaceholderText("MacBook Pro, Groceries, etc.");
        await user.type(descInput, "Special Item");

        // Duplicate the row
        const duplicateButtons = screen.getAllByTitle("Duplicate Row");
        await user.click(duplicateButtons[0]);

        // Should have 2 rows, both with description "Special Item"
        const descInputs = screen.getAllByPlaceholderText("MacBook Pro, Groceries, etc.");
        expect(descInputs).toHaveLength(2);
        expect(descInputs[0]).toHaveValue("Special Item");
        expect(descInputs[1]).toHaveValue("Special Item");
    });

    it("should cascade top-level default changes to rows matching previous defaults", async () => {
        const user = userEvent.setup();
        renderForm();

        // Change default person
        await user.selectOptions(screen.getByTestId("select-default_person"), "person-2");

        // Verify the row person is updated to person-2 since it matched the default
        const personSelects = screen.getAllByTestId(/^select-person-/);
        expect(personSelects[0]).toHaveValue("person-2");
    });

    it("should trigger validation errors on invalid inputs", async () => {
        const user = userEvent.setup();
        renderForm();

        // Submit without typing anything (description is empty, amount is empty)
        await user.click(screen.getByText("Save 1 Purchase"));

        expect(screen.getByText("Please correct the following errors:")).toBeInTheDocument();
        expect(screen.getByText("Row 1: Description is required")).toBeInTheDocument();
        expect(screen.getByText("Row 1: Total Amount must be a positive number")).toBeInTheDocument();
    });

    it("should call onSubmit when validation succeeds", async () => {
        const user = userEvent.setup();
        renderForm();

        // Type description
        const descInput = screen.getByPlaceholderText("MacBook Pro, Groceries, etc.");
        await user.type(descInput, "Bulk purchase 1");

        // Type amount
        const amountInput = screen.getByPlaceholderText("0.00");
        await user.type(amountInput, "1500.50");

        // Submit
        mockOnSubmit.mockResolvedValue(undefined);
        await user.click(screen.getByText("Save 1 Purchase"));

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith([
                expect.objectContaining({
                    description: "Bulk purchase 1",
                    total_amount: 1500.50,
                    num_installments: 1,
                    credit_card_id: "card-1",
                    person_id: "person-1",
                }),
            ]);
        });
    });

    it("should call onCancel when cancel is clicked", async () => {
        const user = userEvent.setup();
        renderForm();

        await user.click(screen.getByText("Cancel"));

        expect(mockOnCancel).toHaveBeenCalled();
    });

    it("should validate missing credit card and person ids", async () => {
        const user = userEvent.setup();
        render(
            <BulkPurchaseForm
                creditCards={[]}
                persons={[]}
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
            />
        );

        await user.click(screen.getByText("Save 1 Purchase"));

        expect(screen.getByText("Please correct the following errors:")).toBeInTheDocument();
        expect(screen.getByText("Row 1: Credit Card is required")).toBeInTheDocument();
        expect(screen.getByText("Row 1: Person is required")).toBeInTheDocument();
    });
});
