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

async function readPayload(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return null;
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
    const payload = await readPayload(response);

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
