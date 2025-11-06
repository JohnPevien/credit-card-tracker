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
import { useState } from "react";
import { NAV_LINKS } from "@/lib/constants";

const iconMap = {
    Home,
    CreditCard,
    Users,
    ShoppingBag,
    FileText,
};

const navLinks = NAV_LINKS.map((link) => ({
    ...link,
    icon: iconMap[link.icon as keyof typeof iconMap]
        ? React.createElement(iconMap[link.icon as keyof typeof iconMap], {
              className: "w-5 h-5 text-neutral-700 dark:text-neutral-200",
          })
        : null,
}));

export default function AppSidebar() {
    const [open, setOpen] = useState(false);

    return (
        <Sidebar
            open={open}
            setOpen={setOpen}
            animate={true}
            data-component="app-sidebar"
        >
            <SidebarBody className="flex flex-col gap-4">
                <div
                    className="flex items-center gap-2 mb-6 cursor-pointer"
                    onClick={() => setOpen(!open)}
                >
                    {open ? (
                        <X className="h-6 w-6 text-neutral-800 dark:text-neutral-200" />
                    ) : (
                        <Menu className="h-6 w-6 text-neutral-800 dark:text-neutral-200" />
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    {navLinks.map((link) => (
                        <SidebarLink key={link.href} link={link} />
                    ))}
                </div>
            </SidebarBody>
        </Sidebar>
    );
}
