import { describe, expect, it } from "vitest";

import { generatePin, hashPin, verifyPin } from "../pin";

describe("portal PIN credentials", () => {
    it("generates exactly six numeric digits", () => {
        for (let index = 0; index < 25; index += 1) {
            expect(generatePin()).toMatch(/^\d{6}$/);
        }
    });

    it("uses a distinct salt each time the same PIN is hashed", async () => {
        const first = await hashPin("123456");
        const second = await hashPin("123456");

        expect(first).not.toBe(second);
        await expect(verifyPin("123456", first)).resolves.toBe(true);
        await expect(verifyPin("123456", second)).resolves.toBe(true);
    });

    it("rejects an incorrect PIN and malformed stored credentials", async () => {
        const encoded = await hashPin("123456");

        await expect(verifyPin("654321", encoded)).resolves.toBe(false);
        await expect(verifyPin("123456", "not-a-scrypt-hash")).resolves.toBe(
            false,
        );
    });
});
