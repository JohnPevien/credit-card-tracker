import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { signSession, verifySession } from "../signedSession";
import {
    createReceiverSessionToken,
    verifyReceiverRequest,
    verifyReceiverSessionToken,
} from "../receiverSession";

const SECRET = "a-32-character-minimum-test-secret!";

it("round-trips a signed session and rejects tampering or expiry", async () => {
    const token = await signSession({ kind: "receiver" }, SECRET, 2_000);

    expect(await verifySession(token, SECRET, 1_000)).toEqual({
        kind: "receiver",
    });
    expect(await verifySession(`${token}x`, SECRET, 1_000)).toBeNull();
    expect(await verifySession(token, SECRET, 2_001)).toBeNull();
});

it("rejects a short secret and malformed token without exposing an error", async () => {
    await expect(signSession({ kind: "receiver" }, "too-short", 2_000)).rejects.toThrow();
    await expect(verifySession("not-a-session", "too-short", 1_000)).resolves.toBeNull();
    await expect(verifySession("invalid.invalid", SECRET, 1_000)).resolves.toBeNull();
});

afterEach(() => {
    vi.unstubAllEnvs();
});

it("creates and verifies receiver sessions only with complete configuration", async () => {
    vi.stubEnv("SITE_PASSWORD", "password");
    vi.stubEnv("SITE_SESSION_SECRET", SECRET);

    const token = await createReceiverSessionToken();
    expect(await verifyReceiverSessionToken(token)).toBe(true);

    vi.stubEnv("SITE_SESSION_SECRET", "");
    expect(await verifyReceiverSessionToken(token)).toBe(false);
});

it("verifies a signed receiver cookie for internal requests in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SITE_PASSWORD", "password");
    vi.stubEnv("SITE_SESSION_SECRET", SECRET);

    const token = await createReceiverSessionToken();
    const request = new NextRequest("https://example.test/api/internal", {
        headers: { cookie: `site_access_token=${token}` },
    });

    expect(await verifyReceiverRequest(request)).toBe(true);
    expect(
        await verifyReceiverRequest(
            new NextRequest("https://example.test/api/internal"),
        ),
    ).toBe(false);
});
