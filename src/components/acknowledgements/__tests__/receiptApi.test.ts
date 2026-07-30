import { afterEach, describe, expect, it, vi } from "vitest";

import {
    ReceiptAuthExpiredError,
    requestJson,
    requestReceiptAction,
} from "@/components/acknowledgements/receiptApi";

function jsonResponse(payload: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        redirected: false,
        url: "http://localhost/api/acknowledgements",
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => payload,
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("requestReceiptAction", () => {
    it("keeps the publish portal credential response intact", async () => {
        const payload = {
            receipt: { id: "receipt-id", revisionNumber: 2 },
            portalCredential: {
                portal: { publicId: "public-id" },
                pin: "482913",
            },
        };
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonResponse(payload)),
        );

        await expect(
            requestReceiptAction("receipt-id", {
                type: "publish",
                expectedRevision: 1,
            }),
        ).resolves.toEqual(payload);
    });

    it("identifies a stale revision conflict so the detail view can reload", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                jsonResponse(
                    {
                        error: "This receipt changed. Reload and try again.",
                    },
                    409,
                ),
            ),
        );

        await expect(
            requestReceiptAction("receipt-id", {
                type: "confirm",
                expectedRevision: 1,
            }),
        ).rejects.toMatchObject({
            status: 409,
            isConflict: true,
        });
    });

    it("treats a redirected HTML login page as expired receiver auth", async () => {
        const assign = vi.fn();
        vi.stubGlobal("window", {
            location: {
                pathname: "/acknowledgements",
                assign,
            },
        });
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                redirected: true,
                url: "http://localhost/enter-password",
                headers: new Headers({ "Content-Type": "text/html" }),
                json: async () => {
                    throw new SyntaxError("HTML is not JSON");
                },
            }),
        );

        await expect(
            requestJson("/api/acknowledgements"),
        ).rejects.toBeInstanceOf(ReceiptAuthExpiredError);
        expect(assign).toHaveBeenCalledWith("/enter-password");
    });

    it("treats a 401 as expired auth without redirecting again on the login page", async () => {
        const assign = vi.fn();
        vi.stubGlobal("window", {
            location: {
                pathname: "/enter-password",
                assign,
            },
        });
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValue(
                    jsonResponse({ error: "Unauthorized" }, 401),
                ),
        );

        await expect(
            requestJson("/api/acknowledgements"),
        ).rejects.toBeInstanceOf(ReceiptAuthExpiredError);
        expect(assign).not.toHaveBeenCalled();
    });

    it("rejects a non-JSON success response instead of blind casting it", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                redirected: false,
                url: "http://localhost/api/acknowledgements",
                headers: new Headers({ "Content-Type": "text/plain" }),
                json: async () => {
                    throw new SyntaxError("not JSON");
                },
            }),
        );

        await expect(
            requestJson("/api/acknowledgements"),
        ).rejects.toMatchObject({
            status: 200,
            message: expect.stringMatching(/JSON/i),
        });
    });
});
