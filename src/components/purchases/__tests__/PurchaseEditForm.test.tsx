import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PurchaseEditForm from "../PurchaseEditForm";
import { Purchase, CreditCard, Person } from "@/lib/supabase";

// Mock base components
vi.mock("@/components/base", () => ({
    Select: ({
        name,
        value,
        onChange,
        options,
        required,
        disabled,
    }: {
        name: string;
        value: string;
        onChange: (value: string) => void;
        options: { value: string; label: string }[];
        required?: boolean;
        disabled?: boolean;
    }) => (
        <select
            data-testid={`select-${name}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
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
        required,
        disabled,
    }: {
        name: string;
        value: string;
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        required?: boolean;
        disabled?: boolean;
    }) => (
        <input
            data-testid={`date-${name}`}
            type="date"
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
        />
    ),
    Input: ({
        label,
        name,
        type,
        step,
        min,
        value,
        onChange,
        required,
        disabled,
    }: {
        label: string;
        name: string;
        type?: string;
        step?: string;
        min?: string;
        value: string | number;
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        required?: boolean;
        disabled?: boolean;
    }) => (
        <div>
            <label>{label}</label>
            <input
                data-testid={`input-${name}`}
                type={type}
                name={name}
                step={step}
                min={min}
                value={value}
                onChange={onChange}
                required={required}
                disabled={disabled}
            />
        </div>
    ),
    Textarea: ({
        label,
        name,
        value,
        onChange,
        required,
        disabled,
    }: {
        label: string;
        name: string;
        value: string;
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
        required?: boolean;
        disabled?: boolean;
    }) => (
        <div>
            <label>{label}</label>
            <textarea
                data-testid={`textarea-${name}`}
                name={name}
                value={value}
                onChange={onChange}
                required={required}
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
        color,
        disabled,
        children,
    }: {
        type?: "button" | "submit" | "reset";
        onClick?: () => void;
        color?: string;
        disabled?: boolean;
        children: React.ReactNode;
    }) => (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            data-color={color}
        >
            {children}
        </button>
    ),
}));

const mockPurchase: Purchase = {
    id: "purchase-1",
    credit_card_id: "card-1",
    person_id: "person-1",
    purchase_date: "2024-01-15",
    billing_start_date: "2024-01-15",
    total_amount: 1000,
    description: "Test Purchase",
    num_installments: 3,
    is_bnpl: false,
};

const mockCreditCards: CreditCard[] = [
    {
        id: "card-1",
        credit_card_name: "Test Card",
        last_four_digits: "1234",
        cardholder_name: "Test User",
        issuer: "Visa",
        is_supplementary: false,
    },
    {
        id: "card-2",
        credit_card_name: "Another Card",
        last_four_digits: "5678",
        cardholder_name: "Test User",
        issuer: "Mastercard",
        is_supplementary: true,
    },
];

const mockPersons: Person[] = [
    { id: "person-1", name: "John Doe", slug: "john-doe" },
    { id: "person-2", name: "Jane Doe", slug: "jane-doe" },
];

describe("PurchaseEditForm", () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderForm = (purchase = mockPurchase) => {
        return render(
            <PurchaseEditForm
                purchase={purchase}
                creditCards={mockCreditCards}
                persons={mockPersons}
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
            />,
        );
    };

    describe("Rendering", () => {
        it("should display all fields with initial values", () => {
            renderForm();

            expect(screen.getByTestId("select-credit_card_id")).toHaveValue("card-1");
            expect(screen.getByTestId("select-person_id")).toHaveValue("person-1");
            expect(screen.getByTestId("textarea-description")).toHaveValue("Test Purchase");
            expect(screen.getByTestId("date-purchase_date")).toHaveValue("2024-01-15");
            expect(screen.getByTestId("date-billing_start_date")).toHaveValue("2024-01-15");
            expect(screen.getByTestId("input-total_amount")).toHaveValue(1000);
            expect(screen.getByTestId("input-num_installments")).toHaveValue(3);
            expect(screen.getByTestId("checkbox-is_bnpl")).not.toBeChecked();
        });

        it("should handle missing billing_start_date", () => {
            const purchaseWithoutBilling = {
                ...mockPurchase,
                billing_start_date: undefined,
            };

            renderForm(purchaseWithoutBilling);

            expect(screen.getByTestId("date-billing_start_date")).toHaveValue("");
        });

        it("should display BNPL checkbox as checked when is_bnpl is true", () => {
            const bnplPurchase = { ...mockPurchase, is_bnpl: true };
            renderForm(bnplPurchase);

            expect(screen.getByTestId("checkbox-is_bnpl")).toBeChecked();
        });
    });

    describe("Input Handling", () => {
        it("should update credit card select", async () => {
            const user = userEvent.setup();
            renderForm();

            await user.selectOptions(
                screen.getByTestId("select-credit_card_id"),
                "card-2",
            );

            expect(screen.getByTestId("select-credit_card_id")).toHaveValue("card-2");
        });

        it("should update person select", async () => {
            const user = userEvent.setup();
            renderForm();

            await user.selectOptions(
                screen.getByTestId("select-person_id"),
                "person-2",
            );

            expect(screen.getByTestId("select-person_id")).toHaveValue("person-2");
        });

        it("should update description textarea", async () => {
            const user = userEvent.setup();
            renderForm();

            const textarea = screen.getByTestId("textarea-description");
            await user.clear(textarea);
            await user.type(textarea, "New Description");

            expect(textarea).toHaveValue("New Description");
        });

        it("should update number input", async () => {
            const user = userEvent.setup();
            renderForm();

            const input = screen.getByTestId("input-total_amount");
            await user.clear(input);
            await user.type(input, "2500");

            expect(input).toHaveValue(2500);
        });

        it("should update installments input", async () => {
            const user = userEvent.setup();
            renderForm();

            const input = screen.getByTestId("input-num_installments");
            await user.click(input);
            await user.keyboard("{Control>}a{/Control}5");

            expect(input).toHaveValue(5);
        });

        it("should handle empty number input as 0", async () => {
            const user = userEvent.setup();
            renderForm();

            const input = screen.getByTestId("input-total_amount");
            await user.clear(input);
            await user.type(input, "abc");

            // parseFloat("abc") returns NaN, which || 0 converts to 0
            expect(input).toHaveValue(0);
        });

        it("should toggle BNPL checkbox", async () => {
            const user = userEvent.setup();
            renderForm();

            const checkbox = screen.getByTestId("checkbox-is_bnpl");
            await user.click(checkbox);

            expect(checkbox).toBeChecked();
        });
    });

    describe("Submission", () => {
        it("should call onSubmit with form data", async () => {
            const user = userEvent.setup();
            mockOnSubmit.mockResolvedValue(undefined);
            renderForm();

            await user.click(screen.getByText("Save Changes"));

            await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalledWith({
                    credit_card_id: "card-1",
                    person_id: "person-1",
                    description: "Test Purchase",
                    purchase_date: "2024-01-15",
                    billing_start_date: "2024-01-15",
                    total_amount: 1000,
                    num_installments: 3,
                    is_bnpl: false,
                });
            });
        });

        it("should prevent double submission while submitting", async () => {
            const user = userEvent.setup();
            let resolveSubmit: () => void;
            mockOnSubmit.mockImplementation(
                () =>
                    new Promise<void>((resolve) => {
                        resolveSubmit = resolve;
                    }),
            );

            renderForm();

            const submitButton = screen.getByText("Save Changes");
            await user.click(submitButton);

            // Button should show loading state
            expect(screen.getByText("Saving...")).toBeInTheDocument();

            // Try clicking again - should not trigger another call
            await user.click(screen.getByText("Saving..."));
            expect(mockOnSubmit).toHaveBeenCalledTimes(1);

            // Resolve the submission
            resolveSubmit!();
            await waitFor(() => {
                expect(screen.getByText("Save Changes")).toBeInTheDocument();
            });
        });

        it("should call onCancel when Cancel button is clicked", async () => {
            const user = userEvent.setup();
            renderForm();

            await user.click(screen.getByText("Cancel"));

            expect(mockOnCancel).toHaveBeenCalled();
        });

        it("should disable all inputs while submitting", async () => {
            const user = userEvent.setup();
            let resolveSubmit: () => void;
            mockOnSubmit.mockImplementation(
                () =>
                    new Promise<void>((resolve) => {
                        resolveSubmit = resolve;
                    }),
            );

            renderForm();

            await user.click(screen.getByText("Save Changes"));

            // All inputs should be disabled
            expect(screen.getByTestId("select-credit_card_id")).toBeDisabled();
            expect(screen.getByTestId("select-person_id")).toBeDisabled();
            expect(screen.getByTestId("textarea-description")).toBeDisabled();
            expect(screen.getByTestId("date-purchase_date")).toBeDisabled();
            expect(screen.getByTestId("date-billing_start_date")).toBeDisabled();
            expect(screen.getByTestId("input-total_amount")).toBeDisabled();
            expect(screen.getByTestId("input-num_installments")).toBeDisabled();
            expect(screen.getByTestId("checkbox-is_bnpl")).toBeDisabled();

            resolveSubmit!();
            await waitFor(() => {
                expect(screen.getByTestId("select-credit_card_id")).not.toBeDisabled();
            });
        });
    });
});
