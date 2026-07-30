import type { NextRequest } from "next/server";
import { z } from "zod";

import { updateReceiptSchema } from "@/lib/acknowledgements/schemas";
import {
    jsonNoStore,
    routeErrorResponse,
    unauthorizedResponse,
} from "@/lib/acknowledgements/server/http";
import {
    getReceipt,
    updateReceipt,
} from "@/lib/acknowledgements/server/receiptService";
import { verifyReceiverRequest } from "@/lib/auth/receiverSession";

type ReceiptRouteContext = {
    params: Promise<{ id: string }>;
};

const idSchema = z.string().uuid();

export async function GET(request: NextRequest, context: ReceiptRouteContext) {
    if (!(await verifyReceiverRequest(request))) {
        return unauthorizedResponse();
    }

    try {
        const id = idSchema.parse((await context.params).id);
        return jsonNoStore({ receipt: await getReceipt(id) });
    } catch (error) {
        return routeErrorResponse(error);
    }
}

export async function PATCH(
    request: NextRequest,
    context: ReceiptRouteContext,
) {
    if (!(await verifyReceiverRequest(request))) {
        return unauthorizedResponse();
    }

    try {
        const id = idSchema.parse((await context.params).id);
        const input = updateReceiptSchema.parse(await request.json());
        return jsonNoStore({ receipt: await updateReceipt(id, input) });
    } catch (error) {
        return routeErrorResponse(error);
    }
}
