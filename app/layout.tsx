import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CryptoTrendLab",
  description:
    "A clean, modern dashboard UI shell for tracking crypto market trends.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-background text-foreground">
          <div className="flex">
            <Sidebar />
            <div className="flex min-h-screen flex-1 flex-col">
              <Topbar />
              <main className="flex-1 p-6">{children}</main>
              <footer className="border-t border-black/10 dark:border-white/10 p-4 text-sm text-black/60 dark:text-white/60">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                  <span>© {new Date().getFullYear()} CryptoTrendLab</span>
                  <div className="flex items-center gap-4">
                    <Link href="/about" className="hover:underline">
                      About
                    </Link>
                    <a
                      href="https://vercel.com"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      Deploy on Vercel
                    </a>
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
