import type { NextRequest } from "next/server";
import { z } from "zod";

import { proofUploadClaimSchema } from "@/lib/acknowledgements/proofSchemas";
import {
    jsonNoStore,
    routeErrorResponse,
    unauthorizedResponse,
} from "@/lib/acknowledgements/server/http";
import { requestProofUpload } from "@/lib/acknowledgements/server/proofService";
import { verifyReceiverRequest } from "@/lib/auth/receiverSession";

type UploadRouteContext = {
    params: Promise<{ id: string }>;
};

const idSchema = z.string().uuid();

export async function POST(
    request: NextRequest,
    context: UploadRouteContext,
) {
    if (!(await verifyReceiverRequest(request))) {
        return unauthorizedResponse();
    }

    try {
        const receiptId = idSchema.parse((await context.params).id);
        const claim = proofUploadClaimSchema.parse(await request.json());
        return jsonNoStore(
            await requestProofUpload(
                { role: "receiver" },
                receiptId,
                claim,
            ),
        );
    } catch (error) {
        return routeErrorResponse(error);
    }
}
