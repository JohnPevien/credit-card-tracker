import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    createPayerPortalSession,
    getTrustedRequestAddress,
    verifyPayerPortalRequest,
} from "@/lib/auth/payerPortalSession";
import {
    confirmPublishedReceipt,
    getPublishedReceipt,
    listPublishedReceipts,
    unlockPortal,
} from "../portalService";
import { POST as unlockRoute } from "@/app/api/public/payer-portals/[publicId]/unlock/route";
import { POST as lockRoute } from "@/app/api/public/payer-portals/[publicId]/lock/route";
import { GET as listRoute } from "@/app/api/public/payer-portals/[publicId]/receipts/route";
import { GET as detailRoute } from "@/app/api/public/payer-portals/[publicId]/receipts/[receiptId]/route";
import { POST as confirmRoute } from "@/app/api/public/payer-portals/[publicId]/receipts/[receiptId]/confirm/route";

vi.mock("@/lib/auth/payerPortalSession", () => ({
    createPayerPortalSession: vi.fn(),
    getTrustedRequestAddress: vi.fn(),
    verifyPayerPortalRequest: vi.fn(),
}));

vi.mock("../portalService", () => ({
    confirmPublishedReceipt: vi.fn(),
    getPublishedReceipt: vi.fn(),
    listPublishedReceipts: vi.fn(),
    unlockPortal: vi.fn(),
}));

const PUBLIC_ID = "00000000-0000-4000-8000-000000000040";
const PERSON_ID = "00000000-0000-4000-8000-000000000020";
const RECEIPT_ID = "00000000-0000-4000-8000-000000000010";
const auth = { personId: PERSON_ID, publicId: PUBLIC_ID, credentialVersion: 2 };
const publicContext = { params: Promise.resolve({ publicId: PUBLIC_ID }) };
const receiptContext = {
    params: Promise.resolve({ publicId: PUBLIC_ID, receiptId: RECEIPT_ID }),
};

const request = (
    path: string,
    method = "GET",
    body?: unknown,
    origin = "https://receipts.example",
) =>
    new NextRequest(`https://receipts.example${path}`, {
        method,
        headers: {
            origin,
            ...(body === undefined
                ? {}
                : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

const expectPublicHeaders = (response: Response) => {
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyPayerPortalRequest).mockResolvedValue(auth);
    vi.mocked(createPayerPortalSession).mockResolvedValue("signed-token");
    vi.mocked(getTrustedRequestAddress).mockReturnValue(null);
    vi.mocked(unlockPortal).mockResolvedValue({
        kind: "authorized",
        session: auth,
    });
    vi.mocked(listPublishedReceipts).mockResolvedValue([]);
    vi.mocked(getPublishedReceipt).mockResolvedValue({
        id: RECEIPT_ID,
    } as never);
    vi.mocked(confirmPublishedReceipt).mockResolvedValue({
        id: RECEIPT_ID,
    } as never);
});

describe("public payer portal routes", () => {
    it("checks unlock origin before parsing its body and returns a generic response", async () => {
        const attack = request(
            `/api/public/payer-portals/${PUBLIC_ID}/unlock`,
            "POST",
            { pin: "123456" },
            "https://attacker.example",
        );
        const json = vi.spyOn(attack, "json");

        const response = await unlockRoute(attack, publicContext);

        expect(response.status).toBe(403);
        expect(json).not.toHaveBeenCalled();
        expect(unlockPortal).not.toHaveBeenCalled();
        expect(await response.json()).toEqual({ error: "Portal unavailable" });
        expectPublicHeaders(response);
    });

    it("does not issue a cookie for unknown, revoked, malformed, or wrong PIN results", async () => {
        vi.mocked(unlockPortal).mockResolvedValue({ kind: "invalid" });

        const response = await unlockRoute(
            request(`/api/public/payer-portals/${PUBLIC_ID}/unlock`, "POST", {
                pin: "000000",
            }),
            publicContext,
        );

        expect(response.status).toBe(401);
        expect(response.headers.get("Set-Cookie")).toBeNull();
        expect(await response.json()).toEqual({ error: "Portal unavailable" });
        expect(createPayerPortalSession).not.toHaveBeenCalled();
        expectPublicHeaders(response);
    });

    it("sets the 12-hour HttpOnly SameSite cookie after successful unlock", async () => {
        vi.stubEnv("NODE_ENV", "production");

        const response = await unlockRoute(
            request(`/api/public/payer-portals/${PUBLIC_ID}/unlock`, "POST", {
                pin: "123456",
            }),
            publicContext,
        );

        expect(response.status).toBe(200);
        const cookie = response.headers.get("Set-Cookie") ?? "";
        expect(cookie).toContain("payer_portal_session=signed-token");
        expect(cookie).toContain("Max-Age=43200");
        expect(cookie).toContain("Path=/");
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain("SameSite=lax");
        expect(cookie).toContain("Secure");
        expectPublicHeaders(response);
        vi.unstubAllEnvs();
    });

    it("returns a bounded 429 without issuing a cookie", async () => {
        vi.mocked(unlockPortal).mockResolvedValue({
            kind: "rate_limited",
            retryAfterSeconds: 37,
        });

        const response = await unlockRoute(
            request(`/api/public/payer-portals/${PUBLIC_ID}/unlock`, "POST", {
                pin: "123456",
            }),
            publicContext,
        );

        expect(response.status).toBe(429);
        expect(response.headers.get("Retry-After")).toBe("37");
        expect(response.headers.get("Set-Cookie")).toBeNull();
        expect(await response.json()).toEqual({ error: "Portal unavailable" });
        expectPublicHeaders(response);
    });

    it("maps an unexpected service failure without logging its details", async () => {
        vi.mocked(listPublishedReceipts).mockRejectedValue(
            new Error("sensitive database detail"),
        );
        const consoleError = vi.spyOn(console, "error");

        const response = await listRoute(
            request(`/api/public/payer-portals/${PUBLIC_ID}/receipts`),
            publicContext,
        );

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
            error: "Internal server error",
        });
        expect(consoleError).not.toHaveBeenCalled();
        expectPublicHeaders(response);
        consoleError.mockRestore();
    });

    it("checks same-origin and live session before parsing confirmation input", async () => {
        vi.mocked(verifyPayerPortalRequest).mockResolvedValue(null);
        const unauthenticated = request(
            `/api/public/payer-portals/${PUBLIC_ID}/receipts/${RECEIPT_ID}/confirm`,
            "POST",
            { expectedRevision: 2 },
        );
        const json = vi.spyOn(unauthenticated, "json");

        const response = await confirmRoute(unauthenticated, receiptContext);

        expect(response.status).toBe(401);
        expect(json).not.toHaveBeenCalled();
        expect(confirmPublishedReceipt).not.toHaveBeenCalled();
        expectPublicHeaders(response);
    });

    it("uses only the authorized person and server-selected payer role for list, detail, and confirm", async () => {
        await listRoute(
            request(`/api/public/payer-portals/${PUBLIC_ID}/receipts`),
            publicContext,
        );
        await detailRoute(
            request(
                `/api/public/payer-portals/${PUBLIC_ID}/receipts/${RECEIPT_ID}`,
            ),
            receiptContext,
        );
        const confirmResponse = await confirmRoute(
            request(
                `/api/public/payer-portals/${PUBLIC_ID}/receipts/${RECEIPT_ID}/confirm`,
                "POST",
                {
                    expectedRevision: 2,
                    personId: "00000000-0000-4000-8000-000000000099",
                    role: "receiver",
                },
            ),
            receiptContext,
        );

        expect(listPublishedReceipts).toHaveBeenCalledWith(PERSON_ID);
        expect(getPublishedReceipt).toHaveBeenCalledWith(PERSON_ID, RECEIPT_ID);
        expect(confirmPublishedReceipt).toHaveBeenCalledWith(
            PERSON_ID,
            RECEIPT_ID,
            2,
        );
        expectPublicHeaders(confirmResponse);
    });

    it("clears the cookie with matching attributes on a same-origin lock", async () => {
        vi.stubEnv("NODE_ENV", "production");

        const response = await lockRoute(
            request(`/api/public/payer-portals/${PUBLIC_ID}/lock`, "POST"),
            publicContext,
        );

        const cookie = response.headers.get("Set-Cookie") ?? "";
        expect(cookie).toContain("payer_portal_session=");
        expect(cookie).toContain("Max-Age=0");
        expect(cookie).toContain("Path=/");
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain("SameSite=lax");
        expect(cookie).toContain("Secure");
        expectPublicHeaders(response);
        vi.unstubAllEnvs();
    });
});
