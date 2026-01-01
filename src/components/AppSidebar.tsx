"use client";

import React from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { NAV_LINKS } from "@/lib/constants";
import { getNavigationIcon } from "@/lib/icons";

type Props = {
    className: string;
};

const navLinks = NAV_LINKS.map((link) => ({
    ...link,
    icon: getNavigationIcon(link.icon),
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
