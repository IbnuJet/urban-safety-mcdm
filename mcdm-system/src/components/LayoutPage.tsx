"use client";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  if (isLoginPage) {
    return <main className="w-full min-h-screen bg-[#F7F8F5]">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <div className="flex-1 h-screen flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-[#F7F8F5]">{children}</main>
      </div>
    </>
  );
}