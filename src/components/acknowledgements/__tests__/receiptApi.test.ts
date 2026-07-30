import { afterEach, describe, expect, it, vi } from "vitest";

import { requestReceiptAction } from "@/components/acknowledgements/receiptApi";

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
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => payload,
            }),
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
            vi.fn().mockResolvedValue({
                ok: false,
                status: 409,
                json: async () => ({
                    error: "This receipt changed. Reload and try again.",
                }),
            }),
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
});
