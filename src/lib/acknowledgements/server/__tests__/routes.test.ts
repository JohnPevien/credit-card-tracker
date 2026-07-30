import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyReceiverRequest } from "@/lib/auth/receiverSession";
import {
    createReceipt,
    getReceipt,
    getReceiptFormMeta,
    listReceipts,
    performReceiptAction,
    updateReceipt,
} from "../receiptService";
import { getPortalAccess, managePortalAccess } from "../portalAdminService";
import {
    ReceiptConflictError,
    ReceiptNotFoundError,
    ReceiptUnexpectedError,
    ReceiptValidationError,
} from "../http";
import {
    GET as listRoute,
    POST as createRoute,
} from "@/app/api/acknowledgements/route";
import { GET as metaRoute } from "@/app/api/acknowledgements/meta/route";
import {
    GET as detailRoute,
    PATCH as updateRoute,
} from "@/app/api/acknowledgements/[id]/route";
import { POST as actionRoute } from "@/app/api/acknowledgements/[id]/actions/route";
import {
    GET as portalDetailRoute,
    POST as portalActionRoute,
} from "@/app/api/payer-portals/[personId]/route";

vi.mock("@/lib/auth/receiverSession", () => ({
    verifyReceiverRequest: vi.fn(),
}));

vi.mock("../receiptService", () => ({
    createReceipt: vi.fn(),
    getReceipt: vi.fn(),
    getReceiptFormMeta: vi.fn(),
    listReceipts: vi.fn(),
    performReceiptAction: vi.fn(),
    updateReceipt: vi.fn(),
}));

vi.mock("../portalAdminService", () => ({
    getPortalAccess: vi.fn(),
    managePortalAccess: vi.fn(),
}));

const receiptId = "00000000-0000-4000-8000-000000000010";
const personId = "00000000-0000-4000-8000-000000000020";
const receipt = { id: receiptId, receiptNumber: "AR-2026-000001" };

const request = (
    path: string,
    method = "GET",
    body?: Record<string, unknown>,
) =>
    new NextRequest(`http://localhost${path}`, {
        method,
        ...(body
            ? {
                  body: JSON.stringify(body),
                  headers: { "Content-Type": "application/json" },
              }
            : {}),
    });

const receiptContext = { params: Promise.resolve({ id: receiptId }) };
const portalContext = { params: Promise.resolve({ personId }) };

describe("receiver acknowledgement routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(verifyReceiverRequest).mockResolvedValue(true);
        vi.mocked(listReceipts).mockResolvedValue([]);
        vi.mocked(getReceipt).mockResolvedValue(receipt as never);
        vi.mocked(createReceipt).mockResolvedValue(receipt as never);
        vi.mocked(updateReceipt).mockResolvedValue(receipt as never);
        vi.mocked(performReceiptAction).mockResolvedValue({
            receipt,
            portalCredential: null,
        } as never);
        vi.mocked(getReceiptFormMeta).mockResolvedValue({
            persons: [],
            transactions: [],
        });
        vi.mocked(getPortalAccess).mockResolvedValue(null);
        vi.mocked(managePortalAccess).mockResolvedValue({
            portal: {
                personId,
                payerName: "Ada",
                publicId: "00000000-0000-4000-8000-000000000040",
                credentialVersion: 1,
                revokedAt: null,
                lastAccessedAt: null,
                createdAt: "2026-07-30T00:00:00.000Z",
                updatedAt: "2026-07-30T00:00:00.000Z",
            },
            pin: "123456",
        });
    });

    it.each([
        ["receipt list", () => listRoute(request("/api/acknowledgements"))],
        [
            "receipt create",
            () =>
                createRoute(
                    request("/api/acknowledgements", "POST", {
                        payerPersonId: personId,
                        receiverName: "Rene",
                        amount: 100,
                        paymentDate: "2026-07-30",
                    }),
                ),
        ],
        [
            "form metadata",
            () => metaRoute(request("/api/acknowledgements/meta")),
        ],
        [
            "receipt detail",
            () =>
                detailRoute(
                    request(`/api/acknowledgements/${receiptId}`),
                    receiptContext,
                ),
        ],
        [
            "receipt update",
            () =>
                updateRoute(
                    request(`/api/acknowledgements/${receiptId}`, "PATCH", {
                        payerPersonId: personId,
                        receiverName: "Rene",
                        amount: 100,
                        paymentDate: "2026-07-30",
                        expectedRevision: 1,
                    }),
                    receiptContext,
                ),
        ],
        [
            "receipt action",
            () =>
                actionRoute(
                    request(
                        `/api/acknowledgements/${receiptId}/actions`,
                        "POST",
                        { type: "publish", expectedRevision: 1 },
                    ),
                    receiptContext,
                ),
        ],
        [
            "portal detail",
            () =>
                portalDetailRoute(
                    request(`/api/payer-portals/${personId}`),
                    portalContext,
                ),
        ],
        [
            "portal action",
            () =>
                portalActionRoute(
                    request(`/api/payer-portals/${personId}`, "POST", {
                        type: "generate-pin",
                    }),
                    portalContext,
                ),
        ],
    ])(
        "authenticates the %s handler even in development",
        async (_, invoke) => {
            vi.mocked(verifyReceiverRequest).mockResolvedValue(false);

            const response = await invoke();

            expect(response.status).toBe(401);
            expect(response.headers.get("Cache-Control")).toBe("no-store");
            expect(verifyReceiverRequest).toHaveBeenCalledOnce();
            expect(listReceipts).not.toHaveBeenCalled();
            expect(getReceipt).not.toHaveBeenCalled();
            expect(createReceipt).not.toHaveBeenCalled();
            expect(updateReceipt).not.toHaveBeenCalled();
            expect(performReceiptAction).not.toHaveBeenCalled();
            expect(getReceiptFormMeta).not.toHaveBeenCalled();
            expect(getPortalAccess).not.toHaveBeenCalled();
            expect(managePortalAccess).not.toHaveBeenCalled();
        },
    );

    it("maps validated list filters and payer metadata selection", async () => {
        await listRoute(
            request(
                `/api/acknowledgements?status=draft&payerPersonId=${personId}&query=Ada`,
            ),
        );
        await metaRoute(
            request(`/api/acknowledgements/meta?payerPersonId=${personId}`),
        );

        expect(listReceipts).toHaveBeenCalledWith({
            status: "draft",
            payerPersonId: personId,
            query: "Ada",
        });
        expect(getReceiptFormMeta).toHaveBeenCalledWith(personId);
    });

    it("maps collection and detail mutations to one service call", async () => {
        const createResponse = await createRoute(
            request("/api/acknowledgements", "POST", {
                payerPersonId: personId,
                receiverName: "Rene",
                amount: 100,
                paymentDate: "2026-07-30",
            }),
        );
        const updateResponse = await updateRoute(
            request(`/api/acknowledgements/${receiptId}`, "PATCH", {
                payerPersonId: personId,
                receiverName: "Rene",
                amount: 100,
                paymentDate: "2026-07-30",
                expectedRevision: 1,
            }),
            receiptContext,
        );
        const actionResponse = await actionRoute(
            request(`/api/acknowledgements/${receiptId}/actions`, "POST", {
                type: "confirm",
                expectedRevision: 1,
            }),
            receiptContext,
        );

        expect(createResponse.status).toBe(201);
        expect(updateResponse.status).toBe(200);
        expect(actionResponse.status).toBe(200);
        expect(createReceipt).toHaveBeenCalledOnce();
        expect(updateReceipt).toHaveBeenCalledWith(
            receiptId,
            expect.objectContaining({ expectedRevision: 1 }),
        );
        expect(performReceiptAction).toHaveBeenCalledWith(receiptId, {
            type: "confirm",
            expectedRevision: 1,
        });
    });

    it("returns generated portal PINs only in credential action responses", async () => {
        const detailResponse = await portalDetailRoute(
            request(`/api/payer-portals/${personId}`),
            portalContext,
        );
        const actionResponse = await portalActionRoute(
            request(`/api/payer-portals/${personId}`, "POST", {
                type: "generate-pin",
            }),
            portalContext,
        );

        expect(await detailResponse.json()).toEqual({ portal: null });
        expect(await actionResponse.json()).toEqual({
            portal: expect.objectContaining({ personId }),
            pin: "123456",
        });
        expect(managePortalAccess).toHaveBeenCalledWith(personId, {
            type: "generate-pin",
        });
    });

    it("surfaces a publish-created PIN only in the immediate action response", async () => {
        vi.mocked(performReceiptAction).mockResolvedValue({
            receipt,
            portalCredential: {
                portal: {
                    personId,
                    payerName: "Ada",
                    publicId: "00000000-0000-4000-8000-000000000040",
                    credentialVersion: 1,
                    revokedAt: null,
                    lastAccessedAt: null,
                    createdAt: "2026-07-30T00:00:00.000Z",
                    updatedAt: "2026-07-30T00:00:00.000Z",
                },
                pin: "123456",
            },
        } as never);

        const response = await actionRoute(
            request(`/api/acknowledgements/${receiptId}/actions`, "POST", {
                type: "publish",
                expectedRevision: 1,
            }),
            receiptContext,
        );

        expect(await response.json()).toEqual({
            receipt,
            portalCredential: {
                portal: expect.objectContaining({ personId }),
                pin: "123456",
            },
        });
    });

    it("rejects malformed route input without calling a service", async () => {
        const response = await actionRoute(
            request(`/api/acknowledgements/${receiptId}/actions`, "POST", {
                type: "void",
                expectedRevision: 1,
                reason: "",
            }),
            receiptContext,
        );

        expect(response.status).toBe(400);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(performReceiptAction).not.toHaveBeenCalled();
    });

    it("rejects impossible calendar dates in list filters", async () => {
        const response = await listRoute(
            request("/api/acknowledgements?paymentDateFrom=2026-02-31"),
        );

        expect(response.status).toBe(400);
        expect(listReceipts).not.toHaveBeenCalled();
    });

    it.each([
        {
            error: new ReceiptValidationError("Invalid receipt"),
            status: 400,
            message: "Invalid receipt",
        },
        {
            error: new ReceiptNotFoundError("Receipt was not found"),
            status: 404,
            message: "Receipt was not found",
        },
        {
            error: new ReceiptConflictError("Receipt revision conflict"),
            status: 409,
            message: "Receipt revision conflict",
        },
        {
            error: new ReceiptUnexpectedError("Database detail"),
            status: 500,
            message: "Internal server error",
        },
    ])(
        "maps service failures to HTTP $status without caching",
        async ({ error, status, message }) => {
            vi.mocked(getReceipt).mockRejectedValue(error);
            const consoleError = vi
                .spyOn(console, "error")
                .mockImplementation(() => undefined);

            const response = await detailRoute(
                request(`/api/acknowledgements/${receiptId}`),
                receiptContext,
            );

            expect(response.status).toBe(status);
            expect(response.headers.get("Cache-Control")).toBe("no-store");
            expect(await response.json()).toEqual({ error: message });
            consoleError.mockRestore();
        },
    );
});
