import type { NextRequest } from "next/server";
import { z } from "zod";

import { proofFinalizeSchema } from "@/lib/acknowledgements/proofSchemas";
import {
    isSameOriginRequest,
    publicJsonNoStore,
    publicPortalUnavailableResponse,
    publicProofRouteErrorResponse,
} from "@/lib/acknowledgements/server/http";
import { finalizeProofUpload } from "@/lib/acknowledgements/server/proofService";
import { verifyPayerPortalRequest } from "@/lib/auth/payerPortalSession";

type FinalizeRouteContext = {
    params: Promise<{ publicId: string; receiptId: string }>;
};

const paramsSchema = z.object({
    publicId: z.string().uuid(),
    receiptId: z.string().uuid(),
});

export async function POST(
    request: NextRequest,
    context: FinalizeRouteContext,
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

        const input = proofFinalizeSchema.parse(await request.json());
        return publicJsonNoStore(
            await finalizeProofUpload(
                { role: "payer", personId: session.personId },
                params.receiptId,
                input,
            ),
        );
    } catch (error) {
        return publicProofRouteErrorResponse(error);
    }
}
