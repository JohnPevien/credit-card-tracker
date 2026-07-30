import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ReceiptServiceError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = new.target.name;
    }
}

export class ReceiptNotFoundError extends ReceiptServiceError {}
export class ReceiptConflictError extends ReceiptServiceError {}
export class ReceiptValidationError extends ReceiptServiceError {}
export class ReceiptUnexpectedError extends ReceiptServiceError {}

const NO_STORE_HEADERS = {
    "Cache-Control": "no-store",
};

const PUBLIC_NO_STORE_HEADERS = {
    ...NO_STORE_HEADERS,
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
};

export function jsonNoStore(
    body: unknown,
    init: { status?: number } = {},
): NextResponse {
    return NextResponse.json(body, {
        ...init,
        headers: NO_STORE_HEADERS,
    });
}

export function unauthorizedResponse(): NextResponse {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
}

export function publicJsonNoStore(
    body: unknown,
    init: { status?: number; headers?: HeadersInit } = {},
): NextResponse {
    return NextResponse.json(body, {
        status: init.status,
        headers: {
            ...PUBLIC_NO_STORE_HEADERS,
            ...Object.fromEntries(new Headers(init.headers)),
        },
    });
}

export function publicPortalUnavailableResponse(
    status = 401,
    retryAfterSeconds?: number,
): NextResponse {
    return publicJsonNoStore(
        { error: "Portal unavailable" },
        {
            status,
            ...(retryAfterSeconds
                ? { headers: { "Retry-After": String(retryAfterSeconds) } }
                : {}),
        },
    );
}

export function publicRouteErrorResponse(error: unknown): NextResponse {
    if (error instanceof ZodError || error instanceof SyntaxError) {
        return publicJsonNoStore({ error: "Invalid request" }, { status: 400 });
    }
    if (error instanceof Error && error.name === "PortalConflictError") {
        return publicJsonNoStore(
            { error: "Receipt revision conflict" },
            { status: 409 },
        );
    }
    if (error instanceof Error && error.name === "PortalNotFoundError") {
        return publicJsonNoStore(
            { error: "Receipt unavailable" },
            { status: 404 },
        );
    }
    return publicJsonNoStore(
        { error: "Internal server error" },
        { status: 500 },
    );
}

export function isSameOriginRequest(request: Request): boolean {
    const origin = request.headers.get("origin");
    if (!origin) {
        return false;
    }

    try {
        return new URL(origin).origin === new URL(request.url).origin;
    } catch {
        return false;
    }
}

export function routeErrorResponse(error: unknown): NextResponse {
    if (error instanceof ZodError || error instanceof SyntaxError) {
        return jsonNoStore({ error: "Invalid request" }, { status: 400 });
    }

    if (error instanceof ReceiptValidationError) {
        return jsonNoStore({ error: error.message }, { status: 400 });
    }

    if (error instanceof ReceiptNotFoundError) {
        return jsonNoStore({ error: error.message }, { status: 404 });
    }

    if (error instanceof ReceiptConflictError) {
        return jsonNoStore({ error: error.message }, { status: 409 });
    }

    console.error("Acknowledgement receipt request failed", error);
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
}
