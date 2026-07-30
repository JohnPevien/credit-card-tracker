import { NextRequest, NextResponse } from "next/server";
import {
    SITE_ACCESS_COOKIE_NAME,
    PUBLIC_PATHS,
} from "@/lib/constants/constants";
import { verifyReceiverSessionToken } from "@/lib/auth/receiverSession";

const PAYER_PAGE_PATTERN = /^\/payer\/[^/]+\/?$/;
const PAYER_API_PATTERN =
    /^\/api\/public\/payer-portals\/[^/]+\/(?:unlock|lock|receipts(?:\/[^/]+(?:\/confirm)?)?)\/?$/;

export function isPublicRequestPath(pathname: string): boolean {
    return (
        PUBLIC_PATHS.some(
            (path) => pathname === path || pathname === `${path}/`,
        ) ||
        PAYER_PAGE_PATTERN.test(pathname) ||
        PAYER_API_PATTERN.test(pathname)
    );
}

const applyPayerPublicHeaders = (response: NextResponse) => {
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
};

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isPayerPublicPath =
        PAYER_PAGE_PATTERN.test(pathname) || PAYER_API_PATTERN.test(pathname);
    const nextResponse = () => {
        const response = NextResponse.next();
        return isPayerPublicPath ? applyPayerPublicHeaders(response) : response;
    };

    // Skip auth in development mode
    if (process.env.NODE_ENV === "development") {
        return nextResponse();
    }

    // Skip middleware if SITE_PASSWORD is not set
    const sitePassword = process.env.SITE_PASSWORD;
    if (!sitePassword || sitePassword === "") {
        return nextResponse();
    }

    // Check if path is public or static asset
    const isPublicPath = isPublicRequestPath(pathname);
    const isStaticAsset =
        pathname.startsWith("/_next/") ||
        pathname === "/favicon.ico" ||
        pathname.startsWith("/images/");

    // Allow access to public paths and static assets
    if (isPublicPath || isStaticAsset) {
        return nextResponse();
    }
    // Check for authentication cookie
    const accessCookie = request.cookies.get(SITE_ACCESS_COOKIE_NAME);

    // Redirect to password entry page if not authenticated
    if (
        !accessCookie ||
        !(await verifyReceiverSessionToken(accessCookie.value))
    ) {
        const url = new URL("/enter-password", request.url);
        return NextResponse.redirect(url);
    }

    // User is authenticated, allow access
    return NextResponse.next();
}

// Run exact public-path decisions inside middleware so prefix lookalikes
// cannot bypass the receiver gate at matcher level.
export const config = {
    matcher: ["/((?!_next/static|_next/image).*)"],
};
