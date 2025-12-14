import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "subtle" | "outline" | "danger";

type ActionButtonProps = {
    label: string;
    icon?: ReactNode;
    variant?: Variant;
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    showLabelOnMobile?: boolean;
    ariaLabel?: string;
};

const VARIANT_CLASSES: Record<Variant, string> = {
    subtle:
        "bg-white text-gray-900 hover:bg-gray-100 border border-gray-200",
    outline: "btn-outline",
    danger: "btn-error text-white",
};

const BASE_CLASSES =
    "btn btn-sm min-h-[44px] md:min-h-[32px] px-3 py-2 md:py-1 flex items-center gap-2";

export default function ActionButton({
    label,
    icon,
    variant = "subtle",
    href,
    onClick,
    disabled = false,
    className,
    showLabelOnMobile = false,
    ariaLabel,
}: ActionButtonProps) {
    const content = (
        <>
            {icon}
            <span className={showLabelOnMobile ? "" : "hidden md:inline"}>
                {label}
            </span>
        </>
    );

    const composedClasses = cn(
        BASE_CLASSES,
        VARIANT_CLASSES[variant],
        className,
    );

    if (href) {
        return (
            <Link
                href={href}
                className={composedClasses}
                aria-label={ariaLabel ?? label}
            >
                {content}
            </Link>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={composedClasses}
            aria-label={ariaLabel ?? label}
        >
            {content}
        </button>
    );
}
