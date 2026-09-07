import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyPayerPortalRequest } from "@/lib/auth/payerPortalSession";
import { verifyReceiverRequest } from "@/lib/auth/receiverSession";
import {
    finalizeProofUpload,
    removeProof,
    requestProofUpload,
} from "../proofService";
import { POST as receiverUploadRoute } from "@/app/api/acknowledgements/[id]/files/upload-url/route";
import { POST as receiverFinalizeRoute } from "@/app/api/acknowledgements/[id]/files/finalize/route";
import { DELETE as receiverRemoveRoute } from "@/app/api/acknowledgements/[id]/files/[fileId]/route";
import { POST as payerUploadRoute } from "@/app/api/public/payer-portals/[publicId]/receipts/[receiptId]/files/upload-url/route";
import { POST as payerFinalizeRoute } from "@/app/api/public/payer-portals/[publicId]/receipts/[receiptId]/files/finalize/route";
import { DELETE as payerRemoveRoute } from "@/app/api/public/payer-portals/[publicId]/receipts/[receiptId]/files/[fileId]/route";

vi.mock("@/lib/auth/payerPortalSession", () => ({
    verifyPayerPortalRequest: vi.fn(),
}));
vi.mock("@/lib/auth/receiverSession", () => ({
    verifyReceiverRequest: vi.fn(),
}));
vi.mock("../proofService", () => ({
    finalizeProofUpload: vi.fn(),
    removeProof: vi.fn(),
    requestProofUpload: vi.fn(),
}));

const PUBLIC_ID = "00000000-0000-4000-8000-000000000040";
const PERSON_ID = "00000000-0000-4000-8000-000000000020";
const RECEIPT_ID = "00000000-0000-4000-8000-000000000010";
const FILE_ID = "00000000-0000-4000-8000-000000000060";
const PATH =
    "receipts/00000000-0000-4000-8000-000000000010/tmp/00000000-0000-4000-8000-000000000070";

const receiverContext = { params: Promise.resolve({ id: RECEIPT_ID }) };
const receiverFileContext = {
    params: Promise.resolve({ id: RECEIPT_ID, fileId: FILE_ID }),
};
const payerContext = {
    params: Promise.resolve({ publicId: PUBLIC_ID, receiptId: RECEIPT_ID }),
};
const payerFileContext = {
    params: Promise.resolve({
        publicId: PUBLIC_ID,
        receiptId: RECEIPT_ID,
        fileId: FILE_ID,
    }),
};
const claim = {
    expectedRevision: 3,
    originalFilename: "proof.png",
    contentType: "image/png",
    sizeBytes: 12,
};

const request = (
    path: string,
    method: string,
    body: unknown,
    origin = "https://receipts.example",
) =>
    new NextRequest(`https://receipts.example${path}`, {
        method,
        headers: {
            origin,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyReceiverRequest).mockResolvedValue(true);
    vi.mocked(verifyPayerPortalRequest).mockResolvedValue({
        personId: PERSON_ID,
        publicId: PUBLIC_ID,
        credentialVersion: 1,
    });
    vi.mocked(requestProofUpload).mockResolvedValue({
        path: PATH,
        token: "token",
    });
    vi.mocked(finalizeProofUpload).mockResolvedValue({
        proof: { id: FILE_ID } as never,
        revisionNumber: 4,
    });
    vi.mocked(removeProof).mockResolvedValue({ revisionNumber: 4 });
});

describe("receiver proof routes", () => {
    it("authenticates before parsing and never accepts a client-selected actor", async () => {
        vi.mocked(verifyReceiverRequest).mockResolvedValue(false);
        const denied = request(
            `/api/acknowledgements/${RECEIPT_ID}/files/upload-url`,
            "POST",
            { ...claim, role: "payer", personId: PERSON_ID },
        );
        const json = vi.spyOn(denied, "json");

        const response = await receiverUploadRoute(denied, receiverContext);

        expect(response.status).toBe(401);
        expect(json).not.toHaveBeenCalled();
        expect(requestProofUpload).not.toHaveBeenCalled();
    });

    it("passes the receiver role server-side for preflight, finalize, and removal", async () => {
        await receiverUploadRoute(
            request(
                `/api/acknowledgements/${RECEIPT_ID}/files/upload-url`,
                "POST",
                claim,
            ),
            receiverContext,
        );
        await receiverFinalizeRoute(
            request(
                `/api/acknowledgements/${RECEIPT_ID}/files/finalize`,
                "POST",
                { ...claim, path: PATH },
            ),
            receiverContext,
        );
        await receiverRemoveRoute(
            request(
                `/api/acknowledgements/${RECEIPT_ID}/files/${FILE_ID}`,
                "DELETE",
                { expectedRevision: 4 },
            ),
            receiverFileContext,
        );

        expect(requestProofUpload).toHaveBeenCalledWith(
            { role: "receiver" },
            RECEIPT_ID,
            claim,
        );
        expect(finalizeProofUpload).toHaveBeenCalledWith(
            { role: "receiver" },
            RECEIPT_ID,
            { ...claim, path: PATH },
        );
        expect(removeProof).toHaveBeenCalledWith(
            { role: "receiver" },
            RECEIPT_ID,
            FILE_ID,
            4,
        );
    });
});

describe("public payer proof routes", () => {
    it("rejects cross-origin and expired sessions before body parsing with generic public errors", async () => {
        const crossOrigin = request(
            `/api/public/payer-portals/${PUBLIC_ID}/receipts/${RECEIPT_ID}/files/upload-url`,
            "POST",
            claim,
            "https://attacker.example",
        );
        const crossOriginJson = vi.spyOn(crossOrigin, "json");

        const crossOriginResponse = await payerUploadRoute(
            crossOrigin,
            payerContext,
        );

        expect(crossOriginResponse.status).toBe(403);
        expect(await crossOriginResponse.json()).toEqual({
            error: "Portal unavailable",
        });
        expect(crossOriginJson).not.toHaveBeenCalled();

        vi.mocked(verifyPayerPortalRequest).mockResolvedValue(null);
        const expired = request(
            `/api/public/payer-portals/${PUBLIC_ID}/receipts/${RECEIPT_ID}/files/finalize`,
            "POST",
            { ...claim, path: PATH },
        );
        const expiredJson = vi.spyOn(expired, "json");
        const expiredResponse = await payerFinalizeRoute(expired, payerContext);

        expect(expiredResponse.status).toBe(401);
        expect(expiredJson).not.toHaveBeenCalled();
        expect(finalizeProofUpload).not.toHaveBeenCalled();
    });

    it("passes only the verified Person and payer role to all public mutations", async () => {
        await payerUploadRoute(
            request(
                `/api/public/payer-portals/${PUBLIC_ID}/receipts/${RECEIPT_ID}/files/upload-url`,
                "POST",
                { ...claim, role: "receiver", personId: "attacker" },
            ),
            payerContext,
        );
        await payerFinalizeRoute(
            request(
                `/api/public/payer-portals/${PUBLIC_ID}/receipts/${RECEIPT_ID}/files/finalize`,
                "POST",
                { ...claim, path: PATH },
            ),
            payerContext,
        );
        await payerRemoveRoute(
            request(
                `/api/public/payer-portals/${PUBLIC_ID}/receipts/${RECEIPT_ID}/files/${FILE_ID}`,
                "DELETE",
                { expectedRevision: 4 },
            ),
            payerFileContext,
        );

        const payerActor = { role: "payer", personId: PERSON_ID };
        expect(requestProofUpload).toHaveBeenCalledWith(
            payerActor,
            RECEIPT_ID,
            claim,
        );
        expect(finalizeProofUpload).toHaveBeenCalledWith(
            payerActor,
            RECEIPT_ID,
            { ...claim, path: PATH },
        );
        expect(removeProof).toHaveBeenCalledWith(
            payerActor,
            RECEIPT_ID,
            FILE_ID,
            4,
        );
    });

    it("maps proof validation and conflict failures to generic safe public responses", async () => {
        const validationError = Object.assign(
            new Error(`Invalid private path ${PATH}`),
            { name: "ReceiptValidationError" },
        );
        vi.mocked(requestProofUpload).mockRejectedValueOnce(validationError);

        const invalidResponse = await payerUploadRoute(
            request(
                `/api/public/payer-portals/${PUBLIC_ID}/receipts/${RECEIPT_ID}/files/upload-url`,
                "POST",
                claim,
            ),
            payerContext,
        );

        expect(invalidResponse.status).toBe(400);
        expect(await invalidResponse.json()).toEqual({
            error: "Invalid request",
        });

        const conflictError = Object.assign(
            new Error(`Stale private path ${PATH}`),
            { name: "ReceiptConflictError" },
        );
        vi.mocked(removeProof).mockRejectedValueOnce(conflictError);
        const conflictResponse = await payerRemoveRoute(
            request(
                `/api/public/payer-portals/${PUBLIC_ID}/receipts/${RECEIPT_ID}/files/${FILE_ID}`,
                "DELETE",
                { expectedRevision: 3 },
            ),
            payerFileContext,
        );

        expect(conflictResponse.status).toBe(409);
        expect(await conflictResponse.json()).toEqual({
            error: "Receipt revision conflict",
        });
        for (const response of [invalidResponse, conflictResponse]) {
            expect(response.headers.get("Cache-Control")).toBe("no-store");
            expect(response.headers.get("Referrer-Policy")).toBe(
                "no-referrer",
            );
            expect(response.headers.get("X-Robots-Tag")).toBe(
                "noindex, nofollow",
            );
        }
    });
});
