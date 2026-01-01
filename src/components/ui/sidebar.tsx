"use client";

import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";

const SIDEBAR_DESKTOP_WIDTH = "200px";

interface SidebarLinkItem {
    label: string;
    href: string;
    icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
    undefined,
);

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
};

export const SidebarProvider = ({
    children,
    open: openProp,
    setOpen: setOpenProp,
    animate = true,
}: {
    children: React.ReactNode;
    open?: boolean;
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
    animate?: boolean;
}) => {
    const [openState, setOpenState] = useState(false);

    const open = openProp !== undefined ? openProp : openState;
    const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

    return (
        <SidebarContext.Provider value={{ open, setOpen, animate }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const Sidebar = ({
    children,
    open,
    setOpen,
    animate,
}: {
    children: React.ReactNode;
    open?: boolean;
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
    animate?: boolean;
    className?: string;
}) => {
    return (
        <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
            {children}
        </SidebarProvider>
    );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
    return (
        <>
            <DesktopSidebar {...props} />
            <MobileSidebar {...(props as React.ComponentProps<"div">)} />
        </>
    );
};

export const DesktopSidebar = ({
    className,
    children,
    ...props
}: React.ComponentProps<typeof motion.div>) => {
    const { open, animate } = useSidebar();
    return (
        <motion.div
            className={cn(
                "h-full px-4 py-4 hidden md:flex md:flex-col flex-shrink-0 max-md:hidden",
                className,
            )}
            style={{
                width: animate
                    ? open
                        ? SIDEBAR_DESKTOP_WIDTH
                        : "60px"
                    : SIDEBAR_DESKTOP_WIDTH,
            }}
            animate={{
                width: animate
                    ? open
                        ? SIDEBAR_DESKTOP_WIDTH
                        : "60px"
                    : SIDEBAR_DESKTOP_WIDTH,
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
};

// deprecated since we now use BottomNavigation for mobile nav but keeping this
export const MobileSidebar = ({
    className,
    children,
}: React.ComponentProps<"div">) => {
    const { open, setOpen } = useSidebar();
    return (
        <>
            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{
                                duration: 0.3,
                                ease: "easeInOut",
                            }}
                            className="fixed inset-0 bg-black bg-opacity-50 z-[40] md:hidden"
                            onClick={() => setOpen(false)}
                        />
                        <motion.div
                            initial={{ x: "-100%", opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: "-100%", opacity: 0 }}
                            transition={{
                                duration: 0.3,
                                ease: "easeInOut",
                            }}
                            className={cn(
                                "fixed h-full w-[80%] inset-y-0 left-0 dark:bg-neutral-900 p-10 z-[50] flex flex-col justify-between md:hidden",
                                className,
                            )}
                        >
                            {children}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export const SidebarLink = ({
    link,
    className,
    ...props
}: {
    link: SidebarLinkItem;
    className?: string;
} & Omit<LinkProps, "href">) => {
    const { open, animate } = useSidebar();
    return (
        <Link
            href={link.href}
            className={cn(
                "flex items-center justify-start gap-2 group/sidebar py-2",
                className,
            )}
            {...props}
        >
            {link.icon}
            <motion.span
                animate={{
                    opacity: animate ? (open ? 1 : 0) : 1,
                    transform: animate
                        ? open
                            ? "translateX(0)"
                            : "translateX(-10px)"
                        : "translateX(0)",
                }}
                transition={{
                    duration: 0.2,
                    ease: "easeInOut",
                }}
                className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0 overflow-hidden"
                style={{
                    maxWidth: animate
                        ? open
                            ? SIDEBAR_DESKTOP_WIDTH
                            : "0"
                        : SIDEBAR_DESKTOP_WIDTH,
                }}
            >
                {link.label}
            </motion.span>
        </Link>
    );
};
