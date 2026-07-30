import {
    Ban,
    CheckCircle2,
    CircleDashed,
    Clock3,
    FilePenLine,
    UserCheck,
} from "lucide-react";

import type { ReceiptStatus } from "@/lib/acknowledgements/types";

const statusPresentation = {
    draft: {
        label: "Draft",
        Icon: FilePenLine,
        className: "border-slate-600 bg-slate-800 text-slate-100",
    },
    awaiting_both: {
        label: "Awaiting both",
        Icon: Clock3,
        className: "border-amber-700/70 bg-amber-950/70 text-amber-100",
    },
    awaiting_payer: {
        label: "Awaiting payer",
        Icon: CircleDashed,
        className: "border-sky-700/70 bg-sky-950/70 text-sky-100",
    },
    awaiting_receiver: {
        label: "Awaiting receiver",
        Icon: UserCheck,
        className: "border-orange-700/70 bg-orange-950/70 text-orange-100",
    },
    completed: {
        label: "Completed",
        Icon: CheckCircle2,
        className: "border-emerald-700/70 bg-emerald-950/70 text-emerald-100",
    },
    voided: {
        label: "Void",
        Icon: Ban,
        className: "border-rose-700/70 bg-rose-950/70 text-rose-100",
    },
} satisfies Record<
    ReceiptStatus,
    {
        label: string;
        Icon: typeof CheckCircle2;
        className: string;
    }
>;

export default function ReceiptStatusBadge({
    status,
}: {
    status: ReceiptStatus;
}) {
    const { label, Icon, className } = statusPresentation[status];

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide ${className}`}
            role="status"
        >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
        </span>
    );
}
