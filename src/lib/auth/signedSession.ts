const MINIMUM_SECRET_LENGTH = 32;
const SESSION_VERSION = 1;

type SessionEnvelope = {
    version: typeof SESSION_VERSION;
    expiresAt: number;
    payload: unknown;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const isValidSecret = (secret: string) => secret.length >= MINIMUM_SECRET_LENGTH;

const encodeBase64Url = (bytes: Uint8Array) => {
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
};

const decodeBase64Url = (value: string): Uint8Array | null => {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
        return null;
    }

    try {
        const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
        const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }

        return bytes;
    } catch {
        return null;
    }
};

const createKey = (secret: string) =>
    crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );

const sign = async (value: string, secret: string) =>
    new Uint8Array(
        await crypto.subtle.sign("HMAC", await createKey(secret), encoder.encode(value)),
    );

const equalBytes = (left: Uint8Array, right: Uint8Array) => {
    if (left.length !== right.length) {
        return false;
    }

    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
        difference |= left[index] ^ right[index];
    }

    return difference === 0;
};

const isSessionEnvelope = (value: unknown): value is SessionEnvelope => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const envelope = value as Record<string, unknown>;
    return (
        envelope.version === SESSION_VERSION &&
        typeof envelope.expiresAt === "number" &&
        Number.isFinite(envelope.expiresAt) &&
        Object.hasOwn(envelope, "payload")
    );
};

export async function signSession<T>(
    payload: T,
    secret: string,
    expiresAt: number,
): Promise<string> {
    if (!isValidSecret(secret)) {
        throw new Error("Session secret must be at least 32 characters");
    }

    if (!Number.isFinite(expiresAt)) {
        throw new Error("Session expiry must be a finite timestamp");
    }

    const serializedPayload = JSON.stringify({
        version: SESSION_VERSION,
        expiresAt,
        payload,
    } satisfies SessionEnvelope);

    if (!serializedPayload) {
        throw new Error("Session payload must be JSON serializable");
    }

    const encodedPayload = encodeBase64Url(encoder.encode(serializedPayload));
    const signature = await sign(encodedPayload, secret);

    return `${encodedPayload}.${encodeBase64Url(signature)}`;
}

export async function verifySession<T>(
    token: string,
    secret: string,
    now = Date.now(),
): Promise<T | null> {
    if (!isValidSecret(secret) || !Number.isFinite(now)) {
        return null;
    }

    try {
        const [encodedPayload, encodedSignature, extraPart] = token.split(".");
        if (!encodedPayload || !encodedSignature || extraPart) {
            return null;
        }

        const suppliedSignature = decodeBase64Url(encodedSignature);
        if (!suppliedSignature) {
            return null;
        }

        const expectedSignature = await sign(encodedPayload, secret);
        if (!equalBytes(suppliedSignature, expectedSignature)) {
            return null;
        }

        const payloadBytes = decodeBase64Url(encodedPayload);
        if (!payloadBytes) {
            return null;
        }

        const parsedPayload: unknown = JSON.parse(decoder.decode(payloadBytes));
        if (!isSessionEnvelope(parsedPayload) || parsedPayload.expiresAt <= now) {
            return null;
        }

        return parsedPayload.payload as T;
    } catch {
        return null;
    }
}
