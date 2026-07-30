import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
});
