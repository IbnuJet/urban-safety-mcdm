"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface WorkCycle {
  id: string;
  label: string;
  finalizedAt: string;
  weightVersion: string;
  segmentCount: number;
  status: "Ditetapkan" | "Dibatalkan";
}

const MOCK_CYCLES: WorkCycle[] = [
  {
    id: "cyc-nov-2026", label: "November 2026", finalizedAt: "2026-11-13",
    weightVersion: "Versi 1", segmentCount: 3, status: "Ditetapkan",
  },
  {
    id: "cyc-okt-2026", label: "Oktober 2026", finalizedAt: "2026-10-16",
    weightVersion: "Versi 1", segmentCount: 2, status: "Ditetapkan",
  },
];

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const months = [ "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des",];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// async function fetchCycles(): Promise<WorkCycle[]> {
//   const res = await fetch("http://localhost:8000/api/v1/worklists/cycles", {
//     headers: { Authorization: `Bearer ${getToken()}` },
//   });
//   if (!res.ok) return MOCK_CYCLES;
//   return res.json();
// }

export default function RiwayatPage() {
  const router = useRouter();
  const [cycles] = useState<WorkCycle[]>(MOCK_CYCLES);

  return (
    <div className="p-8 bg-[#F7F8F5] min-h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">Riwayat siklus</h1>
        <p className="text-xs text-zinc-500 mt-1">Buka daftar kerja yang sudah ditetapkan dan unduh rekapnya.</p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-[15px] font-bold text-zinc-900">Daftar siklus</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{cycles.length} siklus tersimpan</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-medium">
                <th className="py-3 px-6">Siklus</th>
                <th className="py-3 px-4">Ditetapkan</th>
                <th className="py-3 px-4">Versi bobot</th>
                <th className="py-3 px-4">Segmen ditangani</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {cycles.map((cycle) => (
                <tr key={cycle.id} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="py-4 px-6 font-semibold text-zinc-900 whitespace-nowrap">{cycle.label}</td>
                  <td className="py-4 px-4 text-zinc-500 whitespace-nowrap">{formatDate(cycle.finalizedAt)}</td>
                  <td className="py-4 px-4 text-zinc-600 whitespace-nowrap">{cycle.weightVersion}</td>
                  <td className="py-4 px-4 text-zinc-600 whitespace-nowrap">{cycle.segmentCount} segmen</td>
                  <td className="py-4 px-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${ cycle.status === "Ditetapkan" ? "bg-[#edf4f0] text-[#1a5b3e] border-[#c5dfd3]" : "bg-zinc-100 text-zinc-500 border-zinc-200" }`}>
                      {cycle.status}
                    </span>
                  </td>

                  <td className="py-4 px-4">
                    <button type="button" onClick={() => { router.push(`/riwayat/${cycle.id}`); }} className="text-xs text-zinc-700 hover:text-[#1a5b3e] font-medium transition whitespace-nowrap cursor-pointer">
                      Buka detail →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}