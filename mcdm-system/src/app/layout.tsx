import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

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
        <Sidebar />
        <div className="flex-1 h-screen flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-[#F7F8F5]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
