import type { NextRequest } from "next/server";
import { z } from "zod";

import {
    publicJsonNoStore,
    publicPortalUnavailableResponse,
    publicRouteErrorResponse,
} from "@/lib/acknowledgements/server/http";
import { getPublishedReceipt } from "@/lib/acknowledgements/server/portalService";
import { verifyPayerPortalRequest } from "@/lib/auth/payerPortalSession";

type ReceiptDetailRouteContext = {
    params: Promise<{ publicId: string; receiptId: string }>;
};

const paramsSchema = z.object({
    publicId: z.string().uuid(),
    receiptId: z.string().uuid(),
});

export async function GET(
    request: NextRequest,
    context: ReceiptDetailRouteContext,
) {
    try {
        const params = paramsSchema.parse(await context.params);
        const session = await verifyPayerPortalRequest(
            request,
            params.publicId,
        );
        if (!session) {
            return publicPortalUnavailableResponse();
        }

        return publicJsonNoStore({
            receipt: await getPublishedReceipt(
                session.personId,
                params.receiptId,
            ),
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return publicPortalUnavailableResponse();
        }
        return publicRouteErrorResponse(error);
    }
}
