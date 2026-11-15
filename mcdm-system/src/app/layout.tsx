import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import LayoutPage from "@/src/components/LayoutPage";

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
    <html lang="id" className="h-full antialiased">
      <body className="h-full flex overflow-hidden bg-[#F7F8F5] text-zinc-900 font-sans">
        <Suspense fallback={<div className="w-full h-full bg-[#F7F8F5]" />}>
          <LayoutPage>{children}</LayoutPage>
        </Suspense>
      </body>
    </html>
  );
}


