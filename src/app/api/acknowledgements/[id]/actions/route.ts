import type { NextRequest } from "next/server";
import { z } from "zod";

import { receiptActionSchema } from "@/lib/acknowledgements/schemas";
import {
    jsonNoStore,
    routeErrorResponse,
    unauthorizedResponse,
} from "@/lib/acknowledgements/server/http";
import { performReceiptAction } from "@/lib/acknowledgements/server/receiptService";
import { verifyReceiverRequest } from "@/lib/auth/receiverSession";

type ReceiptActionRouteContext = {
    params: Promise<{ id: string }>;
};

const idSchema = z.string().uuid();

export async function POST(
    request: NextRequest,
    context: ReceiptActionRouteContext,
) {
    if (!(await verifyReceiverRequest(request))) {
        return unauthorizedResponse();
    }

    try {
        const id = idSchema.parse((await context.params).id);
        const action = receiptActionSchema.parse(await request.json());
        return jsonNoStore({
            receipt: await performReceiptAction(id, action),
        });
    } catch (error) {
        return routeErrorResponse(error);
    }
}
