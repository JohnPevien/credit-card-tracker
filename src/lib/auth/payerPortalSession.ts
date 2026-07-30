import { isIP } from "node:net";

import type { NextRequest } from "next/server";

import {
    PAYER_PORTAL_COOKIE_MAX_AGE,
    PAYER_PORTAL_COOKIE_NAME,
} from "@/lib/constants/constants";
import { signSession, verifySession } from "./signedSession";

export type PayerPortalSession = {
    personId: string;
    publicId: string;
    credentialVersion: number;
};

type PortalSessionRow = {
    person_id?: unknown;
    public_id?: unknown;
    credential_version?: unknown;
    revoked_at?: unknown;
};

type PortalSessionQueryResult = {
    data: PortalSessionRow | null;
    error: unknown;
};

interface PortalSessionQuery extends PromiseLike<PortalSessionQueryResult> {
    select(...args: unknown[]): PortalSessionQuery;
    eq(...args: unknown[]): PortalSessionQuery;
    maybeSingle(...args: unknown[]): PortalSessionQuery;
}

export interface PortalSessionDataClient {
    from(table: string): PortalSessionQuery;
}

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getSessionSecret = () => process.env.ACKNOWLEDGEMENT_SESSION_SECRET;

const isPayerPortalSession = (value: unknown): value is PayerPortalSession => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const session = value as Record<string, unknown>;
    return (
        typeof session.personId === "string" &&
        UUID_PATTERN.test(session.personId) &&
        typeof session.publicId === "string" &&
        UUID_PATTERN.test(session.publicId) &&
        Number.isInteger(session.credentialVersion) &&
        Number(session.credentialVersion) > 0
    );
};

const getDefaultClient = async (): Promise<PortalSessionDataClient> => {
    const { getServerSupabase } = await import("@/lib/supabase/server");
    return getServerSupabase() as unknown as PortalSessionDataClient;
};

export async function createPayerPortalSession(
    session: PayerPortalSession,
): Promise<string> {
    const secret = getSessionSecret();
    if (!secret) {
        throw new Error("Payer portal session secret is not configured");
    }
    if (!isPayerPortalSession(session)) {
        throw new Error("Payer portal session payload is invalid");
    }

    return signSession(
        session,
        secret,
        Date.now() + PAYER_PORTAL_COOKIE_MAX_AGE * 1_000,
    );
}

export async function verifyPayerPortalRequest(
    request: NextRequest,
    routePublicId: string,
    client?: PortalSessionDataClient,
): Promise<PayerPortalSession | null> {
    const secret = getSessionSecret();
    const token = request.cookies.get(PAYER_PORTAL_COOKIE_NAME)?.value;
    if (!secret || !token || !UUID_PATTERN.test(routePublicId)) {
        return null;
    }

    const session = await verifySession<unknown>(token, secret);
    if (!isPayerPortalSession(session) || session.publicId !== routePublicId) {
        return null;
    }

    try {
        const { data, error } = await (client ?? (await getDefaultClient()))
            .from("payer_portal_access")
            .select("person_id,public_id,credential_version,revoked_at")
            .eq("person_id", session.personId)
            .eq("public_id", routePublicId)
            .maybeSingle();

        if (
            error ||
            !data ||
            data.person_id !== session.personId ||
            data.public_id !== session.publicId ||
            data.credential_version !== session.credentialVersion ||
            data.revoked_at != null
        ) {
            return null;
        }

        return session;
    } catch {
        return null;
    }
}

const normalizeAddress = (value: string): string | null => {
    const candidate = value.trim().toLowerCase();
    if (!candidate) {
        return null;
    }

    const withoutMappedPrefix = candidate.startsWith("::ffff:")
        ? candidate.slice("::ffff:".length)
        : candidate;
    return isIP(withoutMappedPrefix) ? withoutMappedPrefix : null;
};

export function getTrustedRequestAddress(request: NextRequest): string | null {
    if (process.env.VERCEL !== "1") {
        return null;
    }

    const forwarded = request.headers.get("x-vercel-forwarded-for");
    if (!forwarded) {
        return null;
    }

    return normalizeAddress(forwarded.split(",", 1)[0] ?? "");
}
