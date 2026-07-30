import type { NextRequest } from "next/server";
import { z } from "zod";

import {
    publicJsonNoStore,
    publicPortalUnavailableResponse,
    publicRouteErrorResponse,
} from "@/lib/acknowledgements/server/http";
import { listPublishedReceipts } from "@/lib/acknowledgements/server/portalService";
import { verifyPayerPortalRequest } from "@/lib/auth/payerPortalSession";

type ReceiptListRouteContext = {
    params: Promise<{ publicId: string }>;
};

const publicIdSchema = z.string().uuid();

export async function GET(
    request: NextRequest,
    context: ReceiptListRouteContext,
) {
    try {
        const publicId = publicIdSchema.parse((await context.params).publicId);
        const session = await verifyPayerPortalRequest(request, publicId);
        if (!session) {
            return publicPortalUnavailableResponse();
        }

        return publicJsonNoStore({
            receipts: await listPublishedReceipts(session.personId),
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return publicPortalUnavailableResponse();
        }
        return publicRouteErrorResponse(error);
    }
}
