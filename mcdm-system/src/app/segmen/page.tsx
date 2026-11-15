"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  fetchSegments,
  createSegment,
  updateSegment,
  SegmentResponse,
  CorridorType,
  VALID_CORRIDORS,
} from "../../lib/api";

export default function SegmenPage() {
  const [segments, setSegments] = useState<SegmentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCorridor, setSelectedCorridor] = useState<string>("Semua");
  const [statusFilter, setStatusFilter] = useState<string>("Semua");

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
    "107.7691, -6.9324\n107.7702, -6.9331\n107.7710, -6.9336"
  );
  const [formActive, setFormActive] = useState(true);

  // Load Segments
  async function loadData() {
    setIsLoading(true);
    try {
      const data = await fetchSegments({
        corridor: selectedCorridor !== "Semua" ? selectedCorridor : undefined,
        q: searchTerm || undefined,
        is_active:
          statusFilter === "Aktif"
            ? true
            : statusFilter === "Nonaktif"
            ? false
            : undefined,
      });
      setSegments(data);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedCorridor, statusFilter]);

  // Client-side search filtering
  const filteredSegments = useMemo(() => {
    return segments.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.segment_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCorridor =
        selectedCorridor === "Semua" || s.corridor === selectedCorridor;
      const matchesStatus =
        statusFilter === "Semua" ||
        (statusFilter === "Aktif" && s.is_active) ||
        (statusFilter === "Nonaktif" && !s.is_active);
      return matchesSearch && matchesCorridor && matchesStatus;
    });
  }, [segments, searchTerm, selectedCorridor, statusFilter]);

  function handleOpenAdd() {
    setIsEditing(false);
    setEditingId(null);
    setFormCode(`GG-${selectedCorridor !== "Semua" ? selectedCorridor.substring(0, 3).toUpperCase() : "CSK"}-00${segments.length + 1}`);
    setFormName("");
    setFormCorridor(selectedCorridor !== "Semua" ? (selectedCorridor as CorridorType) : "Ciseke");
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
    } catch (err: any) {
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
                  updated_at: new Date().toISOString(),
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
          updated_at: new Date().toISOString(),
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
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">
            Data segmen gang
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Kelola batas geografis segmen gang, koridor, dan status inventarisasi di Kecamatan Jatinangor.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/pendataan"
            className="px-3.5 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition flex items-center gap-1.5 shadow-2xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Input observasi</span>
          </Link>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-lg bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Tambah segmen</span>
          </button>
        </div>
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

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-zinc-200/80 p-4 mb-6 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          {/* Input Search */}
          <div className="relative flex-1 min-w-[200px]">
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

          {/* Filter Koridor */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Koridor:</span>
            <select
              value={selectedCorridor}
              onChange={(e) => setSelectedCorridor(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
            >
              <option value="Semua">Semua koridor</option>
              {VALID_CORRIDORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
            >
              <option value="Semua">Semua</option>
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>
          </div>
        </div>

        {/* Total Count */}
        <div className="text-xs text-zinc-500 font-medium">
          Menampilkan <span className="text-zinc-800 font-semibold">{filteredSegments.length}</span> segmen gang
        </div>
      </div>

      {/* Tabel Data Segmen */}
      <div className="bg-white rounded-xl border border-zinc-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/75 border-b border-zinc-200 text-zinc-500 font-medium select-none">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Kode Segmen</th>
                <th className="py-3 px-4">Nama Gang</th>
                <th className="py-3 px-4">Koridor</th>
                <th className="py-3 px-4">Geometri</th>
                <th className="py-3 px-4">Observasi Terakhir</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
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
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    Tidak ada segmen gang yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredSegments.map((seg, idx) => {
                  const coordsCount = seg.geojson_geometry?.coordinates?.length || 0;
                  const obs = seg.observation;
                  return (
                    <tr key={seg.id} className="hover:bg-zinc-50/60 transition">
                      <td className="py-3.5 px-4 text-center text-zinc-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-zinc-800">
                        <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[11px]">
                          {seg.segment_code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-zinc-900">
                        {seg.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#1a5b3e] font-medium text-[11px] border border-emerald-100">
                          {seg.corridor}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 font-mono text-[11px]">
                        LineString ({coordsCount} titik)
                      </td>
                      <td className="py-3.5 px-4">
                        {obs ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-zinc-800 font-medium">
                              Lampu: {obs.broken_lights}/{obs.total_lights} rusak
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              Curanmor: {obs.dawn_crime_count || 0} | Kos: {obs.boarding_house_count}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">Belum ada inspeksi</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            seg.is_active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                          }`}
                        >
                          {seg.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(seg)}
                            className="px-2.5 py-1 rounded border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-[11px] font-medium transition cursor-pointer"
                          >
                            Edit
                          </button>
                          <Link
                            href={`/?corridor=${encodeURIComponent(seg.corridor)}`}
                            className="px-2.5 py-1 rounded bg-[#edf4f0] hover:bg-[#e0ece5] text-[#1a5b3e] text-[11px] font-medium transition"
                          >
                            Peta
                          </Link>
                        </div>
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
                {isEditing ? "Edit Segmen Gang" : "Tambah Segmen Gang Baru"}
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
                    placeholder="GG-CSK-001"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] disabled:bg-zinc-100 disabled:text-zinc-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Koridor
                  </label>
                  <select
                    value={formCorridor}
                    onChange={(e) => setFormCorridor(e.target.value as CorridorType)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] bg-white"
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
                  placeholder="contoh: Gang Ciseke Lama Utara"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
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
                  placeholder="107.7691, -6.9324&#10;107.7702, -6.9331&#10;107.7710, -6.9336"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
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
                  className="px-4 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-xs font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium transition shadow-xs cursor-pointer flex items-center gap-1.5"
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
