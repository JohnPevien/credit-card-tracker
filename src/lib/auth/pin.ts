import {
    randomBytes,
    randomInt,
    scrypt as nodeScrypt,
    timingSafeEqual,
} from "node:crypto";

const PIN_PATTERN = /^\d{6}$/;
const PIN_UPPER_BOUND = 1_000_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const ENCODING_VERSION = "scrypt";

const scrypt = (pin: string, salt: Buffer) =>
    new Promise<Buffer>((resolve, reject) => {
        nodeScrypt(pin, salt, HASH_BYTES, (error, derivedKey) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(derivedKey);
        });
    });

export function generatePin(): string {
    return randomInt(PIN_UPPER_BOUND).toString().padStart(6, "0");
}

export async function hashPin(pin: string): Promise<string> {
    if (!PIN_PATTERN.test(pin)) {
        throw new Error("PIN must contain exactly six numeric digits");
    }

    const salt = randomBytes(SALT_BYTES);
    const digest = await scrypt(pin, salt);

    return [
        ENCODING_VERSION,
        salt.toString("base64url"),
        digest.toString("base64url"),
    ].join("$");
}

export async function verifyPin(
    pin: string,
    encoded: string,
): Promise<boolean> {
    if (!PIN_PATTERN.test(pin)) {
        return false;
    }

    const [version, encodedSalt, encodedDigest, extraPart] = encoded.split("$");
    if (
        version !== ENCODING_VERSION ||
        !encodedSalt ||
        !encodedDigest ||
        extraPart
    ) {
        return false;
    }

    try {
        const salt = Buffer.from(encodedSalt, "base64url");
        const expectedDigest = Buffer.from(encodedDigest, "base64url");
        if (
            salt.length !== SALT_BYTES ||
            expectedDigest.length !== HASH_BYTES
        ) {
            return false;
        }

        const actualDigest = await scrypt(pin, salt);
        return timingSafeEqual(actualDigest, expectedDigest);
    } catch {
        return false;
    }
}
