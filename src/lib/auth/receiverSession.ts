import type { NextRequest } from "next/server";
import {
    SITE_ACCESS_COOKIE_MAX_AGE,
    SITE_ACCESS_COOKIE_NAME,
} from "@/lib/constants/constants";
import { signSession, verifySession } from "./signedSession";

type ReceiverSession = {
    kind: "receiver";
};

const getSessionSecret = () => process.env.SITE_SESSION_SECRET;

const hasReceiverConfiguration = () =>
    Boolean(process.env.SITE_PASSWORD && getSessionSecret());

export async function createReceiverSessionToken(): Promise<string> {
    const secret = getSessionSecret();

    if (!secret) {
        throw new Error("Site session secret is not configured");
    }

    return signSession<ReceiverSession>(
        { kind: "receiver" },
        secret,
        Date.now() + SITE_ACCESS_COOKIE_MAX_AGE * 1_000,
    );
}

export async function verifyReceiverSessionToken(token: string): Promise<boolean> {
    const secret = getSessionSecret();
    if (!hasReceiverConfiguration() || !secret) {
        return false;
    }

    const session = await verifySession<ReceiverSession>(token, secret);
    return session?.kind === "receiver";
}

export async function verifyReceiverRequest(request: NextRequest): Promise<boolean> {
    const token = request.cookies.get(SITE_ACCESS_COOKIE_NAME)?.value;
    return token ? verifyReceiverSessionToken(token) : false;
}
