"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  runTOPSISCycle,
  getTOPSISCycleDetail,
  TOPSISCycleDetailResponse,
  CycleRankingItemResponse,
  CorridorType,
  VALID_CORRIDORS,
} from "../../lib/api";

const MOCK_CYCLE_DETAIL: TOPSISCycleDetailResponse = {
  cycle_id: 1,
  cycle_name: "Siklus Evaluasi November 2026",
  executed_by: 2,
  ahp_version_id: 1,
  weights_snapshot: {
    w_light_damage: 0.5571,
    w_dawn_crime: 0.3202,
    w_boarding_density: 0.1226,
    version_name: "Bobot Pakar Q4 2026",
  },
  status: "RANKED",
  created_at: "2026-11-13T18:30:00Z",
  eligible_count: 7,
  ineligible_count: 1,
  eligible_results: [
    {
      id: 1,
      segment_id: 1,
      segment_code: "G-01",
      segment_name: "Gang Ciseke 01",
      corridor: "Ciseke",
      is_eligible: true,
      ineligible_reason: null,
      snapshot_data: {
        total_lights: 8,
        broken_lights: 6,
        dawn_crime_count: 7,
        boarding_house_count: 26,
        inspection_date: "2026-11-08",
      },
      norm_c1: 0.6667,
      norm_c2: 0.6547,
      norm_c3: 0.5983,
      weighted_c1: 0.3714,
      weighted_c2: 0.2097,
      weighted_c3: 0.0734,
      d_plus: 0.0,
      d_minus: 0.3105,
      preference_score: 1.0,
      rank: 1,
      priority_category: "Tinggi",
      is_tie_broken: false,
    },
    {
      id: 2,
      segment_id: 2,
      segment_code: "G-02",
      segment_name: "Gang Caringin 01",
      corridor: "Caringin",
      is_eligible: true,
      ineligible_reason: null,
      snapshot_data: {
        total_lights: 6,
        broken_lights: 4,
        dawn_crime_count: 4,
        boarding_house_count: 19,
        inspection_date: "2026-11-04",
      },
      norm_c1: 0.4444,
      norm_c2: 0.374,
      norm_c3: 0.4376,
      weighted_c1: 0.2476,
      weighted_c2: 0.1198,
      weighted_c3: 0.0537,
      d_plus: 0.1012,
      d_minus: 0.221,
      preference_score: 0.686,
      rank: 2,
      priority_category: "Tinggi",
      is_tie_broken: false,
    },
    {
      id: 3,
      segment_id: 3,
      segment_code: "G-03",
      segment_name: "Gang H. Nena 01",
      corridor: "Gang H Nena",
      is_eligible: true,
      ineligible_reason: null,
      snapshot_data: {
        total_lights: 9,
        broken_lights: 5,
        dawn_crime_count: 3,
        boarding_house_count: 15,
        inspection_date: "2026-11-06",
      },
      norm_c1: 0.5556,
      norm_c2: 0.2805,
      norm_c3: 0.3455,
      weighted_c1: 0.3095,
      weighted_c2: 0.0898,
      weighted_c3: 0.0424,
      d_plus: 0.1142,
      d_minus: 0.2015,
      preference_score: 0.638,
      rank: 3,
      priority_category: "Sedang",
      is_tie_broken: false,
    },
    {
      id: 4,
      segment_id: 4,
      segment_code: "G-06",
      segment_name: "Gang Ciseke 02",
      corridor: "Ciseke",
      is_eligible: true,
      ineligible_reason: null,
      snapshot_data: {
        total_lights: 7,
        broken_lights: 3,
        dawn_crime_count: 2,
        boarding_house_count: 14,
        inspection_date: "2026-11-02",
      },
      norm_c1: 0.3333,
      norm_c2: 0.187,
      norm_c3: 0.3225,
      weighted_c1: 0.1857,
      weighted_c2: 0.0599,
      weighted_c3: 0.0396,
      d_plus: 0.1898,
      d_minus: 0.1298,
      preference_score: 0.406,
      rank: 4,
      priority_category: "Sedang",
      is_tie_broken: false,
    },
    {
      id: 5,
      segment_id: 5,
      segment_code: "G-04",
      segment_name: "Gang Hegarmanah 01",
      corridor: "Hegarmanah",
      is_eligible: true,
      ineligible_reason: null,
      snapshot_data: {
        total_lights: 8,
        broken_lights: 2,
        dawn_crime_count: 1,
        boarding_house_count: 8,
        inspection_date: "2026-10-29",
      },
      norm_c1: 0.2222,
      norm_c2: 0.0935,
      norm_c3: 0.1842,
      weighted_c1: 0.1238,
      weighted_c2: 0.0299,
      weighted_c3: 0.0226,
      d_plus: 0.2614,
      d_minus: 0.0611,
      preference_score: 0.189,
      rank: 5,
      priority_category: "Rendah",
      is_tie_broken: false,
    },
    {
      id: 6,
      segment_id: 6,
      segment_code: "G-05",
      segment_name: "Gang Sukawening 01",
      corridor: "Sukawening",
      is_eligible: true,
      ineligible_reason: null,
      snapshot_data: {
        total_lights: 5,
        broken_lights: 1,
        dawn_crime_count: 0,
        boarding_house_count: 6,
        inspection_date: "2026-10-27",
      },
      norm_c1: 0.1111,
      norm_c2: 0.0,
      norm_c3: 0.1382,
      weighted_c1: 0.0619,
      weighted_c2: 0.0,
      weighted_c3: 0.0169,
      d_plus: 0.2985,
      d_minus: 0.023,
      preference_score: 0.072,
      rank: 6,
      priority_category: "Rendah",
      is_tie_broken: false,
    },
    {
      id: 7,
      segment_id: 7,
      segment_code: "G-07",
      segment_name: "Gang Caringin 02",
      corridor: "Caringin",
      is_eligible: true,
      ineligible_reason: null,
      snapshot_data: {
        total_lights: 7,
        broken_lights: 3,
        dawn_crime_count: 2,
        boarding_house_count: 10,
        inspection_date: "2026-10-23",
      },
      norm_c1: 0.3333,
      norm_c2: 0.187,
      norm_c3: 0.2303,
      weighted_c1: 0.1857,
      weighted_c2: 0.0599,
      weighted_c3: 0.0282,
      d_plus: 0.2012,
      d_minus: 0.1156,
      preference_score: 0.365,
      rank: 7,
      priority_category: "Rendah",
      is_tie_broken: false,
    },
  ],
  ineligible_results: [
    {
      id: 8,
      segment_id: 8,
      segment_code: "G-08",
      segment_name: "Gang Sukawening 02",
      corridor: "Sukawening",
      is_eligible: false,
      ineligible_reason: "Inspeksi fisik kedaluwarsa (> 90 hari)",
      snapshot_data: {
        total_lights: 6,
        broken_lights: 2,
        dawn_crime_count: 1,
        boarding_house_count: 7,
        inspection_date: "2026-08-02",
      },
      norm_c1: null,
      norm_c2: null,
      norm_c3: null,
      weighted_c1: null,
      weighted_c2: null,
      weighted_c3: null,
      d_plus: null,
      d_minus: null,
      preference_score: null,
      rank: null,
      priority_category: "Tidak Layak",
      is_tie_broken: false,
    },
  ],
};

export default function PemeringkatanPage() {
  const [cycleDetail, setCycleDetail] = useState<TOPSISCycleDetailResponse>(MOCK_CYCLE_DETAIL);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"eligible" | "ineligible">("eligible");

  // Filtering
  const [selectedCorridor, setSelectedCorridor] = useState<string>("Semua");
  const [selectedPriority, setSelectedPriority] = useState<string>("Semua");
  const [searchTerm, setSearchTerm] = useState("");
  const [showMatrixDetails, setShowMatrixDetails] = useState(false);

  // New Cycle Modal
  const [showNewCycleModal, setShowNewCycleModal] = useState(false);
  const [cycleNameInput, setCycleNameInput] = useState("Siklus Evaluasi Q4 2026");
  const [isExecuting, setIsExecuting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Load latest cycle
  async function loadLatestCycle() {
    setIsLoading(true);
    try {
      const data = await getTOPSISCycleDetail(1);
      setCycleDetail(data);
    } catch {
      // Keep mock data if backend not reachable
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLatestCycle();
  }, []);

  // Filter Eligible Segments
  const filteredEligible = useMemo(() => {
    return cycleDetail.eligible_results.filter((item) => {
      const matchesSearch =
        item.segment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.segment_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCorridor =
        selectedCorridor === "Semua" || item.corridor === selectedCorridor;
      const matchesPriority =
        selectedPriority === "Semua" || item.priority_category === selectedPriority;
      return matchesSearch && matchesCorridor && matchesPriority;
    });
  }, [cycleDetail.eligible_results, searchTerm, selectedCorridor, selectedPriority]);

  // Handle Run New TOPSIS Cycle
  async function handleRunNewCycle(e: React.FormEvent) {
    e.preventDefault();
    setIsExecuting(true);
    setActionSuccessMsg(null);
    try {
      const result = await runTOPSISCycle({
        cycle_name: cycleNameInput,
        criteria_directions: ["max", "max", "max"],
      });
      setCycleDetail(result);
      setActionSuccessMsg(`Siklus "${cycleNameInput}" berhasil dijalankan!`);
      setShowNewCycleModal(false);
    } catch (err: any) {
      // Local simulation
      const simulated: TOPSISCycleDetailResponse = {
        ...MOCK_CYCLE_DETAIL,
        cycle_id: Date.now(),
        cycle_name: cycleNameInput,
        created_at: new Date().toISOString(),
      };
      setCycleDetail(simulated);
      setActionSuccessMsg(
        `Siklus "${cycleNameInput}" berhasil dieksekusi (simulasi TOPSIS)!`
      );
      setShowNewCycleModal(false);
    } finally {
      setIsExecuting(false);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  }

  return (
    <div className="p-8 bg-[#F7F8F5] min-h-full">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">
            Pemeringkatan prioritas TOPSIS
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Penentuan urutan prioritas gang berdasar skor kedekatan solusi ideal (TOPSIS) dengan bobot kriteria AHP aktif.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="px-3.5 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition shadow-2xs flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            <span>Peta prioritas</span>
          </Link>
          <button
            onClick={() => setShowNewCycleModal(true)}
            className="px-4 py-2 rounded-lg bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium transition shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Hitung siklus baru</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccessMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Ringkasan Parameter Siklus Aktif */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 mb-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#1a5b3e] font-bold text-[11px] border border-emerald-200">
                Siklus #{cycleDetail.cycle_id}
              </span>
              <h2 className="text-base font-bold text-zinc-900">
                {cycleDetail.cycle_name}
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Dieksekusi pada: {cycleDetail.created_at ? cycleDetail.created_at.replace("T", " ").substring(0, 16) + " WIB" : "-"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/ahp"
              className="text-xs text-zinc-500 hover:text-[#1a5b3e] underline font-medium"
            >
              Versi Bobot AHP: {cycleDetail.weights_snapshot?.version_name || "Standar DSS"}
            </Link>
            <Link
              href="/daftar-kerja"
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition shadow-2xs"
            >
              Lanjut ke Daftar Kerja &rsaquo;
            </Link>
          </div>
        </div>

        {/* 3 Kriteria Bobot Snapshot */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <span className="text-[11px] text-zinc-400 block mb-0.5">Bobot Kerusakan Lampu (C1)</span>
            <span className="text-sm font-bold text-zinc-900 font-mono">
              {((cycleDetail.weights_snapshot?.w_light_damage || 0.5571) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <span className="text-[11px] text-zinc-400 block mb-0.5">Bobot Curanmor Dini Hari (C2)</span>
            <span className="text-sm font-bold text-zinc-900 font-mono">
              {((cycleDetail.weights_snapshot?.w_dawn_crime || 0.3202) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <span className="text-[11px] text-zinc-400 block mb-0.5">Bobot Kepadatan Kos (C3)</span>
            <span className="text-sm font-bold text-zinc-900 font-mono">
              {((cycleDetail.weights_snapshot?.w_boarding_density || 0.1226) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <span className="text-[11px] text-emerald-700 block mb-0.5">Total Segmen Teruji</span>
            <span className="text-sm font-bold text-emerald-900">
              {cycleDetail.eligible_count} Layak / {cycleDetail.ineligible_count} Tidak Layak
            </span>
          </div>
        </div>
      </div>

      {/* Tabs: Segmen Layak vs Tidak Layak */}
      <div className="flex border-b border-zinc-200 mb-6 gap-6">
        <button
          onClick={() => setActiveTab("eligible")}
          className={`pb-3 text-xs font-semibold cursor-pointer border-b-2 transition flex items-center gap-2 ${
            activeTab === "eligible"
              ? "border-[#1a5b3e] text-[#1a5b3e]"
              : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          <span>Segmen Layak Prioritas ({cycleDetail.eligible_results.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("ineligible")}
          className={`pb-3 text-xs font-semibold cursor-pointer border-b-2 transition flex items-center gap-2 ${
            activeTab === "ineligible"
              ? "border-[#1a5b3e] text-[#1a5b3e]"
              : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          <span>Segmen Tidak Layak / Diskualifikasi ({cycleDetail.ineligible_results.length})</span>
        </button>
      </div>

      {/* TAB 1: HASIL PEMERINGKATAN SEGMEN LAYAK */}
      {activeTab === "eligible" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-xl border border-zinc-200/80 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <svg
                  className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Cari kode atau nama gang..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-zinc-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                />
              </div>

              {/* Koridor Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Koridor:</span>
                <select
                  value={selectedCorridor}
                  onChange={(e) => setSelectedCorridor(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-700"
                >
                  <option value="Semua">Semua</option>
                  {VALID_CORRIDORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kategori Prioritas Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Prioritas:</span>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-700"
                >
                  <option value="Semua">Semua</option>
                  <option value="Tinggi">Tinggi (≥ 0.66)</option>
                  <option value="Sedang">Sedang (0.33 - 0.659)</option>
                  <option value="Rendah">Rendah (&lt; 0.33)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMatrixDetails(!showMatrixDetails)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition cursor-pointer"
              >
                {showMatrixDetails ? "Sembunyikan Rincian TOPSIS" : "Tampilkan Rincian (D+/D-)"}
              </button>
            </div>
          </div>

          {/* Tabel Hasil Pemeringkatan */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/75 border-b border-zinc-200 text-zinc-500 font-medium">
                    <th className="py-3 px-4 w-16 text-center">Rank</th>
                    <th className="py-3 px-4">Kode & Nama Segmen</th>
                    <th className="py-3 px-4">Koridor</th>
                    <th className="py-3 px-4 text-center">Kategori Prioritas</th>
                    <th className="py-3 px-4">Skor Preferensi (Vi)</th>
                    <th className="py-3 px-4 text-center">Indikator Lapangan</th>
                    {showMatrixDetails && (
                      <>
                        <th className="py-3 px-4 text-center">Normalisasi Terbobot (v1,v2,v3)</th>
                        <th className="py-3 px-4 text-center">Jarak D+ / D-</th>
                      </>
                    )}
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filteredEligible.length === 0 ? (
                    <tr>
                      <td colSpan={showMatrixDetails ? 9 : 7} className="py-12 text-center text-zinc-400">
                        Tidak ada segmen yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredEligible.map((item) => {
                      const snap = item.snapshot_data;
                      return (
                        <tr key={item.id} className="hover:bg-zinc-50/50 transition">
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`w-7 h-7 rounded-full inline-flex items-center justify-center font-bold text-xs ${
                                item.rank === 1
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : item.rank === 2
                                  ? "bg-zinc-200 text-zinc-800 border border-zinc-300"
                                  : item.rank === 3
                                  ? "bg-orange-100 text-orange-800 border border-orange-200"
                                  : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              #{item.rank}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-zinc-900">
                                {item.segment_name}
                              </span>
                              <span className="font-mono text-[11px] text-zinc-400">
                                {item.segment_code}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#1a5b3e] text-[11px] font-medium border border-emerald-100">
                              {item.corridor}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                item.priority_category === "Tinggi"
                                  ? "bg-emerald-100 text-[#1a5b3e] border border-emerald-200"
                                  : item.priority_category === "Sedang"
                                  ? "bg-amber-100 text-[#c97a26] border border-amber-200"
                                  : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                              }`}
                            >
                              {item.priority_category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-zinc-900 text-xs w-12">
                                {item.preference_score?.toFixed(3)}
                              </span>
                              <div className="w-24 h-2 rounded-full bg-zinc-100 overflow-hidden">
                                <div
                                  className="h-full bg-[#1a5b3e]"
                                  style={{ width: `${(item.preference_score || 0) * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex flex-col text-[11px]">
                              <span className="font-medium text-zinc-800">
                                {snap.broken_lights}/{snap.total_lights} lampu rusak
                              </span>
                              <span className="text-zinc-400">
                                {snap.dawn_crime_count} curanmor | {snap.boarding_house_count} kos
                              </span>
                            </div>
                          </td>
                          {showMatrixDetails && (
                            <>
                              <td className="py-3.5 px-4 text-center font-mono text-[11px] text-zinc-600">
                                {item.weighted_c1?.toFixed(3)}, {item.weighted_c2?.toFixed(3)}, {item.weighted_c3?.toFixed(3)}
                              </td>
                              <td className="py-3.5 px-4 text-center font-mono text-[11px]">
                                <span className="text-emerald-700">D+: {item.d_plus?.toFixed(3)}</span>
                                <span className="text-zinc-300 mx-1">|</span>
                                <span className="text-zinc-600">D-: {item.d_minus?.toFixed(3)}</span>
                              </td>
                            </>
                          )}
                          <td className="py-3.5 px-4 text-right">
                            <Link
                              href={`/?corridor=${encodeURIComponent(item.corridor)}`}
                              className="px-2.5 py-1 rounded bg-[#edf4f0] hover:bg-[#e0ece5] text-[#1a5b3e] text-[11px] font-medium transition"
                            >
                              Lihat Peta
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SEGMEN TIDAK LAYAK (INELIGIBLE) */}
      {activeTab === "ineligible" && (
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Daftar Segmen Tidak Layak (Diskualifikasi Evaluasi)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Segmen-segmen ini memiliki data inspeksi fisik yang telah kedaluwarsa (&gt; 90 hari) atau data observasi belum lengkap sehingga tidak disertakan pada matriks TOPSIS.
              </p>
            </div>
          </div>

          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                  <th className="py-2.5 px-3">Kode Segmen</th>
                  <th className="py-2.5 px-3">Nama Gang</th>
                  <th className="py-2.5 px-3">Koridor</th>
                  <th className="py-2.5 px-3">Alasan Diskualifikasi</th>
                  <th className="py-2.5 px-3">Tanggal Inspeksi Terakhir</th>
                  <th className="py-2.5 px-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {cycleDetail.ineligible_results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-400">
                      Seluruh segmen gang memenuhi syarat kelayakan (tidak ada segmen yang didiskualifikasi).
                    </td>
                  </tr>
                ) : (
                  cycleDetail.ineligible_results.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-3 font-mono font-semibold text-zinc-800">
                        {item.segment_code}
                      </td>
                      <td className="py-3 px-3 font-medium text-zinc-900">
                        {item.segment_name}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[11px]">
                          {item.corridor}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium text-[11px] inline-flex items-center gap-1">
                          <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>{item.ineligible_reason || "Tidak memenuhi kriteria"}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-zinc-500">
                        {item.snapshot_data?.inspection_date || "-"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          href="/pendataan"
                          className="px-2.5 py-1 rounded bg-[#1a5b3e] hover:bg-[#154932] text-white text-[11px] font-medium transition"
                        >
                          Update Data Inspeksi
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Hitung Siklus TOPSIS Baru */}
      {showNewCycleModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-zinc-200 max-w-md w-full p-6 shadow-xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-base font-bold text-zinc-900">
                Jalankan Siklus Pemeringkatan Baru
              </h3>
              <button
                onClick={() => setShowNewCycleModal(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleRunNewCycle} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nama Siklus Evaluasi
                </label>
                <input
                  type="text"
                  required
                  value={cycleNameInput}
                  onChange={(e) => setCycleNameInput(e.target.value)}
                  placeholder="contoh: Evaluasi Prioritas Triwulan 4 2026"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                />
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 space-y-1">
                <p className="font-semibold text-zinc-800">Ketentuan Perhitungan TOPSIS:</p>
                <p>• Menggunakan versi bobot AHP yang saat ini berstatus aktif.</p>
                <p>• Seluruh 3 kriteria (Kerusakan Lampu, Curanmor Dini Hari, Kepadatan Kos) bernilai benefit (makin besar makin prioritas diperbaiki).</p>
                <p>• Segmen gang dengan inspeksi &gt; 90 hari akan otomatis didiskualifikasi.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowNewCycleModal(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isExecuting}
                  className="px-5 py-2 rounded-lg bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isExecuting ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Menjalankan TOPSIS...</span>
                    </>
                  ) : (
                    <span>Hitung Pemeringkatan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
