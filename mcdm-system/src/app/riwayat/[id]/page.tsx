"use client";
import { use } from "react";
import Link from "next/link";

interface CycleSegment {
  rank: number;
  name: string;
  corridor: string;
  score: number;
  brokenLights: string;
  status: string;
}

interface CycleDetail {
  id: string;
  label: string;
  finalizedAt: string;
  weightVersion: string;
  capacity: number;
  segments: CycleSegment[];
}

const MOCK_CYCLE_DETAILS: Record<string, CycleDetail> = {
  "cyc-nov-2026": {
    id: "cyc-nov-2026", label: "November 2026", finalizedAt: "2026-11-13", weightVersion: "Versi 1", capacity: 3,
    segments: [
      { rank: 1, name: "Gang Ciseke 01", corridor: "Ciseke", score: 1.0, brokenLights: "6/8", status: "Ditetapkan", },
      { rank: 2, name: "Gang Caringin 01", corridor: "Caringin", score: 0.782, brokenLights: "4/6", status: "Ditetapkan", },
      { rank: 3, name: "Gang H. Nena 01", corridor: "Gang H Nena", score: 0.716, brokenLights: "5/9", status: "Ditetapkan", },
    ],
  },
  "cyc-okt-2026": {
    id: "cyc-okt-2026", label: "Oktober 2026", finalizedAt: "2026-10-16", weightVersion: "Versi 1", capacity: 2,
    segments: [
      { rank: 1, name: "Gang Saluyu 01", corridor: "Saluyu", score: 0.95, brokenLights: "7/10", status: "Ditetapkan",},
      { rank: 2, name: "Gang Mekar 01", corridor: "Mekar", score: 0.81, brokenLights: "3/5", status: "Ditetapkan", },
    ],
  },
};

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const months = [ "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des", ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// async function fetchCycleDetail(id: string): Promise<CycleDetail | null> {
//   const res = await fetch(`http://localhost:8000/api/v1/worklists/cycles/${id}`, {
//     headers: { Authorization: `Bearer ${getToken()}` },
//   });
//   if (!res.ok) return null;
//   return res.json();
// }

export default function DetailRiwayatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const cycle = MOCK_CYCLE_DETAILS[id];
  if (!cycle) {
    return (
      <div className="p-8 bg-[#F7F8F5] min-h-full">
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-8 shadow-xs max-w-xl">
          <h1 className="text-lg font-bold text-zinc-900 mb-2">Siklus tidak ditemukan</h1>
          <p className="text-xs text-zinc-500 mb-5">Data siklus dengan ID &ldquo;{id}&rdquo; tidak tersedia.</p>
          <Link href="/riwayat" className="px-4 py-2 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition">
            &larr; Kembali ke riwayat
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#F7F8F5] min-h-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">Siklus {cycle.label}</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Daftar kerja ditetapkan {formatDate(cycle.finalizedAt)} &middot;
            Bobot AHP {cycle.weightVersion.toLowerCase()}.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link href="/riwayat" className="px-4 py-2 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition">
            Kembali ke riwayat
          </Link>
          <button type="button" disabled title="Fitur unduh CSV belum tersedia" className="px-4 py-2 rounded-lg bg-[#1a5b3e] text-white text-xs font-medium flex items-center gap-1.5 shadow-xs opacity-80 cursor-not-allowed">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span>Unduh CSV</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-[15px] font-bold text-zinc-900">Daftar kerja ditetapkan</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Kapasitas {cycle.capacity} segmen</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-medium">
                <th className="py-3 px-6 w-20">Peringkat</th>
                <th className="py-3 px-4">Segmen</th>
                <th className="py-3 px-4">Koridor</th>
                <th className="py-3 px-4">Skor TOPSIS</th>
                <th className="py-3 px-4">Lampu mati</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {cycle.segments.map((seg) => (
                <tr key={seg.rank} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="py-4 px-6 font-semibold text-zinc-500">{seg.rank}</td>
                  <td className="py-4 px-4 font-semibold text-zinc-900">{seg.name}</td>
                  <td className="py-4 px-4 text-zinc-600">{seg.corridor}</td>
                  <td className="py-4 px-4 font-medium">
                    {seg.score.toLocaleString("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3, })}
                  </td>
                  <td className="py-4 px-4 text-zinc-600">{seg.brokenLights}</td>
                  <td className="py-4 px-4">
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold border bg-[#edf4f0] text-[#1a5b3e] border-[#c5dfd3]">{seg.status}</span>
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