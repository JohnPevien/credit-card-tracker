import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadToSignedUrl = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
    supabase: {
        storage: {
            from: () => ({ uploadToSignedUrl }),
        },
    },
}));

import ProofUploader from "../ProofUploader";

const RECEIPT_ID = "00000000-0000-4000-8000-000000000010";

const proof = (index: number) => ({
    id: `00000000-0000-4000-8000-00000000006${index}`,
    originalFilename: `proof-${index}.png`,
    contentType: "image/png" as const,
    sizeBytes: 12,
    uploaderRole: "receiver" as const,
    removedAt: null,
    createdAt: "2026-07-30T00:00:00.000Z",
    downloadUrl: `https://storage.example/proof-${index}`,
});

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

describe("ProofUploader", () => {
    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(
                    jsonResponse({ path: "temp/path-1", token: "token-1" }),
                )
                .mockResolvedValueOnce(
                    jsonResponse({
                        proof: proof(1),
                        revisionNumber: 4,
                    }),
                ),
        );
        vi.stubGlobal(
            "URL",
            Object.assign(URL, {
                createObjectURL: vi.fn(
                    (file: File) => `blob:${file.name}-${file.size}`,
                ),
                revokeObjectURL: vi.fn(),
            }),
        );
        uploadToSignedUrl.mockResolvedValue({
            data: { path: "temp/path-1" },
            error: null,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it("shows accessible per-file feedback for unsupported and oversized images", async () => {
        render(
            <ProofUploader
                receiptId={RECEIPT_ID}
                revisionNumber={3}
                proofs={[]}
                uploaderRole="receiver"
                onChanged={vi.fn()}
            />,
        );

        const input = screen.getByLabelText("Choose proof images");
        const oversized = new File(["x"], "too-large.png", {
            type: "image/png",
        });
        Object.defineProperty(oversized, "size", {
            value: 10 * 1024 * 1024 + 1,
        });
        fireEvent.change(input, {
            target: {
                files: [
                    new File(["<svg/>"], "unsafe.svg", {
                        type: "image/svg+xml",
                    }),
                    oversized,
                ],
            },
        });

        expect(screen.getByRole("alert")).toHaveTextContent(
            /JPEG, PNG, or WebP/i,
        );
        expect(screen.getByRole("alert")).toHaveTextContent(/10 MiB/i);
    });

    it("disables selection at five active files and keeps controls at least 44px high", () => {
        render(
            <ProofUploader
                receiptId={RECEIPT_ID}
                revisionNumber={3}
                proofs={[0, 1, 2, 3, 4].map(proof)}
                uploaderRole="receiver"
                onChanged={vi.fn()}
            />,
        );

        expect(screen.getByLabelText("Choose proof images")).toBeDisabled();
        expect(
            screen.getAllByRole("button", { name: /Remove proof-/i })[0],
        ).toHaveClass("min-h-11");
    });

    it("uploads directly with the signed token and finalizes queued files with advancing revisions", async () => {
        const user = userEvent.setup();
        const onChanged = vi.fn();
        vi.mocked(fetch)
            .mockReset()
            .mockResolvedValueOnce(
                jsonResponse({ path: "temp/path-1", token: "token-1" }),
            )
            .mockResolvedValueOnce(
                jsonResponse({ proof: proof(1), revisionNumber: 4 }),
            )
            .mockResolvedValueOnce(
                jsonResponse({ path: "temp/path-2", token: "token-2" }),
            )
            .mockResolvedValueOnce(
                jsonResponse({ proof: proof(2), revisionNumber: 5 }),
            );
        uploadToSignedUrl
            .mockResolvedValueOnce({
                data: { path: "temp/path-1" },
                error: null,
            })
            .mockResolvedValueOnce({
                data: { path: "temp/path-2" },
                error: null,
            });
        render(
            <ProofUploader
                receiptId={RECEIPT_ID}
                revisionNumber={3}
                proofs={[]}
                uploaderRole="receiver"
                onChanged={onChanged}
            />,
        );
        const first = new File(["png-one"], "one.png", {
            type: "image/png",
        });
        const second = new File(["png-two"], "two.png", {
            type: "image/png",
        });

        await user.upload(screen.getByLabelText("Choose proof images"), [
            first,
            second,
        ]);
        await user.click(
            screen.getByRole("button", { name: "Upload 2 proof images" }),
        );

        await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));
        expect(uploadToSignedUrl).toHaveBeenNthCalledWith(
            1,
            "temp/path-1",
            "token-1",
            first,
            { contentType: "image/png", upsert: false },
        );
        expect(uploadToSignedUrl).toHaveBeenNthCalledWith(
            2,
            "temp/path-2",
            "token-2",
            second,
            { contentType: "image/png", upsert: false },
        );
        const finalizeBodies = vi
            .mocked(fetch)
            .mock.calls.filter(([url]) => String(url).endsWith("/finalize"))
            .map(([, init]) => JSON.parse(String(init?.body)));
        expect(finalizeBodies.map((body) => body.expectedRevision)).toEqual([
            3, 4,
        ]);
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });

    it("locks removal and retry mutations while a sequential upload queue is active", async () => {
        const user = userEvent.setup();
        let resolveUpload:
            | ((value: {
                  data: { path: string };
                  error: null;
              }) => void)
            | undefined;
        uploadToSignedUrl.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveUpload = resolve;
            }),
        );
        vi.mocked(fetch)
            .mockReset()
            .mockResolvedValueOnce(
                jsonResponse({ path: "temp/path-1", token: "token-1" }),
            )
            .mockResolvedValueOnce(
                jsonResponse({ proof: proof(2), revisionNumber: 4 }),
            );
        render(
            <ProofUploader
                receiptId={RECEIPT_ID}
                revisionNumber={3}
                proofs={[proof(1)]}
                uploaderRole="receiver"
                onChanged={vi.fn()}
            />,
        );
        await user.upload(
            screen.getByLabelText("Choose proof images"),
            new File(["png"], "queued.png", { type: "image/png" }),
        );
        await user.click(
            screen.getByRole("button", { name: "Upload 1 proof image" }),
        );
        await waitFor(() =>
            expect(uploadToSignedUrl).toHaveBeenCalledOnce(),
        );

        const remove = screen.getByRole("button", {
            name: "Remove proof-1.png",
        });
        expect(remove).toBeDisabled();
        await user.click(remove);
        expect(
            vi
                .mocked(fetch)
                .mock.calls.filter(([, init]) => init?.method === "DELETE"),
        ).toHaveLength(0);

        resolveUpload?.({
            data: { path: "temp/path-1" },
            error: null,
        });
        await waitFor(() =>
            expect(
                screen.queryByRole("button", {
                    name: "Upload 1 proof image",
                }),
            ).not.toBeInTheDocument(),
        );
    });

    it("does not retry an already-registered proof when the refresh callback fails", async () => {
        const user = userEvent.setup();
        const onChanged = vi.fn().mockRejectedValue(new Error("refresh failed"));
        render(
            <ProofUploader
                receiptId={RECEIPT_ID}
                revisionNumber={3}
                proofs={[]}
                uploaderRole="receiver"
                onChanged={onChanged}
            />,
        );
        await user.upload(
            screen.getByLabelText("Choose proof images"),
            new File(["png"], "saved.png", { type: "image/png" }),
        );
        await user.click(
            screen.getByRole("button", { name: "Upload 1 proof image" }),
        );

        expect(
            await screen.findByText(/proof was saved.*refresh/i),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Retry saved.png" }),
        ).not.toBeInTheDocument();
        expect(uploadToSignedUrl).toHaveBeenCalledOnce();
    });

    it("does not repeat an already-removed proof when the refresh callback fails", async () => {
        const user = userEvent.setup();
        const onChanged = vi.fn().mockRejectedValue(new Error("refresh failed"));
        vi.mocked(fetch)
            .mockReset()
            .mockResolvedValueOnce(jsonResponse({ revisionNumber: 4 }));
        render(
            <ProofUploader
                receiptId={RECEIPT_ID}
                revisionNumber={3}
                proofs={[proof(1)]}
                uploaderRole="receiver"
                onChanged={onChanged}
            />,
        );

        await user.click(
            screen.getByRole("button", { name: "Remove proof-1.png" }),
        );

        expect(
            await screen.findByText(/proof was removed.*refresh/i),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Remove proof-1.png" }),
        ).not.toBeInTheDocument();
        expect(fetch).toHaveBeenCalledOnce();
    });

    it("keeps a failed file available with an accessible retry control", async () => {
        const user = userEvent.setup();
        vi.mocked(fetch)
            .mockReset()
            .mockResolvedValueOnce(
                jsonResponse({ path: "temp/path-1", token: "token-1" }),
            )
            .mockResolvedValueOnce(
                jsonResponse({ path: "temp/path-2", token: "token-2" }),
            )
            .mockResolvedValueOnce(
                jsonResponse({ proof: proof(1), revisionNumber: 4 }),
            );
        uploadToSignedUrl
            .mockResolvedValueOnce({
                data: null,
                error: new Error("upload unavailable"),
            })
            .mockResolvedValueOnce({
                data: { path: "temp/path-1" },
                error: null,
            });
        render(
            <ProofUploader
                receiptId={RECEIPT_ID}
                revisionNumber={3}
                proofs={[]}
                uploaderRole="receiver"
                onChanged={vi.fn()}
            />,
        );
        await user.upload(
            screen.getByLabelText("Choose proof images"),
            new File(["png"], "retry.png", { type: "image/png" }),
        );
        await user.click(
            screen.getByRole("button", { name: "Upload 1 proof image" }),
        );

        const stagedFile = await screen.findByRole("listitem", {
            name: "retry.png",
        });
        expect(within(stagedFile).getByRole("alert")).toHaveTextContent(
            /could not be uploaded/i,
        );
        const retry = within(stagedFile).getByRole("button", {
            name: "Retry retry.png",
        });
        expect(retry).toHaveClass("min-h-11");
        await user.click(retry);
        await waitFor(() =>
            expect(uploadToSignedUrl).toHaveBeenCalledTimes(2),
        );
    });

    it("removes an active proof with the displayed revision and reports conflicts for refresh", async () => {
        const user = userEvent.setup();
        const onChanged = vi.fn();
        vi.mocked(fetch).mockReset().mockResolvedValueOnce(
            jsonResponse(
                { error: "Receipt revision conflict" },
                409,
            ),
        );
        render(
            <ProofUploader
                receiptId={RECEIPT_ID}
                revisionNumber={3}
                proofs={[proof(1)]}
                uploaderRole="receiver"
                onChanged={onChanged}
            />,
        );

        await user.click(
            screen.getByRole("button", { name: "Remove proof-1.png" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            /changed.*refresh/i,
        );
        expect(onChanged).toHaveBeenCalledWith(
            expect.objectContaining({ conflict: true }),
        );
    });
});
