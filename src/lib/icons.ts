import React from "react";
import {
    Home,
    CreditCard,
    Users,
    ShoppingBag,
    FileText,
    LucideIcon,
} from "lucide-react";

export type NavigationIconKey =
    | "Home"
    | "CreditCard"
    | "Users"
    | "ShoppingBag"
    | "FileText";

const NAVIGATION_ICON_MAP: Record<NavigationIconKey, LucideIcon> = {
    Home,
    CreditCard,
    Users,
    ShoppingBag,
    FileText,
};

export const DEFAULT_ICON_CLASS_NAME =
    "w-5 h-5 text-neutral-700 dark:text-neutral-200";

export const getNavigationIcon = (
    iconKey: NavigationIconKey,
    className = DEFAULT_ICON_CLASS_NAME,
) => {
    const IconComponent = NAVIGATION_ICON_MAP[iconKey];
    if (!IconComponent) {
        return null;
    }
    return React.createElement(IconComponent, { className });
};

export const getNavigationIconComponent = (
    iconKey: NavigationIconKey,
): LucideIcon | null => {
    return NAVIGATION_ICON_MAP[iconKey] || null;
};

export { NAVIGATION_ICON_MAP };
