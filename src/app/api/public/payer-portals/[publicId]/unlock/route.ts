import type { NextRequest } from "next/server";
import { z } from "zod";

import {
    isSameOriginRequest,
    publicJsonNoStore,
    publicPortalUnavailableResponse,
    publicRouteErrorResponse,
} from "@/lib/acknowledgements/server/http";
import { unlockPortal } from "@/lib/acknowledgements/server/portalService";
import {
    createPayerPortalSession,
    getTrustedRequestAddress,
} from "@/lib/auth/payerPortalSession";
import {
    PAYER_PORTAL_COOKIE_MAX_AGE,
    PAYER_PORTAL_COOKIE_NAME,
    isCookieSecure,
} from "@/lib/constants/constants";

type UnlockRouteContext = {
    params: Promise<{ publicId: string }>;
};

const publicIdSchema = z.string().uuid();
const unlockSchema = z.object({
    pin: z.string().regex(/^\d{6}$/),
});

export async function POST(request: NextRequest, context: UnlockRouteContext) {
    if (!isSameOriginRequest(request)) {
        return publicPortalUnavailableResponse(403);
    }

    try {
        const publicId = publicIdSchema.parse((await context.params).publicId);
        const { pin } = unlockSchema.parse(await request.json());
        const result = await unlockPortal(
            publicId,
            pin,
            getTrustedRequestAddress(request),
        );

        if (result.kind === "rate_limited") {
            return publicPortalUnavailableResponse(
                429,
                result.retryAfterSeconds,
            );
        }
        if (result.kind === "invalid") {
            return publicPortalUnavailableResponse();
        }

        const response = publicJsonNoStore({ unlocked: true });
        response.cookies.set({
            name: PAYER_PORTAL_COOKIE_NAME,
            value: await createPayerPortalSession(result.session),
            maxAge: PAYER_PORTAL_COOKIE_MAX_AGE,
            httpOnly: true,
            secure: isCookieSecure(),
            sameSite: "lax",
            path: "/",
        });
        return response;
    } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) {
            return publicPortalUnavailableResponse();
        }
        return publicRouteErrorResponse(error);
    }
}
