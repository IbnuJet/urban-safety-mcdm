"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserResponse } from "../lib/auth";
import { logoutAction } from "../app/login/actions";

interface SidebarProps {
  user?: UserResponse;
}

const DEFAULT_USER: UserResponse = {
  id: 2,
  username: "pju_lead",
  email: "pju@jatinangor-dss.id",
  full_name: "Penanggung jawab PJU",
  role: "PENANGGUNG_JAWAB_PJU",
  is_active: true,
  created_at: "2026-11-13T18:30:00Z",
};

export default function Sidebar({ user: propUser }: SidebarProps) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<UserResponse>(
    propUser || DEFAULT_USER
  );

  // Otomatis baca sesi login dari cookies jika Sidebar dipasang langsung di layout.tsx
  useEffect(() => {
    if (propUser) {
      setCurrentUser(propUser);
      return;
    }
    try {
      const match = document.cookie
        .split("; ")
        .find((row) => row.startsWith("auth_session="));
      if (match) {
        const value = decodeURIComponent(match.split("=")[1]);
        const session = JSON.parse(value);
        if (session.user) {
          setCurrentUser(session.user);
        }
      }
    } catch {
      // Gunakan default demo user
    }
  }, [propUser]);

  const navItems = [
    {
      label: "Peta prioritas",
      href: "/",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      ),
    },
    {
      label: "Pemeringkatan",
      href: "/pemeringkatan",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      label: "Daftar kerja",
      href: "/daftar-kerja",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
  ];

  return (
    <aside className="w-[230px] h-screen sticky top-0 bg-white border-r border-zinc-200/80 flex flex-col justify-between shrink-0 p-5 z-20 select-none">
      <div>
        {/* Logo Header */}
        <div className="flex items-center gap-2.5 mb-7">
          <div className="w-8 h-8 rounded-lg bg-[#1a5b3e] flex items-center justify-center text-white shrink-0 shadow-xs">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 21V8a5 5 0 0 1 5-5h2a3 3 0 0 1 3 3v2" />
              <path d="M14 8h6l-1.5 3.5h-3z" />
              <line x1="16" y1="15" x2="15" y2="17" />
              <line x1="18.5" y1="15" x2="18.5" y2="18" />
              <line x1="21" y1="15" x2="22" y2="17" />
            </svg>
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-zinc-900 leading-tight">
              DSS Jatinangor
            </h2>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Penerangan jalan umum
            </p>
          </div>
        </div>

        {/* Nav Menu */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition text-left cursor-pointer ${
                  isActive
                    ? "bg-[#edf4f0] text-[#1a5b3e] font-medium"
                    : "text-zinc-600 hover:bg-zinc-100 font-normal"
                }`}
              >
                <span
                  className={isActive ? "text-[#1a5b3e]" : "text-zinc-400"}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Divider */}
          <div className="pt-3 pb-2">
            <div className="h-px bg-zinc-100" />
          </div>

          {/* Riwayat */}
          <Link
            href="/riwayat"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition text-left cursor-pointer ${
              pathname.startsWith("/riwayat")
                ? "bg-[#edf4f0] text-[#1a5b3e] font-medium"
                : "text-zinc-600 hover:bg-zinc-100 font-normal"
            }`}
          >
            <svg
              className={`w-4 h-4 ${
                pathname.startsWith("/riwayat")
                  ? "text-[#1a5b3e]"
                  : "text-zinc-400"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Riwayat</span>
          </Link>
        </nav>
      </div>

      {/* User Profile Widget di Bawah Sidebar */}
      <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#edf4f0] text-[#1a5b3e] text-xs font-bold flex items-center justify-center shrink-0">
            {currentUser.role === "PENANGGUNG_JAWAB_PJU"
              ? "PJ"
              : (currentUser.username || "OP").substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-zinc-800 leading-tight truncate">
              {currentUser.full_name || "Penanggung jawab PJU"}
            </p>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-[11px] text-zinc-400 hover:text-red-600 transition text-left cursor-pointer block"
              >
                Ganti akun &rsaquo;
              </button>
            </form>
          </div>
        </div>
        <svg
          className="w-4 h-4 text-zinc-300 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </aside>
  );
}
