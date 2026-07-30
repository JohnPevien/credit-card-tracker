import type { NextRequest } from "next/server";
import { z } from "zod";

import {
    jsonNoStore,
    routeErrorResponse,
    unauthorizedResponse,
} from "@/lib/acknowledgements/server/http";
import { getReceiptFormMeta } from "@/lib/acknowledgements/server/receiptService";
import { verifyReceiverRequest } from "@/lib/auth/receiverSession";

const metadataQuerySchema = z.object({
    payerPersonId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
    if (!(await verifyReceiverRequest(request))) {
        return unauthorizedResponse();
    }

    try {
        const { payerPersonId } = metadataQuerySchema.parse(
            Object.fromEntries(request.nextUrl.searchParams),
        );
        return jsonNoStore(await getReceiptFormMeta(payerPersonId));
    } catch (error) {
        return routeErrorResponse(error);
    }
}
