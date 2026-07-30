import AppSidebar from "@/components/AppSidebar";
import BottomNavigation from "@/components/BottomNavigation";

export default function ReceiverLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#090b0d] text-base-content">
            <AppSidebar className="hidden md:block" />
            <div className="relative z-10 flex-1 overflow-auto">
                <main
                    className="min-h-full p-4 pb-24 md:p-6 md:pb-8"
                    role="main"
                >
                    {children}
                </main>
            </div>
            <BottomNavigation className="md:hidden" />
        </div>
    );
}
