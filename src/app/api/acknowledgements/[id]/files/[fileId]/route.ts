import type { NextRequest } from "next/server";
import { z } from "zod";

import { proofRemovalSchema } from "@/lib/acknowledgements/proofSchemas";
import {
    jsonNoStore,
    routeErrorResponse,
    unauthorizedResponse,
} from "@/lib/acknowledgements/server/http";
import { removeProof } from "@/lib/acknowledgements/server/proofService";
import { verifyReceiverRequest } from "@/lib/auth/receiverSession";

type RemoveRouteContext = {
    params: Promise<{ id: string; fileId: string }>;
};

const paramsSchema = z.object({
    id: z.string().uuid(),
    fileId: z.string().uuid(),
});

export async function DELETE(
    request: NextRequest,
    context: RemoveRouteContext,
) {
    if (!(await verifyReceiverRequest(request))) {
        return unauthorizedResponse();
    }

    try {
        const params = paramsSchema.parse(await context.params);
        const input = proofRemovalSchema.parse(await request.json());
        return jsonNoStore(
            await removeProof(
                { role: "receiver" },
                params.id,
                params.fileId,
                input.expectedRevision,
            ),
        );
    } catch (error) {
        return routeErrorResponse(error);
    }
}
