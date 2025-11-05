import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppSidebar from "@/components/AppSidebar";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Credit Card Tracker",
    description: "Track your credit card spending and installments",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <div className="flex h-screen w-full overflow-hidden">
                    <AppSidebar />
                    <div className="flex-1 overflow-auto relative z-10">
                        <main className="p-6 block">{children}</main>
                    </div>
                </div>
            </body>
        </html>
    );
}
