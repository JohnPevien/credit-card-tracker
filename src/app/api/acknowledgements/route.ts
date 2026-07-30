import type { NextRequest } from "next/server";
import { z } from "zod";

import { createReceiptSchema } from "@/lib/acknowledgements/schemas";
import {
    createReceipt,
    listReceipts,
} from "@/lib/acknowledgements/server/receiptService";
import {
    jsonNoStore,
    routeErrorResponse,
    unauthorizedResponse,
} from "@/lib/acknowledgements/server/http";
import { verifyReceiverRequest } from "@/lib/auth/receiverSession";

const filterDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
        const parsed = new Date(`${value}T00:00:00.000Z`);
        return (
            !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === value
        );
    });
const receiptFiltersSchema = z.object({
    status: z
        .enum([
            "draft",
            "awaiting_both",
            "awaiting_payer",
            "awaiting_receiver",
            "completed",
            "voided",
        ])
        .optional(),
    payerPersonId: z.string().uuid().optional(),
    paymentDateFrom: filterDateSchema.optional(),
    paymentDateTo: filterDateSchema.optional(),
    query: z.string().trim().max(200).optional(),
});

export async function GET(request: NextRequest) {
    if (!(await verifyReceiverRequest(request))) {
        return unauthorizedResponse();
    }

    try {
        const filters = receiptFiltersSchema.parse(
            Object.fromEntries(request.nextUrl.searchParams),
        );
        return jsonNoStore({ receipts: await listReceipts(filters) });
    } catch (error) {
        return routeErrorResponse(error);
    }
}

export async function POST(request: NextRequest) {
    if (!(await verifyReceiverRequest(request))) {
        return unauthorizedResponse();
    }

    try {
        const input = createReceiptSchema.parse(await request.json());
        return jsonNoStore(
            { receipt: await createReceipt(input) },
            { status: 201 },
        );
    } catch (error) {
        return routeErrorResponse(error);
    }
}
