import type {
    AcknowledgementReceiptDetail,
    CreateReceiptInput,
    PayerPortalAdminView,
    PayerPortalCredentialResult,
    PortalAdminAction,
    ReceiverReceiptAction,
    ReceiverReceiptActionResult,
    UpdateReceiptInput,
} from "@/lib/acknowledgements/types";

export class ReceiptRequestError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ReceiptRequestError";
        this.status = status;
    }

    get isConflict() {
        return this.status === 409;
    }
}

export class ReceiptAuthExpiredError extends ReceiptRequestError {
    constructor() {
        super("Your receiver session expired. Sign in again.", 401);
        this.name = "ReceiptAuthExpiredError";
    }
}

function navigateToReceiverLogin() {
    if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/enter-password"
    ) {
        window.location.assign("/enter-password");
    }
}

function errorMessage(payload: unknown, fallback: string) {
    if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
    ) {
        return payload.error;
    }

    return fallback;
}

export async function requestJson<T>(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<T> {
    const response = await fetch(input, {
        cache: "no-store",
        ...init,
        headers: {
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...init?.headers,
        },
    });
    const contentType =
        response.headers.get("content-type")?.toLowerCase() ?? "";
    const isJson = contentType.includes("application/json");
    const isHtml = contentType.includes("text/html");
    const isLoginDestination = response.url.includes("/enter-password");

    if (response.status === 401 || isLoginDestination || isHtml) {
        navigateToReceiverLogin();
        throw new ReceiptAuthExpiredError();
    }

    if (response.redirected) {
        throw new ReceiptRequestError(
            "The API request was redirected unexpectedly.",
            response.status,
        );
    }

    if (!isJson) {
        throw new ReceiptRequestError(
            "The server returned a non-JSON response.",
            response.status,
        );
    }

    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        throw new ReceiptRequestError(
            "The server returned invalid JSON.",
            response.status,
        );
    }

    if (!response.ok) {
        throw new ReceiptRequestError(
            errorMessage(payload, "The request could not be completed."),
            response.status,
        );
    }

    return payload as T;
}

export function createReceiptRequest(input: CreateReceiptInput) {
    return requestJson<{ receipt: AcknowledgementReceiptDetail }>(
        "/api/acknowledgements",
        {
            method: "POST",
            body: JSON.stringify(input),
        },
    );
}

export function updateReceiptRequest(id: string, input: UpdateReceiptInput) {
    return requestJson<{ receipt: AcknowledgementReceiptDetail }>(
        `/api/acknowledgements/${id}`,
        {
            method: "PATCH",
            body: JSON.stringify(input),
        },
    );
}

export function requestReceiptAction(
    id: string,
    action: ReceiverReceiptAction,
) {
    return requestJson<ReceiverReceiptActionResult>(
        `/api/acknowledgements/${id}/actions`,
        {
            method: "POST",
            body: JSON.stringify(action),
        },
    );
}

export function requestPortalAction(
    personId: string,
    action: PortalAdminAction,
) {
    return requestJson<PayerPortalCredentialResult>(
        `/api/payer-portals/${personId}`,
        {
            method: "POST",
            body: JSON.stringify(action),
        },
    );
}

export function requestPortal(personId: string) {
    return requestJson<{ portal: PayerPortalAdminView | null }>(
        `/api/payer-portals/${personId}`,
    );
}
