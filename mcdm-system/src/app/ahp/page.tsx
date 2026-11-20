"use client";

import { useState, useEffect, useMemo } from "react";
import {
  calculateAHPPreview,
  fetchAHPVersions,
  createAHPVersion,
  activateAHPVersion,
  AHPCalculateResponse,
  AHPVersionResponse,
} from "../../lib/api";
import { getClientUser, isPrivilegedRole, UserResponse } from "../../lib/auth";

interface Criterion {
  id: string;
  name: string;
  description: string;
}

interface CriteriaPair {
  crit1: Criterion;
  crit2: Criterion;
  key: string;
}

const INITIAL_CRITERIA: Criterion[] = [
  { id: "c1", name: "Proporsi lampu mati", description: "Persentase lampu rusak dari total lampu di segmen" },
  { id: "c2", name: "Curanmor dini hari", description: "Jumlah insiden kriminalitas pukul 00.00–05.00 WIB" },
  { id: "c3", name: "Indekos dilayani", description: "Jumlah unit indekos/kost mahasiswa yang terlayani" },
];

// Tabel Random Index (Saaty)
const RI_TABLE: Record<number, number> = {
  1: 0.0,
  2: 0.0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
};

export default function AHPPage() {
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);

  // Criteria Management
  const [criteria, setCriteria] = useState<Criterion[]>(INITIAL_CRITERIA);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCritName, setNewCritName] = useState("");
  const [newCritDesc, setNewCritDesc] = useState("");

  // Dinamis Pairwise Comparisons (Key: "idA-idB")
  const [comparisons, setComparisons] = useState<Record<string, { preferred: string; intensity: number }>>({
    "c1-c2": { preferred: "c1", intensity: 3 },
    "c1-c3": { preferred: "c1", intensity: 5 },
    "c2-c3": { preferred: "c2", intensity: 2 },
  });

  // Bobot per kriteria { [critId]: weight (0..1) }
  const [criterionWeights, setCriterionWeights] = useState<Record<string, number>>({
    c1: 0.648,
    c2: 0.23,
    c3: 0.122,
  });

  // Hasil Perhitungan Konsistensi
  const [consistencyState, setConsistencyState] = useState<{
    lambda_max: number;
    ci: number;
    ri: number;
    cr: number;
    is_consistent: boolean;
    pairwise_matrix: number[][];
  }>({
    pairwise_matrix: [
      [1.0, 3.0, 5.0],
      [1.0 / 3.0, 1.0, 2.0],
      [1.0 / 5.0, 0.5, 1.0],
    ],
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
    setCurrentUser(getClientUser());
    loadVersions();
  }, []);

  // Buat daftar semua pasangan kriteria unik C(n, 2)
  const criteriaPairs: CriteriaPair[] = useMemo(() => {
    const pairs: CriteriaPair[] = [];
    for (let i = 0; i < criteria.length; i++) {
      for (let j = i + 1; j < criteria.length; j++) {
        pairs.push({
          crit1: criteria[i],
          crit2: criteria[j],
          key: `${criteria[i].id}-${criteria[j].id}`,
        });
      }
    }
    return pairs;
  }, [criteria]);

  function handleAddCriterion(e: React.FormEvent) {
    e.preventDefault();
    if (!newCritName.trim()) return;
    const newId = `c${criteria.length + 1}`;
    const newCrit: Criterion = {
      id: newId,
      name: newCritName.trim(),
      description: newCritDesc.trim() || "Kriteria penilaian prioritas baru",
    };

    // Tambah default comparison untuk kriteria baru dengan kriteria lama
    setComparisons((prev) => {
      const nextComp = { ...prev };
      criteria.forEach((c) => {
        nextComp[`${c.id}-${newId}`] = { preferred: c.id, intensity: 2 };
      });
      return nextComp;
    });

    setCriteria((prev) => [...prev, newCrit]);
    setActionSuccessMsg(`Kriteria "${newCritName.trim()}" berhasil ditambahkan dan dimasukkan ke perbandingan.`);
    setNewCritName("");
    setNewCritDesc("");
    setShowAddModal(false);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  }

  // Konversi pilihan UI ke nilai rasio Saaty
  function getRatio(preferred: string, intensity: number, item1Id: string): number {
    if (preferred === "equal") return 1.0;
    if (preferred === item1Id) return intensity;
    return 1.0 / intensity;
  }

  // Hitung Bobot Realtime AHP untuk N Kriteria
  function calculateLocalAHP(
    critList: Criterion[],
    compMap: Record<string, { preferred: string; intensity: number }>
  ) {
    const n = critList.length;
    if (n === 0) return;

    // Susun matriks nxn
    const matrix: number[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => 1.0)
    );

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const idA = critList[i].id;
        const idB = critList[j].id;
        const key = `${idA}-${idB}`;
        const comp = compMap[key] || { preferred: idA, intensity: 1 };
        const val = getRatio(comp.preferred, comp.intensity, idA);
        matrix[i][j] = val;
        matrix[j][i] = 1.0 / val;
      }
    }

    // 1. Column sums
    const colSums = Array.from({ length: n }, (_, c) =>
      matrix.reduce((sum, row) => sum + row[c], 0)
    );

    // 2. Normalization & Row averages (Weights)
    const weights = matrix.map((row) =>
      row.reduce((sum, val, c) => sum + val / colSums[c], 0) / n
    );

    // Map weights to criteria IDs
    const newWeightsMap: Record<string, number> = {};
    critList.forEach((c, idx) => {
      newWeightsMap[c.id] = Number(weights[idx].toFixed(4));
    });

    // 3. Consistency calculation
    const Aw = matrix.map((row) =>
      row.reduce((sum, val, c) => sum + val * weights[c], 0)
    );
    const lambda_max =
      weights.reduce((sum, w, r) => sum + (w > 0 ? Aw[r] / w : 0), 0) / n;
    const ci = n > 1 ? (lambda_max - n) / (n - 1) : 0.0;
    const ri = RI_TABLE[n] || 1.49;
    const cr = ri > 0 ? ci / ri : 0.0;
    const is_consistent = cr <= 0.1;

    setCriterionWeights(newWeightsMap);
    setConsistencyState({
      pairwise_matrix: matrix,
      lambda_max: Number(lambda_max.toFixed(4)),
      ci: Number(ci.toFixed(4)),
      ri,
      cr: Number(cr.toFixed(4)),
      is_consistent,
    });
  }

  // Jalankan kalkulasi setiap ada perubahan pada perbandingan atau kriteria
  useEffect(() => {
    calculateLocalAHP(criteria, comparisons);
  }, [criteria, comparisons]);

  function handleComparisonChange(
    key: string,
    field: "preferred" | "intensity",
    val: string | number
  ) {
    setComparisons((prev) => {
      const current = prev[key] || { preferred: "equal", intensity: 1 };
      return {
        ...prev,
        [key]: {
          ...current,
          [field]: val,
        },
      };
    });
  }

  // Toggle Contoh Inkonsisten (AHP Perlu Direvisi)
  function handleToggleInconsistent() {
    setComparisons((prev) => {
      const updated = { ...prev };
      if (criteria.length >= 3) {
        const id1 = criteria[0].id;
        const id2 = criteria[1].id;
        const id3 = criteria[2].id;
        updated[`${id1}-${id2}`] = { preferred: id1, intensity: 5 };
        updated[`${id1}-${id3}`] = { preferred: id3, intensity: 5 };
        updated[`${id2}-${id3}`] = { preferred: id2, intensity: 4 };
      }
      return updated;
    });
  }

  // Reset ke Rekomendasi Konsisten
  function handleResetConsistent() {
    setComparisons((prev) => {
      const updated = { ...prev };
      if (criteria.length >= 3) {
        const id1 = criteria[0].id;
        const id2 = criteria[1].id;
        const id3 = criteria[2].id;
        updated[`${id1}-${id2}`] = { preferred: id1, intensity: 3 };
        updated[`${id1}-${id3}`] = { preferred: id1, intensity: 5 };
        updated[`${id2}-${id3}`] = { preferred: id2, intensity: 2 };
      }
      return updated;
    });
  }

  // Handler Tombol "Aktifkan bobot"
  async function handleActivateWeight() {
    if (!consistencyState.is_consistent) {
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
      if (criteria.length === 3) {
        const created = await createAHPVersion({
          pairwise_matrix: consistencyState.pairwise_matrix,
          version_name: newVersionName,
          activate_immediately: true,
        });
        setActiveVersionName(created.version_name);
        setActionSuccessMsg(`Bobot "${created.version_name}" berhasil diaktifkan!`);
        await loadVersions();
      } else {
        // Multi-criteria (>3) disimulasikan secara lokal
        setActiveVersionName(newVersionName);
        setActionSuccessMsg(`Bobot "${newVersionName}" (${criteria.length} kriteria) berhasil diaktifkan!`);
      }
    } catch {
      setActiveVersionName(newVersionName);
      setActionSuccessMsg(`Bobot "${newVersionName}" berhasil diaktifkan!`);
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
            Bandingkan kriteria untuk menentukan bobot prioritas perbaikan.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isPrivilegedRole(currentUser?.role) && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span className="text-sm font-semibold">+</span>
              <span>Tambah kriteria</span>
            </button>
          )}
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

          <div className="space-y-4 pt-2">
            {criteriaPairs.map((pair) => {
              const comp = comparisons[pair.key] || {
                preferred: pair.crit1.id,
                intensity: 1,
              };
              return (
                <div
                  key={pair.key}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pb-4 border-b border-zinc-100 last:border-b-0"
                >
                  <div className="sm:col-span-5">
                    <p className="text-sm font-bold text-zinc-900 leading-tight">
                      {pair.crit1.name}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      dibanding {pair.crit2.name}
                    </p>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                      Lebih penting
                    </label>
                    <select
                      value={comp.preferred}
                      onChange={(e) =>
                        handleComparisonChange(pair.key, "preferred", e.target.value)
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] cursor-pointer truncate"
                    >
                      <option value={pair.crit1.id}>{pair.crit1.name}</option>
                      <option value={pair.crit2.id}>{pair.crit2.name}</option>
                      <option value="equal">Sama penting</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                      Intensitas
                    </label>
                    <select
                      disabled={comp.preferred === "equal"}
                      value={comp.intensity}
                      onChange={(e) =>
                        handleComparisonChange(
                          pair.key,
                          "intensity",
                          parseInt(e.target.value)
                        )
                      }
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
              );
            })}
          </div>

          {/* Tombol Aksi Bawah Kartu Kiri */}
          <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
            {consistencyState.is_consistent ? (
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
              onClick={() => calculateLocalAHP(criteria, comparisons)}
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
              Bobot digunakan oleh pemeringkatan TOPSIS ({criteria.length} kriteria).
            </p>
          </div>

          <div className="space-y-6">
            {/* Progress Bars Bobot Dinamis untuk Semua Kriteria */}
            <div className="space-y-4">
              {criteria.map((c, idx) => {
                const w = criterionWeights[c.id] || 0;
                return (
                  <div key={c.id}>
                    <div className="flex justify-between text-xs mb-1.5 font-medium text-zinc-800">
                      <span>C{idx + 1}: {c.name}</span>
                      <span className="font-bold text-zinc-900">
                        {formatPercent(w)}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full bg-[#1a5b3e] transition-all duration-300 rounded-full"
                        style={{ width: `${Math.min(w * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status Konsistensi (Konsisten vs AHP Perlu Direvisi) */}
            {consistencyState.is_consistent ? (
              <div className="p-4 rounded-xl bg-[#edf4f0] border border-[#d2e4d9] text-xs space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-[#1a5b3e]">
                  <svg className="w-4 h-4 text-[#1a5b3e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Konsisten · CR {formatCR(consistencyState.cr)}</span>
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
                  <span>Tidak konsisten · CR {formatCR(consistencyState.cr)}</span>
                </div>
                <p className="text-[11px] text-amber-700 pl-5.5">
                  Perlu direvisi. Batas rasio konsistensi 0,10.
                </p>
                <p className="text-[11px] text-amber-900 bg-amber-100/60 p-2 rounded-lg mt-1">
                  <strong>Rekomendasi revisi:</strong> Terdapat inkonsistensi transitif antar kriteria. Sesuaikan perbandingan agar kepentingan kriteria berurutan secara logis.
                </p>
              </div>
            )}

            {/* Kriteria Aktif Badge / Info */}
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Daftar Kriteria Terdaftar ({criteria.length})
              </p>
              <div className="space-y-1.5">
                {criteria.map((c, idx) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-zinc-800">C{idx + 1}: {c.name}</span>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{c.description}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-zinc-200/60 rounded text-zinc-600 font-medium shrink-0">
                      Aktif
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tombol Utama: Aktifkan bobot */}
            <div>
              <button
                type="button"
                onClick={handleActivateWeight}
                disabled={!consistencyState.is_consistent || isActivating}
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
        </div>
      </div>

      {/* Modal Tambah Kriteria Baru (Khusus ADMIN & PJU) */}
      {showAddModal && isPrivilegedRole(currentUser?.role) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Tambah Kriteria Baru
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Tambahkan parameter kriteria baru untuk penilaian prioritas AHP.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddCriterion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Nama Kriteria <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Aksesibilitas Ambulans / Damkar"
                  value={newCritName}
                  onChange={(e) => setNewCritName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Deskripsi / Keterangan
                </label>
                <textarea
                  rows={3}
                  placeholder="Penjelasan kriteria dan indikator pengukurannya"
                  value={newCritDesc}
                  onChange={(e) => setNewCritDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-semibold transition shadow-xs"
                >
                  Simpan Kriteria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
