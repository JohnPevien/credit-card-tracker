import { NextRequest, NextResponse } from "next/server";
import {
    SITE_ACCESS_COOKIE_NAME,
    SITE_ACCESS_COOKIE_VALUE,
    SITE_ACCESS_COOKIE_MAX_AGE,
    isCookieSecure,
} from "@/lib/constants/constants";

export async function POST(request: NextRequest) {
    try {
        // Validate environment configuration
        const sitePassword = process.env.SITE_PASSWORD;

        if (!sitePassword) {
            return NextResponse.json(
                {
                    message:
                        "Server misconfiguration: Site password not configured",
                },
                { status: 500 },
            );
        }

        const body = await request.json();
        const { password } = body;

        if (!password) {
            return NextResponse.json(
                { message: "Password is required" },
                { status: 400 },
            );
        }

        if (password !== sitePassword) {
            return NextResponse.json(
                { message: "Invalid password" },
                { status: 401 },
            );
        }

        const response = NextResponse.json(
            { message: "Authentication successful" },
            { status: 200 },
        );
        // Set authentication cookie directly on the response
        response.cookies.set({
            name: SITE_ACCESS_COOKIE_NAME,
            value: SITE_ACCESS_COOKIE_VALUE,
            maxAge: SITE_ACCESS_COOKIE_MAX_AGE,
            httpOnly: true,
            secure: isCookieSecure(),
            sameSite: "lax",
            path: "/",
        });

        return response;
    } catch (error) {
        console.error("Error in site authentication:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 },
        );
    }
}
