"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ProposedSegment {
  rank: number;
  name: string;
  score: number;
  brokenLights: string;
  status: string;
}

const DEFAULT_PROPOSED_SEGMENTS: ProposedSegment[] = [
  {
    rank: 1,
    name: "Gang Ciseke 01",
    score: 1.0,
    brokenLights: "6/8",
    status: "Diusulkan",
  },
  {
    rank: 2,
    name: "Gang Caringin 01",
    score: 0.782,
    brokenLights: "4/6",
    status: "Diusulkan",
  },
  {
    rank: 3,
    name: "Gang H. Nena 01",
    score: 0.716,
    brokenLights: "5/9",
    status: "Diusulkan",
  },
];

export default function DaftarKerjaPage() {
  const router = useRouter();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handler saat konfirmasi penetapan daftar kerja
  async function handleConfirmFinalize() {
    setIsSubmitting(true);

    // Simulasi draft request ke backend /api/v1/worklists/cycles/{cycle_id}/finalize
    setTimeout(() => {
      setIsSubmitting(false);
      setShowConfirmModal(false);
      router.push("/riwayat");
    }, 700);
  }

  return (
    <div className="p-8 bg-[#F7F8F5] min-h-full">
      {/* Header Judul Halaman */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">
          Daftar kerja perbaikan
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Siklus November 2026 &middot; Usulan diurutkan berdasarkan hasil TOPSIS.
        </p>
      </div>

      {/* Grid Konten: Tabel Usulan Sistem (Kiri) & Kapasitas Perbaikan (Kanan) */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* 1. KARTU USULAN SISTEM (Kiri ~ col-span-8) */}
        <div className="col-span-8 bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs">
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-zinc-900">Usulan sistem</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              3 dari 6 segmen layak masuk usulan.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-medium">
                  <th className="py-3 px-3 w-20">Peringkat</th>
                  <th className="py-3 px-3">Segmen gang</th>
                  <th className="py-3 px-3">Skor TOPSIS</th>
                  <th className="py-3 px-3">Lampu mati</th>
                  <th className="py-3 px-3 text-right">Pilihan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {DEFAULT_PROPOSED_SEGMENTS.map((seg) => (
                  <tr key={seg.rank} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="py-4 px-3 font-semibold text-zinc-500">
                      {seg.rank}
                    </td>
                    <td className="py-4 px-3 font-semibold text-zinc-900">
                      {seg.name}
                    </td>
                    <td className="py-4 px-3 font-medium">
                      {seg.score.toLocaleString("id-ID", {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </td>
                    <td className="py-4 px-3 text-zinc-600">
                      {seg.brokenLights}
                    </td>
                    <td className="py-4 px-3 text-right">
                      <span className="inline-block px-3 py-1 rounded-full bg-[#edf4f0] text-[#1a5b3e] font-semibold text-[11px]">
                        {seg.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. KARTU KAPASITAS PERBAIKAN (Kanan ~ col-span-4) */}
        <div className="col-span-4 bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-zinc-900">
              Kapasitas perbaikan
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5 mb-5">
              Jumlah gang yang bisa ditangani pada siklus ini.
            </p>

            {/* Input / Display Kapasitas */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Kapasitas
              </label>
              <div className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm text-zinc-800 bg-white font-normal shadow-2xs">
                3 segmen
              </div>
            </div>

            <p className="text-xs text-zinc-400 mb-4">
              Tinjau usulan sebelum menetapkan pekerjaan.
            </p>

            {/* Tombol Ubah Pilihan */}
            <button
              type="button"
              className="w-full py-2.5 px-4 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition cursor-pointer flex items-center justify-center gap-2 mb-3"
            >
              <svg
                className="w-4 h-4 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              <span>Ubah pilihan</span>
            </button>

            {/* Tombol Tetapkan Daftar Kerja */}
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="w-full py-2.5 px-4 bg-[#1a5b3e] hover:bg-[#164d34] active:bg-[#123e2a] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Tetapkan daftar kerja</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL POP-UP KONFIRMASI PENETAPAN DAFTAR KERJA */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-zinc-200/80 animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#edf4f0] text-[#1a5b3e] flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Tetapkan Daftar Kerja?
                </h3>
                <p className="text-xs text-zinc-500">
                  Siklus Pekerjaan November 2026
                </p>
              </div>
            </div>

            {/* Isi Ringkasan Modal */}
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 text-xs text-zinc-600 mb-5 space-y-1.5">
              <p className="font-semibold text-zinc-800">
                3 Segmen Prioritas akan dikunci:
              </p>
              <ul className="list-disc list-inside space-y-1 text-zinc-600 pl-1">
                <li>Gang Ciseke 01 (Skor: 1,000)</li>
                <li>Gang Caringin 01 (Skor: 0,782)</li>
                <li>Gang H. Nena 01 (Skor: 0,716)</li>
              </ul>
              <p className="text-zinc-400 text-[11px] pt-1.5">
                Setelah ditetapkan, daftar kerja ini akan tercatat resmi ke dalam riwayat evaluasi sistem.
              </p>
            </div>

            {/* Tombol Aksi Modal */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmFinalize}
                className="px-4 py-2 rounded-lg bg-[#1a5b3e] hover:bg-[#164d34] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-70"
              >
                {isSubmitting ? (
                  <span>Memproses...</span>
                ) : (
                  <>
                    <span>Ya, Tetapkan & Lihat Riwayat</span>
                    <span>&rarr;</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
