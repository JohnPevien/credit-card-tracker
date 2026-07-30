import type { NextRequest } from "next/server";
import { z } from "zod";

import {
    isSameOriginRequest,
    publicJsonNoStore,
    publicPortalUnavailableResponse,
} from "@/lib/acknowledgements/server/http";
import { verifyPayerPortalRequest } from "@/lib/auth/payerPortalSession";
import {
    PAYER_PORTAL_COOKIE_NAME,
    isCookieSecure,
} from "@/lib/constants/constants";

type LockRouteContext = {
    params: Promise<{ publicId: string }>;
};

const publicIdSchema = z.string().uuid();

export async function POST(request: NextRequest, context: LockRouteContext) {
    if (!isSameOriginRequest(request)) {
        return publicPortalUnavailableResponse(403);
    }

    const parsedPublicId = publicIdSchema.safeParse(
        (await context.params).publicId,
    );
    if (parsedPublicId.success) {
        await verifyPayerPortalRequest(request, parsedPublicId.data);
    }

    const response = publicJsonNoStore({ locked: true });
    response.cookies.set({
        name: PAYER_PORTAL_COOKIE_NAME,
        value: "",
        maxAge: 0,
        httpOnly: true,
        secure: isCookieSecure(),
        sameSite: "lax",
        path: "/",
    });
    return response;
}
