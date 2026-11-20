"use client";

import { useState, useEffect, useMemo } from "react";
import {
  fetchSegments,
  createSegment,
  updateSegment,
  SegmentResponse,
  CorridorType,
  VALID_CORRIDORS,
} from "../../lib/api";
import { getClientUser, isPrivilegedRole, UserResponse } from "../../lib/auth";

export default function SegmenPage() {
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [segments, setSegments] = useState<SegmentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCorridor, setSelectedCorridor] = useState<string>("Semua koridor");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formCorridor, setFormCorridor] = useState<CorridorType>("Ciseke");
  const [formCoords, setFormCoords] = useState(
    "107.7702, -6.9312\n107.7725, -6.9304\n107.7745, -6.9298"
  );
  const [formActive, setFormActive] = useState(true);

  // Load Segments
  async function loadData() {
    setIsLoading(true);
    try {
      const data = await fetchSegments({
        corridor: selectedCorridor !== "Semua koridor" ? selectedCorridor : undefined,
        q: searchTerm || undefined,
      });
      setSegments(data);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setCurrentUser(getClientUser());
    loadData();
  }, [selectedCorridor]);

  // Client-side search & corridor filtering
  const filteredSegments = useMemo(() => {
    return segments.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.segment_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCorridor =
        selectedCorridor === "Semua koridor" || s.corridor === selectedCorridor;
      return matchesSearch && matchesCorridor;
    });
  }, [segments, searchTerm, selectedCorridor]);

  // Unique corridors count
  const uniqueCorridorsCount = useMemo(() => {
    const set = new Set(segments.map((s) => s.corridor));
    return set.size;
  }, [segments]);

  function handleOpenAdd() {
    setIsEditing(false);
    setEditingId(null);
    setFormCode(`G-0${segments.length + 1}`);
    setFormName("");
    setFormCorridor(selectedCorridor !== "Semua koridor" ? (selectedCorridor as CorridorType) : "Ciseke");
    setFormCoords("107.7695, -6.9331\n107.7706, -6.9339");
    setFormActive(true);
    setErrorMsg(null);
    setShowModal(true);
  }

  function handleOpenEdit(seg: SegmentResponse) {
    setIsEditing(true);
    setEditingId(seg.id);
    setFormCode(seg.segment_code);
    setFormName(seg.name);
    setFormCorridor(seg.corridor);
    const coordsStr = (seg.geojson_geometry?.coordinates || [])
      .map((c: any) => `${c[0]}, ${c[1]}`)
      .join("\n");
    setFormCoords(coordsStr);
    setFormActive(seg.is_active);
    setErrorMsg(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    // Parse coordinates [lon, lat]
    const parsedCoords: [number, number][] = [];
    const lines = formCoords.split("\n");
    for (const line of lines) {
      const parts = line.split(",").map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        parsedCoords.push([parts[0], parts[1]]);
      }
    }

    if (parsedCoords.length < 2) {
      setErrorMsg("Geometri LineString minimal membutuhkan 2 pasang koordinat [longitude, latitude].");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && editingId) {
        await updateSegment(editingId, {
          name: formName,
          corridor: formCorridor,
          geojson_geometry: {
            type: "LineString",
            coordinates: parsedCoords,
          },
          is_active: formActive,
        });
        setSuccessMsg(`Segmen "${formName}" berhasil diperbarui.`);
      } else {
        await createSegment({
          segment_code: formCode,
          name: formName,
          corridor: formCorridor,
          geojson_geometry: {
            type: "LineString",
            coordinates: parsedCoords,
          },
          is_active: formActive,
        });
        setSuccessMsg(`Segmen "${formName}" berhasil ditambahkan.`);
      }
      setShowModal(false);
      await loadData();
    } catch {
      // In local fallback mode without backend, simulate update in state
      if (isEditing && editingId) {
        setSegments((prev) =>
          prev.map((s) =>
            s.id === editingId
              ? {
                  ...s,
                  name: formName,
                  corridor: formCorridor,
                  geojson_geometry: { type: "LineString", coordinates: parsedCoords },
                  is_active: formActive,
                  updated_at: "2026-11-15T00:00:00Z",
                }
              : s
          )
        );
        setSuccessMsg(`Segmen "${formName}" berhasil diperbarui (simulasi lokal).`);
        setShowModal(false);
      } else {
        const newSeg: SegmentResponse = {
          id: Date.now(),
          segment_code: formCode,
          name: formName,
          corridor: formCorridor,
          geojson_geometry: { type: "LineString", coordinates: parsedCoords },
          is_active: formActive,
          updated_at: "2026-11-15T00:00:00Z",
          has_geometry: true,
          last_inspection_date: "15 Nov 2026",
        };
        setSegments((prev) => [newSeg, ...prev]);
        setSuccessMsg(`Segmen "${formName}" berhasil ditambahkan (simulasi lokal).`);
        setShowModal(false);
      }
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  }

  return (
    <div className="p-8 bg-[#F7F8F5] min-h-full">
      {/* Header Halaman Sesuai Permintaan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 leading-tight">
            Data segmen gang
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Kelola identitas dan batas segmen gang pada peta.
          </p>
        </div>
        {isPrivilegedRole(currentUser?.role) && (
          <div className="flex items-center">
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span className="text-sm font-semibold">+</span>
              <span>Tambah segmen</span>
            </button>
          </div>
        )}
      </div>

      {/* Success Alert Banner */}
      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Card Utama Berisi Daftar Segmen */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-2xs space-y-5">
        {/* Header di dalam Card: Daftar Segmen & Count */}
        <div>
          <h2 className="text-base font-bold text-zinc-900 leading-tight">
            Daftar segmen
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {segments.length} segmen · {uniqueCorridorsCount} koridor
          </p>
        </div>

        {/* Search & Filter Bar Sesuai Desain Figma (Tanpa label Koridor:, Tanpa Status:, Tanpa teks menampilkan X) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          {/* Input Search */}
          <div className="relative flex-1 max-w-sm">
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
              placeholder="Cari nama atau kode segmen"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
            />
          </div>

          {/* Filter Dropdown Semua Koridor */}
          <div className="relative shrink-0">
            <select
              value={selectedCorridor}
              onChange={(e) => setSelectedCorridor(e.target.value)}
              className="px-3.5 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-800 pr-8 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] cursor-pointer"
            >
              <option value="Semua koridor">Semua koridor</option>
              {VALID_CORRIDORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabel Data Segmen Sesuai Figma */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-medium select-none">
                <th className="py-3 px-3 w-20">Kode</th>
                <th className="py-3 px-3">Nama segmen</th>
                <th className="py-3 px-3">Koridor</th>
                <th className="py-3 px-3">Batas segmen</th>
                <th className="py-3 px-3">Inspeksi terakhir</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-[#1a5b3e]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Memuat data segmen gang...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSegments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    Tidak ada segmen gang yang cocok.
                  </td>
                </tr>
              ) : (
                filteredSegments.map((seg) => {
                  const hasGeo = seg.has_geometry ?? (seg.geojson_geometry?.coordinates?.length > 0);
                  const lastInspection =
                    seg.last_inspection_date ||
                    seg.observation?.inspection_date ||
                    "Belum ada";

                  return (
                    <tr key={seg.id} className="hover:bg-zinc-50/60 transition">
                      {/* Kode Segmen */}
                      <td className="py-3.5 px-3 font-mono text-zinc-600">
                        {seg.segment_code}
                      </td>

                      {/* Nama Segmen (Tebal) */}
                      <td className="py-3.5 px-3 font-bold text-zinc-900">
                        {seg.name}
                      </td>

                      {/* Koridor */}
                      <td className="py-3.5 px-3 text-zinc-600">
                        {seg.corridor}
                      </td>

                      {/* Batas Segmen (Tergambar / Tidak) */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium ${
                            hasGeo
                              ? "bg-[#edf4f0] text-[#1a5b3e] border border-[#d2e4d9]"
                              : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {hasGeo ? "Tergambar" : "Belum ada"}
                        </span>
                      </td>

                      {/* Inspeksi Terakhir */}
                      <td className="py-3.5 px-3 text-zinc-700">
                        {lastInspection}
                      </td>

                      {/* Aksi: Edit -> */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => handleOpenEdit(seg)}
                          className="text-zinc-600 hover:text-zinc-900 font-medium text-xs transition cursor-pointer hover:underline inline-flex items-center gap-1"
                        >
                          <span>Edit</span>
                          <span>&rarr;</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah / Edit Segmen */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-zinc-200 max-w-lg w-full p-6 shadow-xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <h2 className="text-base font-bold text-zinc-900">
                {isEditing ? "Edit Segmen Gang" : "Tambah Segmen Gang"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Kode Segmen
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isEditing}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="G-01"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] disabled:bg-zinc-100 disabled:text-zinc-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Koridor
                  </label>
                  <select
                    value={formCorridor}
                    onChange={(e) => setFormCorridor(e.target.value as CorridorType)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] bg-white text-zinc-900"
                  >
                    {VALID_CORRIDORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nama Gang
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="contoh: Gang Ciseke 01"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-zinc-700">
                    Koordinat Jalur (LineString)
                  </label>
                  <span className="text-[11px] text-zinc-400">Format: longitude, latitude per baris</span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={formCoords}
                  onChange={(e) => setFormCoords(e.target.value)}
                  placeholder="107.7702, -6.9312&#10;107.7725, -6.9304&#10;107.7745, -6.9298"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 font-mono focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="formActiveCheck"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 text-[#1a5b3e] rounded border-zinc-300 focus:ring-[#1a5b3e]"
                />
                <label htmlFor="formActiveCheck" className="text-xs font-medium text-zinc-700 cursor-pointer">
                  Segmen aktif dalam evaluasi prioritas PJU
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-xs font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{isEditing ? "Simpan Perubahan" : "Tambah Segmen"}</span>
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
