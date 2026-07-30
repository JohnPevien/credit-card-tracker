import type { NextRequest } from "next/server";
import { z } from "zod";

import {
    isSameOriginRequest,
    publicJsonNoStore,
    publicPortalUnavailableResponse,
    publicRouteErrorResponse,
} from "@/lib/acknowledgements/server/http";
import { confirmPublishedReceipt } from "@/lib/acknowledgements/server/portalService";
import { verifyPayerPortalRequest } from "@/lib/auth/payerPortalSession";

type ConfirmRouteContext = {
    params: Promise<{ publicId: string; receiptId: string }>;
};

const paramsSchema = z.object({
    publicId: z.string().uuid(),
    receiptId: z.string().uuid(),
});
const confirmSchema = z.object({
    expectedRevision: z.number().int().positive(),
});

export async function POST(request: NextRequest, context: ConfirmRouteContext) {
    if (!isSameOriginRequest(request)) {
        return publicPortalUnavailableResponse(403);
    }

    try {
        const params = paramsSchema.parse(await context.params);
        const session = await verifyPayerPortalRequest(
            request,
            params.publicId,
        );
        if (!session) {
            return publicPortalUnavailableResponse();
        }

        const input = confirmSchema.parse(await request.json());
        return publicJsonNoStore({
            receipt: await confirmPublishedReceipt(
                session.personId,
                params.receiptId,
                input.expectedRevision,
            ),
        });
    } catch (error) {
        return publicRouteErrorResponse(error);
    }
}
