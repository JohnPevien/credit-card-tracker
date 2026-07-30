const RECEIPT_TIME_ZONE = "Asia/Manila";

export function formatReceiptAmount(amount: number, currency = "PHP"): string {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function formatReceiptDate(value: string): string {
    return new Intl.DateTimeFormat("en-PH", {
        timeZone: RECEIPT_TIME_ZONE,
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(new Date(`${value}T00:00:00.000Z`));
}

export function formatReceiptDateTime(value: string): string {
    return new Intl.DateTimeFormat("en-PH", {
        timeZone: RECEIPT_TIME_ZONE,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
}
