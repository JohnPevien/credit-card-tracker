import type { NextRequest } from "next/server";
import { z } from "zod";

import {
    jsonNoStore,
    routeErrorResponse,
    unauthorizedResponse,
} from "@/lib/acknowledgements/server/http";
import {
    getPortalAccess,
    managePortalAccess,
} from "@/lib/acknowledgements/server/portalAdminService";
import { verifyReceiverRequest } from "@/lib/auth/receiverSession";

type PortalRouteContext = {
    params: Promise<{ personId: string }>;
};

const personIdSchema = z.string().uuid();
const portalActionSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("generate-pin") }),
    z.object({ type: z.literal("reset-pin") }),
    z.object({ type: z.literal("rotate-link") }),
    z.object({ type: z.literal("revoke") }),
    z.object({ type: z.literal("reactivate") }),
]);

export async function GET(request: NextRequest, context: PortalRouteContext) {
    if (!(await verifyReceiverRequest(request))) {
        return unauthorizedResponse();
    }

    try {
        const personId = personIdSchema.parse((await context.params).personId);
        return jsonNoStore({ portal: await getPortalAccess(personId) });
    } catch (error) {
        return routeErrorResponse(error);
    }
}

export async function POST(request: NextRequest, context: PortalRouteContext) {
    if (!(await verifyReceiverRequest(request))) {
        return unauthorizedResponse();
    }

    try {
        const personId = personIdSchema.parse((await context.params).personId);
        const action = portalActionSchema.parse(await request.json());
        return jsonNoStore(await managePortalAccess(personId, action));
    } catch (error) {
        return routeErrorResponse(error);
    }
}
