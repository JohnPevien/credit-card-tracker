import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    createPayerPortalSession,
    getTrustedRequestAddress,
    verifyPayerPortalRequest,
} from "../payerPortalSession";

const SECRET = "a-32-character-minimum-portal-secret";
const PUBLIC_ID = "00000000-0000-4000-8000-000000000040";
const PERSON_ID = "00000000-0000-4000-8000-000000000020";

type QueryResult = {
    data: Record<string, unknown> | null;
    error: { code?: string; message?: string } | null;
};

class FakeQuery implements PromiseLike<QueryResult> {
    readonly operations: Array<{ kind: string; args: unknown[] }> = [];

    constructor(private readonly result: QueryResult) {}

    select(...args: unknown[]) {
        this.operations.push({ kind: "select", args });
        return this;
    }

    eq(...args: unknown[]) {
        this.operations.push({ kind: "eq", args });
        return this;
    }

    maybeSingle(...args: unknown[]) {
        this.operations.push({ kind: "maybeSingle", args });
        return this;
    }

    then<TResult1 = QueryResult, TResult2 = never>(
        onfulfilled?:
            | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
            | null,
        onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
    ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(this.result).then(onfulfilled, onrejected);
    }
}

class FakeClient {
    readonly query: FakeQuery;
    readonly fromCalls: string[] = [];

    constructor(result: QueryResult) {
        this.query = new FakeQuery(result);
    }

    from(table: string) {
        this.fromCalls.push(table);
        return this.query;
    }
}

const portalRow = {
    person_id: PERSON_ID,
    public_id: PUBLIC_ID,
    credential_version: 3,
    revoked_at: null,
};

const portalRequest = (token: string, publicId = PUBLIC_ID) =>
    new NextRequest(
        `https://receipts.example/api/public/payer-portals/${publicId}/receipts`,
        {
            headers: { cookie: `payer_portal_session=${token}` },
        },
    );

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("payer portal sessions", () => {
    it("accepts a signed 12-hour session only after matching the current portal row", async () => {
        vi.stubEnv("ACKNOWLEDGEMENT_SESSION_SECRET", SECRET);
        const token = await createPayerPortalSession({
            personId: PERSON_ID,
            publicId: PUBLIC_ID,
            credentialVersion: 3,
        });
        const client = new FakeClient({ data: portalRow, error: null });

        await expect(
            verifyPayerPortalRequest(portalRequest(token), PUBLIC_ID, client),
        ).resolves.toEqual({
            personId: PERSON_ID,
            publicId: PUBLIC_ID,
            credentialVersion: 3,
        });
        expect(client.fromCalls).toEqual(["payer_portal_access"]);
        expect(client.query.operations).toEqual(
            expect.arrayContaining([
                { kind: "eq", args: ["person_id", PERSON_ID] },
                { kind: "eq", args: ["public_id", PUBLIC_ID] },
            ]),
        );
    });

    it.each([
        [
            "credential reset",
            { ...portalRow, credential_version: 4 },
            PUBLIC_ID,
        ],
        [
            "revocation",
            { ...portalRow, revoked_at: "2026-07-31T00:00:00.000Z" },
            PUBLIC_ID,
        ],
        [
            "link rotation",
            {
                ...portalRow,
                public_id: "00000000-0000-4000-8000-000000000041",
            },
            PUBLIC_ID,
        ],
        [
            "person mismatch",
            {
                ...portalRow,
                person_id: "00000000-0000-4000-8000-000000000021",
            },
            PUBLIC_ID,
        ],
    ])(
        "invalidates the cookie after %s even when its signature is valid",
        async (_, currentRow, routePublicId) => {
            vi.stubEnv("ACKNOWLEDGEMENT_SESSION_SECRET", SECRET);
            const token = await createPayerPortalSession({
                personId: PERSON_ID,
                publicId: PUBLIC_ID,
                credentialVersion: 3,
            });

            await expect(
                verifyPayerPortalRequest(
                    portalRequest(token, routePublicId),
                    routePublicId,
                    new FakeClient({ data: currentRow, error: null }),
                ),
            ).resolves.toBeNull();
        },
    );

    it("fails closed for missing configuration, malformed cookies, and database errors", async () => {
        vi.stubEnv("ACKNOWLEDGEMENT_SESSION_SECRET", "");
        await expect(
            verifyPayerPortalRequest(
                portalRequest("invalid"),
                PUBLIC_ID,
                new FakeClient({
                    data: null,
                    error: { message: "database unavailable" },
                }),
            ),
        ).resolves.toBeNull();
    });

    it("ignores spoofable forwarding headers and accepts only normalized platform addresses", () => {
        const spoofed = new NextRequest("https://receipts.example/payer/id", {
            headers: {
                "x-forwarded-for": "198.51.100.99",
                "x-vercel-forwarded-for": "::ffff:203.0.113.10",
            },
        });

        expect(getTrustedRequestAddress(spoofed)).toBeNull();

        vi.stubEnv("VERCEL", "1");
        expect(getTrustedRequestAddress(spoofed)).toBe("203.0.113.10");
    });
});
