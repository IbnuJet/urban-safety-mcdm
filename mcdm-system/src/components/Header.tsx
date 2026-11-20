"use client";

import { usePathname } from "next/navigation";

const ROUTE_NAMES: Record<string, string> = {
  "/": "Peta prioritas",
  "/segmen": "Data segmen",
  "/pendataan": "Pendataan",
  "/ahp": "Pembobotan AHP",
  "/pemeringkatan": "Pemeringkatan",
  "/daftar-kerja": "Daftar kerja",
  "/riwayat": "Riwayat",
  "/login": "Masuk",
};

export default function Header() {
  const pathname = usePathname();
  let pageName = ROUTE_NAMES[pathname];
  if (!pageName) {
    const matchedKey = Object.keys(ROUTE_NAMES).find(
      (key) => key !== "/" && pathname.startsWith(key)
    );
    pageName = matchedKey ? ROUTE_NAMES[matchedKey] : "Peta prioritas";
  }

  return (
    <header className="w-full h-14 bg-white border-b border-zinc-200/80 px-8 flex items-center shrink-0 z-10 select-none gap-2 text-xs">
      <span className="text-zinc-400">Ruang kerja PJU</span>
      <span className="text-zinc-300 font-normal">&rsaquo;</span>
      <span className="text-zinc-800 font-medium">{pageName}</span>
    </header>
  );
}