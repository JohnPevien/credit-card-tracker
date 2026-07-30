import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config, isPublicRequestPath, middleware } from "@/middleware";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("middleware public path matching", () => {
    it.each([
        "/payer/00000000-0000-4000-8000-000000000040",
        "/payer/00000000-0000-4000-8000-000000000040/",
        "/api/public/payer-portals/00000000-0000-4000-8000-000000000040/unlock",
        "/api/public/payer-portals/00000000-0000-4000-8000-000000000040/lock",
        "/api/public/payer-portals/00000000-0000-4000-8000-000000000040/receipts",
        "/api/public/payer-portals/00000000-0000-4000-8000-000000000040/receipts/00000000-0000-4000-8000-000000000010",
        "/api/public/payer-portals/00000000-0000-4000-8000-000000000040/receipts/00000000-0000-4000-8000-000000000010/confirm",
    ])("allows the exact public payer shape: %s", (pathname) => {
        expect(isPublicRequestPath(pathname)).toBe(true);
    });

    it.each([
        "/payer",
        "/payer/",
        "/payerish/00000000-0000-4000-8000-000000000040",
        "/payer/00000000-0000-4000-8000-000000000040/private",
        "/api/public/payer-portals",
        "/api/public/payer-portals/",
        "/api/public/payer-portals/00000000-0000-4000-8000-000000000040",
        "/api/public/payer-portals-evil/00000000-0000-4000-8000-000000000040/receipts",
        "/api/public/payer-portals/00000000-0000-4000-8000-000000000040/internal",
        "/api/payer-portals/00000000-0000-4000-8000-000000000040",
    ])(
        "keeps lookalike, incomplete, and internal paths protected: %s",
        (pathname) => {
            expect(isPublicRequestPath(pathname)).toBe(false);
        },
    );

    it("adds no-store, no-referrer, and noindex headers to public payer HTML", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("SITE_PASSWORD", "configured");

        const response = await middleware(
            new NextRequest(
                "https://receipts.example/payer/00000000-0000-4000-8000-000000000040",
            ),
        );

        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
        expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    });

    it("keeps payer HTML headers in development and without receiver-password configuration", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("SITE_PASSWORD", "");

        const response = await middleware(
            new NextRequest(
                "https://receipts.example/payer/00000000-0000-4000-8000-000000000040",
            ),
        );

        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
        expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    });

    it("does not exclude public-path lookalikes before exact matching runs", () => {
        expect(config.matcher.join("\n")).not.toContain("api/site-auth");
        expect(config.matcher.join("\n")).not.toContain("enter-password");
    });
});
