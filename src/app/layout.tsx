import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from 'next/link';
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-100`}
      >
        <div className="p-4">
          <nav className="mb-4">
            <ul className="flex space-x-4">
              <li><Link href="/" className="text-blue-600 hover:underline">Home</Link></li>
              <li><Link href="/credit-cards" className="text-blue-600 hover:underline">Credit Cards</Link></li>
              <li><Link href="/persons" className="text-blue-600 hover:underline">Persons</Link></li>
              <li><Link href="/purchases" className="text-blue-600 hover:underline">Purchases</Link></li>
              <li><Link href="/transactions" className="text-blue-600 hover:underline">Transactions</Link></li>
            </ul>
          </nav>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
