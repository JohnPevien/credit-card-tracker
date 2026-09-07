import type { NextRequest } from "next/server";
import { z } from "zod";

import { proofUploadClaimSchema } from "@/lib/acknowledgements/proofSchemas";
import {
    isSameOriginRequest,
    publicJsonNoStore,
    publicPortalUnavailableResponse,
    publicProofRouteErrorResponse,
} from "@/lib/acknowledgements/server/http";
import { requestProofUpload } from "@/lib/acknowledgements/server/proofService";
import { verifyPayerPortalRequest } from "@/lib/auth/payerPortalSession";

type UploadRouteContext = {
    params: Promise<{ publicId: string; receiptId: string }>;
};

const paramsSchema = z.object({
    publicId: z.string().uuid(),
    receiptId: z.string().uuid(),
});

export async function POST(
    request: NextRequest,
    context: UploadRouteContext,
) {
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

        const claim = proofUploadClaimSchema.parse(await request.json());
        return publicJsonNoStore(
            await requestProofUpload(
                { role: "payer", personId: session.personId },
                params.receiptId,
                claim,
            ),
        );
    } catch (error) {
        return publicProofRouteErrorResponse(error);
    }
}
