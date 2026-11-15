"use client";

import { useState, useEffect } from "react";
import {
  calculateAHPPreview,
  fetchAHPVersions,
  createAHPVersion,
  activateAHPVersion,
  AHPCalculateResponse,
  AHPVersionResponse,
} from "../../lib/api";

export default function AHPPage() {
  // State 3 Perbandingan Berpasangan:
  // Row 1: C1 (Lampu) vs C2 (Curanmor)
  const [pref1, setPref1] = useState<"c1" | "c2" | "equal">("c1");
  const [int1, setInt1] = useState<number>(3);

  // Row 2: C1 (Lampu) vs C3 (Indekos)
  const [pref2, setPref2] = useState<"c1" | "c3" | "equal">("c1");
  const [int2, setInt2] = useState<number>(5);

  // Row 3: C2 (Curanmor) vs C3 (Indekos)
  const [pref3, setPref3] = useState<"c2" | "c3" | "equal">("c2");
  const [int3, setInt3] = useState<number>(2);

  // Hasil Perhitungan
  const [calcResult, setCalcResult] = useState<AHPCalculateResponse | null>({
    pairwise_matrix: [
      [1.0, 3.0, 5.0],
      [1.0 / 3.0, 1.0, 2.0],
      [1.0 / 5.0, 0.5, 1.0],
    ],
    w_light_damage: 0.648,
    w_dawn_crime: 0.23,
    w_boarding_density: 0.122,
    lambda_max: 3.003,
    ci: 0.0017,
    ri: 0.58,
    cr: 0.003,
    is_consistent: true,
  });

  const [isCalculating, setIsCalculating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Active Version & History
  const [versions, setVersions] = useState<AHPVersionResponse[]>([]);
  const [activeVersionName, setActiveVersionName] = useState<string>("Versi 1");

  // Load versions
  async function loadVersions() {
    try {
      const data = await fetchAHPVersions();
      setVersions(data);
      const active = data.find((v) => v.is_active);
      if (active) {
        setActiveVersionName(active.version_name);
      }
    } catch {}
  }

  useEffect(() => {
    loadVersions();
  }, []);

  // Konversi pilihan UI ke nilai rasio Saaty
  function getRatio(pref: string, intensity: number, item1Key: string): number {
    if (pref === "equal") return 1.0;
    if (pref === item1Key) return intensity;
    return 1.0 / intensity;
  }

  // Hitung Bobot Realtime
  async function runCalculation(
    p1 = pref1,
    i1 = int1,
    p2 = pref2,
    i2 = int2,
    p3 = pref3,
    i3 = int3
  ) {
    setIsCalculating(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    const a12 = getRatio(p1, i1, "c1");
    const a13 = getRatio(p2, i2, "c1");
    const a23 = getRatio(p3, i3, "c2");

    const matrix = [
      [1.0, a12, a13],
      [1.0 / a12, 1.0, a23],
      [1.0 / a13, 1.0 / a23, 1.0],
    ];

    try {
      const res = await calculateAHPPreview(matrix);
      setCalcResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsCalculating(false);
    }
  }

  // Toggle Contoh Inkonsisten (AHP Perlu Direvisi)
  function handleToggleInconsistent() {
    // Buat penilaian yang tidak transitif:
    // C1 > C2 (5x), C2 > C3 (4x), tapi C3 > C1 (5x) -> CR tinggi (~0.6+)
    setPref1("c1");
    setInt1(5);
    setPref2("c3");
    setInt2(5);
    setPref3("c2");
    setInt3(4);
    runCalculation("c1", 5, "c3", 5, "c2", 4);
  }

  // Reset ke Rekomendasi Konsisten (Sesuai Figma)
  function handleResetConsistent() {
    setPref1("c1");
    setInt1(3);
    setPref2("c1");
    setInt2(5);
    setPref3("c2");
    setInt3(2);
    runCalculation("c1", 3, "c1", 5, "c2", 2);
  }

  // Handler Tombol "Aktifkan bobot"
  async function handleActivateWeight() {
    if (!calcResult) return;
    if (!calcResult.is_consistent) {
      setActionErrorMsg(
        "Bobot tidak konsisten (CR > 0,10) tidak dapat diaktifkan. Harap sesuaikan perbandingan terlebih dahulu."
      );
      return;
    }

    setIsActivating(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    const newVersionName = `Versi ${versions.length + 1}`;
    try {
      const created = await createAHPVersion({
        pairwise_matrix: calcResult.pairwise_matrix,
        version_name: newVersionName,
        activate_immediately: true,
      });
      setActiveVersionName(created.version_name);
      setActionSuccessMsg(`Bobot "${created.version_name}" berhasil diaktifkan!`);
      await loadVersions();
    } catch {
      // Local simulation
      setActiveVersionName(newVersionName);
      setActionSuccessMsg(`Bobot "${newVersionName}" berhasil diaktifkan (simulasi lokal)!`);
    } finally {
      setIsActivating(false);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  }

  // Format angka desimal dengan koma sesuai format Indonesia di Figma (contoh: 64,8% dan 0,003)
  function formatPercent(val: number): string {
    return (val * 100).toFixed(1).replace(".", ",") + "%";
  }

  function formatCR(val: number): string {
    return val.toFixed(3).replace(".", ",");
  }

  return (
    <div className="p-8 bg-[#F7F8F5] min-h-full">
      {/* Header Halaman Sesuai Desain Figma */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 leading-tight">
            Pembobotan AHP
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Bandingkan tiga kriteria untuk menentukan bobot prioritas perbaikan.
          </p>
        </div>
        <div>
          <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#edf4f0] text-[#1a5b3e] border border-[#d2e4d9] shadow-2xs">
            Bobot aktif - {activeVersionName}
          </span>
        </div>
      </div>

      {/* Alert Notifikasi Sukses / Error */}
      {actionSuccessMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">{actionSuccessMsg}</span>
        </div>
      )}

      {actionErrorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
          <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{actionErrorMsg}</span>
        </div>
      )}

      {/* Grid Utama 2 Kolom Sesuai Figma */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KARTU KIRI: FORM PERBANDINGAN BERPASANGAN */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              Perbandingan berpasangan
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Skala Saaty 1–9 · 1 sama penting, 9 mutlak lebih penting.
            </p>
          </div>

          <div className="space-y-6 pt-2">
            {/* BARIS 1: Proporsi lampu mati vs Curanmor dini hari */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pb-5 border-b border-zinc-100">
              <div className="sm:col-span-5">
                <p className="text-sm font-bold text-zinc-900">
                  Proporsi lampu mati
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  dibanding Curanmor dini hari
                </p>
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Lebih penting
                </label>
                <select
                  value={pref1}
                  onChange={(e) => {
                    const val = e.target.value as "c1" | "c2" | "equal";
                    setPref1(val);
                    runCalculation(val, int1, pref2, int2, pref3, int3);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] cursor-pointer"
                >
                  <option value="c1">Proporsi lampu mati</option>
                  <option value="c2">Curanmor dini hari</option>
                  <option value="equal">Sama penting</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Intensitas
                </label>
                <select
                  disabled={pref1 === "equal"}
                  value={int1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setInt1(val);
                    runCalculation(pref1, val, pref2, int2, pref3, int3);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] disabled:bg-zinc-100 disabled:text-zinc-400 cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* BARIS 2: Proporsi lampu mati vs Indekos dilayani */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pb-5 border-b border-zinc-100">
              <div className="sm:col-span-5">
                <p className="text-sm font-bold text-zinc-900">
                  Proporsi lampu mati
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  dibanding Indekos dilayani
                </p>
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Lebih penting
                </label>
                <select
                  value={pref2}
                  onChange={(e) => {
                    const val = e.target.value as "c1" | "c3" | "equal";
                    setPref2(val);
                    runCalculation(pref1, int1, val, int2, pref3, int3);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] cursor-pointer"
                >
                  <option value="c1">Proporsi lampu mati</option>
                  <option value="c3">Indekos dilayani</option>
                  <option value="equal">Sama penting</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Intensitas
                </label>
                <select
                  disabled={pref2 === "equal"}
                  value={int2}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setInt2(val);
                    runCalculation(pref1, int1, pref2, val, pref3, int3);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] disabled:bg-zinc-100 disabled:text-zinc-400 cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* BARIS 3: Curanmor dini hari vs Indekos dilayani */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pb-2">
              <div className="sm:col-span-5">
                <p className="text-sm font-bold text-zinc-900">
                  Curanmor dini hari
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  dibanding Indekos dilayani
                </p>
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Lebih penting
                </label>
                <select
                  value={pref3}
                  onChange={(e) => {
                    const val = e.target.value as "c2" | "c3" | "equal";
                    setPref3(val);
                    runCalculation(pref1, int1, pref2, int2, val, int3);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] cursor-pointer"
                >
                  <option value="c2">Curanmor dini hari</option>
                  <option value="c3">Indekos dilayani</option>
                  <option value="equal">Sama penting</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Intensitas
                </label>
                <select
                  disabled={pref3 === "equal"}
                  value={int3}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setInt3(val);
                    runCalculation(pref1, int1, pref2, int2, pref3, val);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] disabled:bg-zinc-100 disabled:text-zinc-400 cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tombol Aksi Bawah Kartu Kiri */}
          <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
            {calcResult?.is_consistent ? (
              <button
                type="button"
                onClick={handleToggleInconsistent}
                className="px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-medium text-zinc-700 transition cursor-pointer shadow-2xs"
              >
                Lihat contoh tidak konsisten
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetConsistent}
                className="px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-[#1a5b3e] transition cursor-pointer"
              >
                Kembalikan ke konsisten
              </button>
            )}

            <button
              type="button"
              onClick={() => runCalculation()}
              disabled={isCalculating}
              className="px-5 py-2 rounded-xl bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium transition shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              {isCalculating ? "Menghitung..." : "Hitung bobot"}
            </button>
          </div>
        </div>

        {/* KARTU KANAN: BOBOT KRITERIA & KONSISTENSI */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              Bobot kriteria
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Bobot digunakan oleh pemeringkatan TOPSIS.
            </p>
          </div>

          {calcResult && (
            <div className="space-y-6">
              {/* Progress Bars Bobot 3 Kriteria */}
              <div className="space-y-4">
                {/* Kriteria 1 */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-medium text-zinc-800">
                    <span>Proporsi lampu mati</span>
                    <span className="font-bold text-zinc-900">
                      {formatPercent(calcResult.w_light_damage)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full bg-[#1a5b3e] transition-all duration-300 rounded-full"
                      style={{ width: `${calcResult.w_light_damage * 100}%` }}
                    />
                  </div>
                </div>

                {/* Kriteria 2 */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-medium text-zinc-800">
                    <span>Curanmor dini hari</span>
                    <span className="font-bold text-zinc-900">
                      {formatPercent(calcResult.w_dawn_crime)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full bg-[#1a5b3e] transition-all duration-300 rounded-full"
                      style={{ width: `${calcResult.w_dawn_crime * 100}%` }}
                    />
                  </div>
                </div>

                {/* Kriteria 3 */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-medium text-zinc-800">
                    <span>Indekos dilayani</span>
                    <span className="font-bold text-zinc-900">
                      {formatPercent(calcResult.w_boarding_density)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full bg-[#1a5b3e] transition-all duration-300 rounded-full"
                      style={{ width: `${calcResult.w_boarding_density * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Status Konsistensi (Konsisten vs AHP Perlu Direvisi) */}
              {calcResult.is_consistent ? (
                <div className="p-4 rounded-xl bg-[#edf4f0] border border-[#d2e4d9] text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#1a5b3e]">
                    <svg className="w-4 h-4 text-[#1a5b3e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Konsisten · CR {formatCR(calcResult.cr)}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pl-5.5">
                    Batas rasio konsistensi 0,10.
                  </p>
                </div>
              ) : (
                /* STATE AHP PERLU DIREVISI */
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Tidak konsisten · CR {formatCR(calcResult.cr)}</span>
                  </div>
                  <p className="text-[11px] text-amber-700 pl-5.5">
                    Perlu direvisi. Batas rasio konsistensi 0,10.
                  </p>
                  <p className="text-[11px] text-amber-900 bg-amber-100/60 p-2 rounded-lg mt-1">
                    <strong>Rekomendasi revisi:</strong> Terdapat inkonsistensi transitif antar kriteria. Sesuaikan perbandingan agar kepentingan kriteria berurutan secara logis.
                  </p>
                </div>
              )}

              {/* Tombol Utama: Aktifkan bobot */}
              <div>
                <button
                  type="button"
                  onClick={handleActivateWeight}
                  disabled={!calcResult.is_consistent || isActivating}
                  className="w-full py-2.5 rounded-xl bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isActivating ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Mengaktifkan...</span>
                    </>
                  ) : (
                    <span>Aktifkan bobot</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
