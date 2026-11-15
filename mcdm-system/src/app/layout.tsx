import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LayoutPage from "@/src/components/LayoutPage"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DSS Jatinangor - Penerangan Jalan Umum",
  description:
    "Sistem Pendukung Keputusan Prioritas PJU & Keselamatan Jatinangor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full flex overflow-hidden bg-[#F7F8F5] text-zinc-900 font-sans">
        <LayoutPage>{children}</LayoutPage>
      </body>
    </html>
  );
}
