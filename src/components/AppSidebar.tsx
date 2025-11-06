"use client";

import { Home, CreditCard, Users, ShoppingBag, FileText } from "lucide-react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useState } from "react";

const navLinks = [
    {
        label: "Home",
        href: "/",
        icon: (
            <Home className="w-5 h-5 text-neutral-700 dark:text-neutral-200" />
        ),
    },
    {
        label: "Credit Cards",
        href: "/credit-cards",
        icon: (
            <CreditCard className="w-5 h-5 text-neutral-700 dark:text-neutral-200" />
        ),
    },
    {
        label: "Persons",
        href: "/persons",
        icon: (
            <Users className="w-5 h-5 text-neutral-700 dark:text-neutral-200" />
        ),
    },
    {
        label: "Purchases",
        href: "/purchases",
        icon: (
            <ShoppingBag className="w-5 h-5 text-neutral-700 dark:text-neutral-200" />
        ),
    },
    {
        label: "Transactions",
        href: "/transactions",
        icon: (
            <FileText className="w-5 h-5 text-neutral-700 dark:text-neutral-200" />
        ),
    },
];

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
                    <CreditCard className="h-6 w-6 text-neutral-800 dark:text-neutral-200" />
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
