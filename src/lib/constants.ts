export const NAV_CARDS = [
    {
        href: "/credit-cards",
        title: "Credit Cards",
        description:
            "Manage your credit cards with their details, including supplementary cards",
    },
    {
        href: "/persons",
        title: "Persons",
        description: "Track who's using your credit cards",
    },
    {
        href: "/purchases",
        title: "Purchases",
        description: "Record purchases with installment options and BNPL",
    },
    {
        href: "/transactions",
        title: "Transactions",
        description: "Track all transactions including payments",
    },
];

export const HOW_IT_WORKS_ITEMS = [
    {
        title: "Regular Purchase",
        description:
            "Creates one purchase record and one transaction with the same date and amount.",
    },
    {
        title: "Installment Purchase",
        description:
            "Creates one purchase record with multiple transaction records (one per installment).",
    },
    {
        title: "BNPL",
        description:
            'Treated like an installment purchase, with the "is_bnpl" flag set to true.',
    },
    {
        title: "Payment/Refund",
        description:
            "A standalone transaction with no purchase relation and a negative amount.",
    },
    {
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
