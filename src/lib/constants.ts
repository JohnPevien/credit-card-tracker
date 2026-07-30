import { NavigationIconKey } from "./icons";

export interface NavLink {
    label: string;
    href: string;
    icon: NavigationIconKey;
}

export interface NavCard {
    id: string;
    href: string;
    title: string;
    description: string;
    icon: NavigationIconKey;
}

export const NAV_LINKS: NavLink[] = [
    {
        label: "Home",
        href: "/",
        icon: "Home",
    },
    {
        label: "Credit Cards",
        href: "/credit-cards",
        icon: "CreditCard",
    },
    {
        label: "Persons",
        href: "/persons",
        icon: "Users",
    },
    {
        label: "Purchases",
        href: "/purchases",
        icon: "ShoppingBag",
    },
    {
        label: "Transactions",
        href: "/transactions",
        icon: "FileText",
    },
    {
        label: "Acknowledgements",
        href: "/acknowledgements",
        icon: "ReceiptText",
    },
];

export const NAV_CARDS: NavCard[] = [
    {
        id: "credit-cards",
        href: "/credit-cards",
        title: "Credit Cards",
        icon: "CreditCard",
        description:
            "Manage your credit cards with their details, including supplementary cards",
    },
    {
        id: "persons",
        href: "/persons",
        title: "Persons",
        icon: "Users",
        description: "Track who's using your credit cards",
    },
    {
        id: "purchases",
        href: "/purchases",
        title: "Purchases",
        icon: "ShoppingBag",
        description: "Record purchases with installment options and BNPL",
    },
    {
        id: "transactions",
        href: "/transactions",
        title: "Transactions",
        icon: "FileText",
        description: "Track all transactions including payments",
    },
    {
        id: "acknowledgements",
        href: "/acknowledgements",
        title: "Acknowledgements",
        icon: "ReceiptText",
        description:
            "Issue payment receipts and track confirmation from both parties",
    },
];

export const HOW_IT_WORKS_ITEMS = [
    {
        id: "regular-purchase",
        title: "Regular Purchase",
        description:
            "Creates one purchase record and one transaction with the same date and amount.",
    },
    {
        id: "installment-purchase",
        title: "Installment Purchase",
        description:
            "Creates one purchase record with multiple transaction records (one per installment).",
    },
    {
        id: "bnpl",
        title: "BNPL",
        description:
            'Treated like an installment purchase, with the "is_bnpl" flag set to true.',
    },
    {
        id: "payment-refund",
        title: "Payment/Refund",
        description:
            "A standalone transaction with no purchase relation and a negative amount.",
    },
    {
        id: "supplementary-cards",
        title: "Supplementary Cards",
        description: "Linked to their principal cards for better organization.",
    },
];

export const PHILIPPINE_BANKS = [
    // Original PHILIPPINE_BANKS array content will be here after the tool call, this is just a placeholder to ensure the new content is appended.
    "BDO",
    "BPI",
    "Metrobank",
    "PNB",
    "Security Bank",
    "UnionBank",
    "RCBC",
    "Eastwest Bank",
    "Citibank",
    "HSBC",
    "Maybank",
    "China Bank",
];

// Form field labels
export const FORM_LABELS = {
    CARD_NAME: "Card Name",
    LAST_FOUR_DIGITS: "Last 4 Digits",
    CARDHOLDER_NAME: "Cardholder Name",
    ISSUER: "Issuer",
    SUPPLEMENTARY_CARD: "Supplementary Card",
    PRINCIPAL_CARD: "Principal Card",
} as const;

// Number of decimal places for currency formatting
export const CURRENCY_DECIMAL_PLACES = 2;
