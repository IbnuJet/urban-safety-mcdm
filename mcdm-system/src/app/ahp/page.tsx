"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  calculateAHPPreview,
  fetchAHPVersions,
  createAHPVersion,
  activateAHPVersion,
  AHPCalculateResponse,
  AHPVersionResponse,
} from "../../lib/api";

const SAATY_SCALES = [
  { value: 1, label: "1 - Sama penting" },
  { value: 2, label: "2 - Mendekati sedikit lebih penting" },
  { value: 3, label: "3 - Sedikit lebih penting" },
  { value: 4, label: "4 - Mendekati lebih penting" },
  { value: 5, label: "5 - Jelas lebih penting" },
  { value: 6, label: "6 - Mendekati sangat penting" },
  { value: 7, label: "7 - Sangat penting" },
  { value: 8, label: "8 - Mendekati mutlak lebih penting" },
  { value: 9, label: "9 - Mutlak lebih penting" },
];

export default function AHPPage() {
  // Pairwise Inputs:
  // a12: C1 vs C2 (ratio C1 / C2)
  // a13: C1 vs C3 (ratio C1 / C3)
  // a23: C2 vs C3 (ratio C2 / C3)
  const [a12, setA12] = useState<number>(2.0);
  const [a13, setA13] = useState<number>(4.0);
  const [a23, setA23] = useState<number>(3.0);

  // Calculation Result
  const [calcResult, setCalcResult] = useState<AHPCalculateResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Version Saving State
  const [versionName, setVersionName] = useState("Bobot Pakar Q4 2026");
  const [activateImmediately, setActivateImmediately] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Saved Versions List
  const [versions, setVersions] = useState<AHPVersionResponse[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);
  const [activatingId, setActivatingId] = useState<number | null>(null);

  // Load Saved Versions
  async function loadVersions() {
    setIsLoadingVersions(true);
    try {
      const data = await fetchAHPVersions();
      setVersions(data);
    } catch {
    } finally {
      setIsLoadingVersions(false);
    }
  }

  // Calculate Initial Preview
  async function runPreview(val12 = a12, val13 = a13, val23 = a23) {
    setIsCalculating(true);
    try {
      const matrix = [
        [1.0, val12, val13],
        [1.0 / val12, 1.0, val23],
        [1.0 / val13, 1.0 / val23, 1.0],
      ];
      const res = await calculateAHPPreview(matrix);
      setCalcResult(res);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsCalculating(false);
    }
  }

  useEffect(() => {
    loadVersions();
    runPreview();
  }, []);

  // Set preset for Inconsistent Matrix (Demo AHP Perlu Direvisi)
  function setInconsistentPreset() {
    // Intransitive logic: C1 > C2, C2 > C3, but C3 > C1 -> Severe Inconsistency
    setA12(5.0);
    setA13(0.2); // C1 much less important than C3 while C1 > C2 and C2 > C3!
    setA23(4.0);
    runPreview(5.0, 0.2, 4.0);
  }

  // Set preset for Recommended Consistent Matrix
  function setConsistentPreset() {
    setA12(2.0);
    setA13(4.0);
    setA23(3.0);
    runPreview(2.0, 4.0, 3.0);
  }

  // Save Version
  async function handleSaveVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!calcResult) return;
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    if (!calcResult.is_consistent && activateImmediately) {
      setSaveErrorMsg(
        "Aturan DSS: Versi bobot dengan Rasio Konsistensi CR > 0.10 tidak dapat diaktifkan."
      );
      return;
    }

    setIsSaving(true);
    try {
      await createAHPVersion({
        pairwise_matrix: calcResult.pairwise_matrix,
        version_name: versionName,
        activate_immediately: activateImmediately,
      });
      setSaveSuccessMsg(`Versi "${versionName}" berhasil disimpan!`);
      await loadVersions();
    } catch {
      // Local fallback simulation
      const newVer: AHPVersionResponse = {
        id: Date.now(),
        version_name: versionName,
        created_by: 3,
        pairwise_matrix: calcResult.pairwise_matrix,
        w_light_damage: calcResult.w_light_damage,
        w_dawn_crime: calcResult.w_dawn_crime,
        w_boarding_density: calcResult.w_boarding_density,
        lambda_max: calcResult.lambda_max,
        ci: calcResult.ci,
        ri: calcResult.ri,
        cr: calcResult.cr,
        is_consistent: calcResult.is_consistent,
        is_active: activateImmediately && calcResult.is_consistent,
        created_at: new Date().toISOString(),
      };
      setVersions((prev) => [
        newVer,
        ...prev.map((v) =>
          activateImmediately && calcResult.is_consistent
            ? { ...v, is_active: false }
            : v
        ),
      ]);
      setSaveSuccessMsg(
        `Versi "${versionName}" berhasil disimpan (simulasi lokal)!`
      );
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }
  }

  // Activate Version
  async function handleActivate(versionId: number) {
    setActivatingId(versionId);
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);
    try {
      await activateAHPVersion(versionId);
      setSaveSuccessMsg("Versi bobot AHP aktif berhasil diperbarui!");
      await loadVersions();
    } catch (err: any) {
      // Local fallback simulation
      setVersions((prev) =>
        prev.map((v) => ({ ...v, is_active: v.id === versionId }))
      );
      setSaveSuccessMsg(
        "Versi bobot AHP aktif berhasil diperbarui (simulasi lokal)!"
      );
    } finally {
      setActivatingId(null);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }
  }

  return (
    <div className="p-8 bg-[#F7F8F5] min-h-full">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">
            Pembobotan kriteria AHP
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Penetapan bobot prioritas 3 kriteria intervensi melalui matriks perbandingan berpasangan (Analytical Hierarchy Process).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pemeringkatan"
            className="px-3.5 py-2 rounded-lg bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium transition shadow-xs flex items-center gap-1.5"
          >
            <span>Buka Pemeringkatan TOPSIS</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {saveSuccessMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {saveErrorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{saveErrorMsg}</span>
        </div>
      )}

      {/* Grid: Form Perbandingan & Hasil Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Kolom Kiri: Formulir Perbandingan Berpasangan */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Matriks Perbandingan Berpasangan
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Bandingkan tingkat kepentingan relatif antar 3 kriteria Saaty (1 sampai 9).
              </p>
            </div>
            {/* Tombol Preset Demo */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={setConsistentPreset}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                title="Muat nilai konsisten (CR <= 0.10)"
              >
                Preset Konsisten
              </button>
              <button
                type="button"
                onClick={setInconsistentPreset}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition cursor-pointer"
                title="Simulasi kasus AHP inkonsisten (CR > 0.10)"
              >
                Simulasi Revisi
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {/* Perbandingan 1: C1 vs C2 */}
            <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-800">
                <span>[C1] Kerusakan Lampu vs [C2] Curanmor Dini Hari</span>
                <span className="font-mono text-[#1a5b3e] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  {a12 >= 1 ? `${a12.toFixed(1)} : 1` : `1 : ${(1 / a12).toFixed(1)}`}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Seberapa lebih penting perbaikan lampu rusak dibanding rekap kerawanan curanmor?
              </p>
              <select
                value={a12}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setA12(val);
                  runPreview(val, a13, a23);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
              >
                {SAATY_SCALES.map((sc) => (
                  <option key={sc.value} value={sc.value}>
                    [C1 Lebih Utama] {sc.label}
                  </option>
                ))}
                <option value={0.5}>[C2 Lebih Utama] 2 - Mendekati sedikit lebih penting</option>
                <option value={0.3333}>[C2 Lebih Utama] 3 - Sedikit lebih penting</option>
                <option value={0.2}>[C2 Lebih Utama] 5 - Jelas lebih penting</option>
              </select>
            </div>

            {/* Perbandingan 2: C1 vs C3 */}
            <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-800">
                <span>[C1] Kerusakan Lampu vs [C3] Kepadatan Indekos</span>
                <span className="font-mono text-[#1a5b3e] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  {a13 >= 1 ? `${a13.toFixed(1)} : 1` : `1 : ${(1 / a13).toFixed(1)}`}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Seberapa lebih penting perbaikan lampu rusak dibanding kepadatan indekos mahasiswa?
              </p>
              <select
                value={a13}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setA13(val);
                  runPreview(a12, val, a23);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
              >
                {SAATY_SCALES.map((sc) => (
                  <option key={sc.value} value={sc.value}>
                    [C1 Lebih Utama] {sc.label}
                  </option>
                ))}
                <option value={0.5}>[C3 Lebih Utama] 2 - Mendekati sedikit lebih penting</option>
                <option value={0.3333}>[C3 Lebih Utama] 3 - Sedikit lebih penting</option>
                <option value={0.25}>[C3 Lebih Utama] 4 - Mendekati lebih penting</option>
                <option value={0.2}>[C3 Lebih Utama] 5 - Jelas lebih penting</option>
              </select>
            </div>

            {/* Perbandingan 3: C2 vs C3 */}
            <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-800">
                <span>[C2] Curanmor Dini Hari vs [C3] Kepadatan Indekos</span>
                <span className="font-mono text-[#1a5b3e] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  {a23 >= 1 ? `${a23.toFixed(1)} : 1` : `1 : ${(1 / a23).toFixed(1)}`}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Seberapa lebih penting kerawanan curanmor dibanding kepadatan indekos?
              </p>
              <select
                value={a23}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setA23(val);
                  runPreview(a12, a13, val);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
              >
                {SAATY_SCALES.map((sc) => (
                  <option key={sc.value} value={sc.value}>
                    [C2 Lebih Utama] {sc.label}
                  </option>
                ))}
                <option value={0.5}>[C3 Lebih Utama] 2 - Mendekati sedikit lebih penting</option>
                <option value={0.3333}>[C3 Lebih Utama] 3 - Sedikit lebih penting</option>
                <option value={0.2}>[C3 Lebih Utama] 5 - Jelas lebih penting</option>
              </select>
            </div>
          </div>

          {/* Tabel Matriks 3x3 Preview */}
          {calcResult && (
            <div className="pt-2">
              <h3 className="text-xs font-bold text-zinc-800 mb-2">Matriks Reciprocal 3×3</h3>
              <div className="border border-zinc-200 rounded-xl overflow-hidden font-mono text-[11px]">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-zinc-100/70 border-b border-zinc-200 text-zinc-600">
                      <th className="py-2 px-3 text-left">Kriteria</th>
                      <th className="py-2 px-3">C1 (Lampu)</th>
                      <th className="py-2 px-3">C2 (Curanmor)</th>
                      <th className="py-2 px-3">C3 (Kos)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700 bg-white">
                    <tr>
                      <td className="py-2 px-3 text-left font-sans font-medium text-zinc-900 bg-zinc-50">
                        C1: Kerusakan Lampu
                      </td>
                      <td className="py-2 px-3">1.000</td>
                      <td className="py-2 px-3">{a12.toFixed(3)}</td>
                      <td className="py-2 px-3">{a13.toFixed(3)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-left font-sans font-medium text-zinc-900 bg-zinc-50">
                        C2: Curanmor Dini Hari
                      </td>
                      <td className="py-2 px-3">{(1 / a12).toFixed(3)}</td>
                      <td className="py-2 px-3">1.000</td>
                      <td className="py-2 px-3">{a23.toFixed(3)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-left font-sans font-medium text-zinc-900 bg-zinc-50">
                        C3: Kepadatan Indekos
                      </td>
                      <td className="py-2 px-3">{(1 / a13).toFixed(3)}</td>
                      <td className="py-2 px-3">{(1 / a23).toFixed(3)}</td>
                      <td className="py-2 px-3">1.000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Hasil Perhitungan & Status Revisi */}
        <div className="lg:col-span-5 space-y-6">
          {calcResult && (
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <h3 className="text-base font-bold text-zinc-900">
                  Hasil Bobot Prioritas & CR
                </h3>
                {isCalculating && (
                  <span className="text-xs text-zinc-400 animate-pulse">Menghitung...</span>
                )}
              </div>

              {/* Status Konsistensi Banner */}
              {calcResult.is_consistent ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Konsistensi Terpenuhi (CR ≤ 0.10)</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Nilai CR = <strong>{calcResult.cr.toFixed(4)}</strong> (≤ 0.10). Penilaian perbandingan berpasangan konsisten secara logika dan siap diaktifkan untuk TOPSIS.
                  </p>
                </div>
              ) : (
                /* STATE KHUSUS: AHP PERLU DIREVISI */
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>AHP Perlu Direvisi (CR &gt; 0.10)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Nilai Rasio Konsistensi <strong>CR = {calcResult.cr.toFixed(4)}</strong> melebihi ambang batas maksimal <strong>0.10</strong>.
                  </p>
                  <div className="p-2.5 rounded-lg bg-amber-100/70 text-[11px] space-y-1">
                    <p className="font-semibold text-amber-900">Rekomendasi Revisi:</p>
                    <p className="text-amber-800">
                      • Terdapat kontradiksi transitif pada penilaian Anda. Jika C1 &gt; C2 dan C2 &gt; C3, maka kepentingan C1 terhadap C3 harus lebih tinggi.
                    </p>
                    <p className="text-amber-800">
                      • Tombol aktivasi bobot dinonaktifkan sampai matriks diperbaiki ke CR ≤ 0.10.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={setConsistentPreset}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition cursor-pointer"
                  >
                    Sesuaikan Nilai ke Rekomendasi Konsisten
                  </button>
                </div>
              )}

              {/* Progress Bar Bobot Tiap Kriteria */}
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-zinc-700 mb-1">
                    <span>C1: Kerusakan Lampu PJU</span>
                    <span className="font-mono text-[#1a5b3e]">
                      {(calcResult.w_light_damage * 100).toFixed(1)}% ({calcResult.w_light_damage})
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full bg-[#1a5b3e] transition-all duration-300"
                      style={{ width: `${calcResult.w_light_damage * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-zinc-700 mb-1">
                    <span>C2: Rekap Curanmor Dini Hari</span>
                    <span className="font-mono text-[#c97a26]">
                      {(calcResult.w_dawn_crime * 100).toFixed(1)}% ({calcResult.w_dawn_crime})
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full bg-[#c97a26] transition-all duration-300"
                      style={{ width: `${calcResult.w_dawn_crime * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-zinc-700 mb-1">
                    <span>C3: Kepadatan Indekos</span>
                    <span className="font-mono text-zinc-600">
                      {(calcResult.w_boarding_density * 100).toFixed(1)}% ({calcResult.w_boarding_density})
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full bg-zinc-500 transition-all duration-300"
                      style={{ width: `${calcResult.w_boarding_density * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Rincian Parameter Matematis */}
              <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs border-t border-zinc-100">
                <div className="p-2 rounded-lg bg-zinc-50">
                  <span className="text-[10px] text-zinc-400 block font-mono">λ max</span>
                  <span className="font-semibold text-zinc-800 font-mono">{calcResult.lambda_max.toFixed(3)}</span>
                </div>
                <div className="p-2 rounded-lg bg-zinc-50">
                  <span className="text-[10px] text-zinc-400 block font-mono">CI</span>
                  <span className="font-semibold text-zinc-800 font-mono">{calcResult.ci.toFixed(3)}</span>
                </div>
                <div className="p-2 rounded-lg bg-zinc-50">
                  <span className="text-[10px] text-zinc-400 block font-mono">RI (n=3)</span>
                  <span className="font-semibold text-zinc-800 font-mono">0.58</span>
                </div>
                <div
                  className={`p-2 rounded-lg font-mono font-bold ${
                    calcResult.is_consistent ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                  }`}
                >
                  <span className="text-[10px] block opacity-70">CR</span>
                  <span>{calcResult.cr.toFixed(3)}</span>
                </div>
              </div>

              {/* Form Simpan Versi Bobot */}
              <form onSubmit={handleSaveVersion} className="pt-3 border-t border-zinc-100 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Nama Versi Bobot
                  </label>
                  <input
                    type="text"
                    required
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    placeholder="contoh: Bobot Standar Pakar 2026"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activateImmediateCheck"
                    disabled={!calcResult.is_consistent}
                    checked={activateImmediately && calcResult.is_consistent}
                    onChange={(e) => setActivateImmediately(e.target.checked)}
                    className="w-4 h-4 text-[#1a5b3e] rounded border-zinc-300 disabled:opacity-50"
                  />
                  <label
                    htmlFor="activateImmediateCheck"
                    className={`text-xs ${
                      calcResult.is_consistent ? "text-zinc-700 cursor-pointer" : "text-zinc-400 italic"
                    }`}
                  >
                    Langsung jadikan bobot aktif untuk perhitungan TOPSIS
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-2.5 rounded-xl bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Menyimpan Versi...</span>
                    </>
                  ) : (
                    <span>Simpan Versi Bobot AHP</span>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Tabel Riwayat Versi Bobot Tersimpan */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              Daftar Versi Bobot AHP
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Hanya satu versi konsisten yang dapat diaktifkan sebagai dasar perhitungan pemeringkatan TOPSIS.
            </p>
          </div>
          <span className="text-xs text-zinc-500 font-medium">
            Total: {versions.length} versi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                <th className="py-2.5 px-3">Nama Versi</th>
                <th className="py-2.5 px-3 text-center">Bobot C1 (Lampu)</th>
                <th className="py-2.5 px-3 text-center">Bobot C2 (Curanmor)</th>
                <th className="py-2.5 px-3 text-center">Bobot C3 (Kos)</th>
                <th className="py-2.5 px-3 text-center">Nilai CR</th>
                <th className="py-2.5 px-3 text-center">Konsistensi</th>
                <th className="py-2.5 px-3 text-center">Status Aktif</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {isLoadingVersions ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    Memuat riwayat versi bobot AHP...
                  </td>
                </tr>
              ) : versions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    Belum ada versi bobot AHP yang tersimpan.
                  </td>
                </tr>
              ) : (
                versions.map((ver) => (
                  <tr key={ver.id} className="hover:bg-zinc-50/50">
                    <td className="py-3 px-3 font-semibold text-zinc-900">
                      {ver.version_name}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {(ver.w_light_damage * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {(ver.w_dawn_crime * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {(ver.w_boarding_density * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-medium">
                      {ver.cr.toFixed(4)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          ver.is_consistent
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {ver.is_consistent ? "Konsisten" : "Inkonsisten"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {ver.is_active ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1a5b3e] font-bold text-[11px] border border-emerald-300">
                          Aktif Digunakan
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">Tidak aktif</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {!ver.is_active && (
                        <button
                          onClick={() => handleActivate(ver.id)}
                          disabled={!ver.is_consistent || activatingId === ver.id}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-zinc-100 hover:bg-emerald-50 hover:text-[#1a5b3e] text-zinc-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {activatingId === ver.id ? "Mengaktifkan..." : "Aktifkan"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
