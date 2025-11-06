"use client";

import { Home, CreditCard, Users, ShoppingBag, FileText } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "@/lib/constants";
import { useEffect, useRef } from "react";

const iconMap = {
    Home,
    CreditCard,
    Users,
    ShoppingBag,
    FileText,
};

interface BottomNavigationProps {
    className?: string;
}

export default function BottomNavigation({ className }: BottomNavigationProps) {
    const pathname = usePathname();
    const router = useRouter();
    const mainContentRef = useRef<HTMLDivElement>(null);

    const handleNavigation = (href: string) => {
        if (href === pathname) {
            // If already on this page, scroll to top
            const mainContent = document.querySelector('main[role="main"]');
            if (mainContent) {
                mainContent.scrollTo({ top: 0, behavior: "smooth" });
            }
        } else {
            // Save current scroll position before navigating
            const mainContent = document.querySelector('main[role="main"]');
            if (mainContent) {
                sessionStorage.setItem(
                    `scroll-${pathname}`,
                    mainContent.scrollTop.toString(),
                );
            }
            router.push(href);
        }
    };

    // Restore scroll position when component mounts or pathname changes
    useEffect(() => {
        const savedScroll = sessionStorage.getItem(`scroll-${pathname}`);
        const mainContent = document.querySelector('main[role="main"]');

        if (savedScroll && mainContent) {
            const scrollPosition = parseInt(savedScroll, 10);
            setTimeout(() => {
                mainContent.scrollTo({ top: scrollPosition, behavior: "auto" });
            }, 100);
        }
    }, [pathname]);

    return (
        <nav
            className={cn(
                "fixed bottom-0 left-0 right-0 z-50 bg-base-100 border-t border-base-300",
                "md:hidden", // Show from 0px to 768px
                "safe-area-inset-bottom", // Respect device safe areas
                className,
            )}
            role="navigation"
            aria-label="Main navigation"
        >
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                {NAV_LINKS.map((link) => {
                    const isActive = pathname === link.href;
                    const Icon = iconMap[link.icon as keyof typeof iconMap];

                    return (
                        <button
                            key={link.href}
                            onClick={() => handleNavigation(link.href)}
                            className={cn(
                                "flex flex-col items-center justify-center flex-1 h-full",
                                "min-w-[44px] min-h-[44px]", // Accessibility: minimum tap target
                                "transition-colors duration-200",
                                "text-base-content/60 hover:text-base-content",
                                isActive && "text-primary",
                                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                            )}
                            aria-label={`${link.label}${isActive ? ", selected" : ""}`}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <Icon
                                className={cn(
                                    "w-5 h-5 mb-1 transition-transform duration-200",
                                    isActive && "scale-110",
                                )}
                                aria-hidden="true"
                            />
                            <span
                                className={cn(
                                    "text-xs font-medium transition-all duration-200",
                                    isActive ? "opacity-100" : "opacity-80",
                                    "hidden sm:inline-block",
                                )}
                            >
                                {link.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
