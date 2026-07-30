import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PortalAccessCard from "@/components/acknowledgements/PortalAccessCard";

const portal = {
    personId: "4f2dc79d-62f7-4db4-b661-6cf95dfca3aa",
    payerName: "Alex Rivera",
    publicId: "39ecc191-2dde-430a-80c4-472aeb46a85f",
    credentialVersion: 1,
    revokedAt: null,
    lastAccessedAt: null,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
};

describe("PortalAccessCard", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("shows a PIN only from the current one-time credential response", () => {
        const { rerender } = render(
            <PortalAccessCard
                portal={portal}
                transientPin="482913"
                onAction={vi.fn()}
            />,
        );

        expect(screen.getByText("482913")).toBeInTheDocument();
        expect(screen.getByText(/shown once/i)).toBeInTheDocument();

        rerender(
            <PortalAccessCard
                portal={portal}
                transientPin={null}
                onAction={vi.fn()}
            />,
        );

        expect(screen.queryByText("482913")).not.toBeInTheDocument();
        expect(
            screen.getByText(/PIN cannot be recovered/i),
        ).toBeInTheDocument();
    });

    it.each(["Reset PIN", "Rotate link", "Revoke"])(
        "requires explicit confirmation before %s",
        async (actionLabel) => {
            const user = userEvent.setup();
            const onAction = vi.fn();
            vi.spyOn(window, "confirm").mockReturnValue(false);

            render(
                <PortalAccessCard
                    portal={portal}
                    transientPin={null}
                    onAction={onAction}
                />,
            );

            await user.click(screen.getByRole("button", { name: actionLabel }));

            expect(window.confirm).toHaveBeenCalledOnce();
            expect(onAction).not.toHaveBeenCalled();
        },
    );

    it("blocks overlapping credential actions and ignores a late unmounted result", async () => {
        const user = userEvent.setup();
        let resolveAction:
            | ((value: { portal: typeof portal; pin: string | null }) => void)
            | undefined;
        const deferredAction = new Promise<{
            portal: typeof portal;
            pin: string | null;
        }>((resolve) => {
            resolveAction = resolve;
        });
        const onAction = vi.fn().mockReturnValue(deferredAction);
        const onResult = vi.fn();
        vi.spyOn(window, "confirm").mockReturnValue(true);

        const { unmount } = render(
            <PortalAccessCard
                portal={portal}
                transientPin={null}
                onAction={onAction}
                onResult={onResult}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Reset PIN" }));

        expect(
            screen.getByRole("button", { name: "Rotate link" }),
        ).toBeDisabled();
        expect(screen.getByRole("button", { name: "Revoke" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Rotate link" }));
        expect(onAction).toHaveBeenCalledTimes(1);

        unmount();
        resolveAction?.({
            portal: { ...portal, credentialVersion: 2 },
            pin: "842619",
        });
        await deferredAction;

        expect(onResult).not.toHaveBeenCalled();
    });

    it("gives every portal action a mobile-sized tap target", () => {
        render(
            <PortalAccessCard
                portal={portal}
                transientPin={null}
                onAction={vi.fn()}
            />,
        );

        for (const name of [
            "Copy link",
            "Reset PIN",
            "Rotate link",
            "Revoke",
        ]) {
            expect(screen.getByRole("button", { name })).toHaveClass(
                "min-h-11",
            );
        }
    });
});
