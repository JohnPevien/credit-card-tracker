import type { NextRequest } from "next/server";
import { z } from "zod";

import { proofRemovalSchema } from "@/lib/acknowledgements/proofSchemas";
import {
    isSameOriginRequest,
    publicJsonNoStore,
    publicPortalUnavailableResponse,
    publicProofRouteErrorResponse,
} from "@/lib/acknowledgements/server/http";
import { removeProof } from "@/lib/acknowledgements/server/proofService";
import { verifyPayerPortalRequest } from "@/lib/auth/payerPortalSession";

type RemoveRouteContext = {
    params: Promise<{
        publicId: string;
        receiptId: string;
        fileId: string;
    }>;
};

const paramsSchema = z.object({
    publicId: z.string().uuid(),
    receiptId: z.string().uuid(),
    fileId: z.string().uuid(),
});

export async function DELETE(
    request: NextRequest,
    context: RemoveRouteContext,
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

        const input = proofRemovalSchema.parse(await request.json());
        return publicJsonNoStore(
            await removeProof(
                { role: "payer", personId: session.personId },
                params.receiptId,
                params.fileId,
                input.expectedRevision,
            ),
        );
    } catch (error) {
        return publicProofRouteErrorResponse(error);
    }
}
