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
