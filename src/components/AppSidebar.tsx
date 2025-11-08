"use client";

import React from "react";
import {
    Home,
    CreditCard,
    Users,
    ShoppingBag,
    FileText,
    Menu,
    X,
} from "lucide-react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { NAV_LINKS } from "@/lib/constants";

const iconMap = {
    Home,
    CreditCard,
    Users,
    ShoppingBag,
    FileText,
};

type Props = {
    className: string;
};

const navLinks = NAV_LINKS.map((link) => ({
    ...link,
    icon: iconMap[link.icon as keyof typeof iconMap]
        ? React.createElement(iconMap[link.icon as keyof typeof iconMap], {
              className: "w-5 h-5 text-neutral-700 dark:text-neutral-200",
          })
        : null,
}));

export default function AppSidebar({ className }: Props) {
    return (
        <div className={className} data-component="app-sidebar">
            <Sidebar open={true} animate={false}>
                <SidebarBody className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        {navLinks.map((link) => (
                            <SidebarLink key={link.href} link={link} />
                        ))}
                    </div>
                </SidebarBody>
            </Sidebar>
        </div>
    );
}
