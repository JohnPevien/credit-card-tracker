import type { NextRequest } from "next/server";
import { z } from "zod";

import { proofFinalizeSchema } from "@/lib/acknowledgements/proofSchemas";
import {
    jsonNoStore,
    routeErrorResponse,
    unauthorizedResponse,
} from "@/lib/acknowledgements/server/http";
import { finalizeProofUpload } from "@/lib/acknowledgements/server/proofService";
import { verifyReceiverRequest } from "@/lib/auth/receiverSession";

type FinalizeRouteContext = {
    params: Promise<{ id: string }>;
};

const idSchema = z.string().uuid();

export async function POST(
    request: NextRequest,
    context: FinalizeRouteContext,
) {
    if (!(await verifyReceiverRequest(request))) {
        return unauthorizedResponse();
    }

    try {
        const receiptId = idSchema.parse((await context.params).id);
        const input = proofFinalizeSchema.parse(await request.json());
        return jsonNoStore(
            await finalizeProofUpload(
                { role: "receiver" },
                receiptId,
                input,
            ),
        );
    } catch (error) {
        return routeErrorResponse(error);
    }
}
