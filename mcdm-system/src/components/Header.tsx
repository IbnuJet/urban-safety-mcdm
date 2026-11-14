"use client";

import { usePathname } from "next/navigation";

// Peta nama rute ke label halaman breadcrumb
const ROUTE_NAMES: Record<string, string> = {
  "/": "Peta prioritas",
  "/segmen": "Data segmen",
  "/pendataan": "Pendataan",
  "/pemeringkatan": "Pemeringkatan",
  "/daftar-kerja": "Daftar kerja",
  "/riwayat": "Riwayat",
  "/login": "Masuk",
};

export default function Header() {
  const pathname = usePathname();

  // Ambil nama halaman dinamis sesuai URL yang sedang dibuka
  let pageName = ROUTE_NAMES[pathname];
  if (!pageName) {
    const matchedKey = Object.keys(ROUTE_NAMES).find(
      (key) => key !== "/" && pathname.startsWith(key)
    );
    pageName = matchedKey ? ROUTE_NAMES[matchedKey] : "Peta prioritas";
  }

  return (
    <header className="w-full h-14 bg-white border-b border-zinc-200/80 px-8 flex items-center justify-between shrink-0 z-10 select-none">
      {/* Breadcrumb Navigasi Kiri */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-400">Ruang kerja PJU</span>
        <span className="text-zinc-300 font-normal">&rsaquo;</span>
        <span className="text-zinc-800 font-medium">{pageName}</span>
      </div>

      {/* Status Badge Kanan */}
      <div>
        <span className="px-2.5 py-1 rounded-full border border-zinc-200 text-zinc-500 bg-white text-[11px] font-normal shadow-2xs">
          Data simulasi
        </span>
      </div>
    </header>
  );
}
