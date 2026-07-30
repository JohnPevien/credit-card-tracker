import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => ({ kind: "server-client" })),
}));

describe("server Supabase client", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.mocked(createClient).mockClear();
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
        vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("does not read configuration or create a client at module import time", async () => {
        await import("../server");

        expect(createClient).not.toHaveBeenCalled();
    });

    it("throws a value-free configuration error when first used without credentials", async () => {
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
        const { getServerSupabase } = await import("../server");

        expect(() => getServerSupabase()).toThrow(
            "Server Supabase configuration is incomplete",
        );
        expect(() => getServerSupabase()).not.toThrow(/example\.supabase\.co/);
        expect(createClient).not.toHaveBeenCalled();
    });

    it("creates one non-persistent service-role client lazily", async () => {
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
        vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "top-secret-service-key");
        const { getServerSupabase } = await import("../server");

        const first = getServerSupabase();
        const second = getServerSupabase();

        expect(first).toBe(second);
        expect(createClient).toHaveBeenCalledOnce();
        expect(createClient).toHaveBeenCalledWith(
            "https://example.supabase.co",
            "top-secret-service-key",
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                },
            },
        );
    });
});
