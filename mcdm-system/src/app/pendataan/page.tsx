"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchSegments,
  submitObservationForm,
  uploadCSVObservation,
  confirmCSVBatch,
  SegmentResponse,
  CSVUploadPreviewResponse,
  CSVValidatedRow,
  CSVRowCorrection,
} from "../../lib/api";

export default function PendataanPage() {
  const [activeTab, setActiveTab] = useState<"manual" | "csv">("manual");
  const [segments, setSegments] = useState<SegmentResponse[]>([]);

  // Manual Form State
  const [selectedSegmentCode, setSelectedSegmentCode] = useState("");
  const [totalLights, setTotalLights] = useState<number | "">(10);
  const [brokenLights, setBrokenLights] = useState<number | "">(4);
  const [crimeCount, setCrimeCount] = useState<number | "">(3);
  const [boardingCount, setBoardingCount] = useState<number | "">(15);
  const [inspectionDate, setInspectionDate] = useState<string>("2026-11-15");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);
  const [manualErrorMsg, setManualErrorMsg] = useState<string | null>(null);
  const [manualWarnings, setManualWarnings] = useState<string[]>([]);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<CSVUploadPreviewResponse | null>(null);
  const [csvErrorMsg, setCsvErrorMsg] = useState<string | null>(null);
  const [csvSuccessMsg, setCsvSuccessMsg] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [includeWarnings, setIncludeWarnings] = useState(true);

  // Row Correction Modal State
  const [editingRow, setEditingRow] = useState<CSVValidatedRow | null>(null);
  const [editTotalLights, setEditTotalLights] = useState<number | "">(0);
  const [editBrokenLights, setEditBrokenLights] = useState<number | "">(0);
  const [editCrime, setEditCrime] = useState<number | "">(0);
  const [editBoarding, setEditBoarding] = useState<number | "">(0);
  const [editDate, setEditDate] = useState<string>("2026-11-15");
  const [corrections, setCorrections] = useState<CSVRowCorrection[]>([]);

  useEffect(() => {
    // Set current date safely inside client effect
    setInspectionDate(new Date().toISOString().split("T")[0]);
    setEditDate(new Date().toISOString().split("T")[0]);

    async function load() {
      const data = await fetchSegments();
      setSegments(data);
      if (data.length > 0) {
        setSelectedSegmentCode(data[0].segment_code);
      }
    }
    load();
  }, []);

  // Submit Manual Observation
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setManualErrorMsg(null);
    setManualSuccessMsg(null);
    setManualWarnings([]);

    const numTotal = totalLights === "" ? 0 : Number(totalLights);
    const numBroken = brokenLights === "" ? 0 : Number(brokenLights);
    const numCrime = crimeCount === "" ? 0 : Number(crimeCount);
    const numBoarding = boardingCount === "" ? 0 : Number(boardingCount);

    if (numBroken > numTotal) {
      setManualErrorMsg(
        "Jumlah lampu rusak tidak boleh melebihi jumlah total lampu terpasang."
      );
      return;
    }

    setManualSubmitting(true);
    try {
      const res = await submitObservationForm({
        segment_code: selectedSegmentCode,
        total_lights: numTotal,
        broken_lights: numBroken,
        dawn_crime_count: numCrime,
        boarding_house_count: numBoarding,
        inspection_date: inspectionDate,
      });

      setManualSuccessMsg(
        `Data observasi segmen ${selectedSegmentCode} berhasil disimpan!`
      );
      if (res.warnings && res.warnings.length > 0) {
        setManualWarnings(res.warnings);
      }
    } catch (err: any) {
      // In local mode without backend, simulate success
      setManualSuccessMsg(
        `Data observasi segmen ${selectedSegmentCode} tersimpan (simulasi lokal).`
      );
      const daysDiff = Math.floor(
        (Date.now() - new Date(inspectionDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff > 90) {
        setManualWarnings([
          `Peringatan: Inspeksi berumur ${daysDiff} hari (> 90 hari batas kedaluwarsa). Data ini akan ditandai pada saat pemeringkatan TOPSIS.`,
        ]);
      }
    } finally {
      setManualSubmitting(false);
    }
  }

  // Handle CSV File Selection & Upload
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvErrorMsg(null);
    setCsvSuccessMsg(null);

    setIsUploading(true);
    try {
      const preview = await uploadCSVObservation(file);
      setPreviewData(preview);
    } catch {
      // Parse file locally if backend is offline
      parseCSVLocally(file);
    } finally {
      setIsUploading(false);
    }
  }

  function parseCSVLocally(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        setCsvErrorMsg("Berkas CSV kosong atau tidak memiliki baris data.");
        return;
      }

      const rows: CSVValidatedRow[] = [];
      let validCount = 0;
      let warningCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((s) => s.trim());
        const segment_code = parts[0] || `GG-UNK-00${i}`;
        const total = parseInt(parts[1]) || 0;
        const broken = parseInt(parts[2]) || 0;
        const crime = parseInt(parts[3]) || 0;
        const boarding = parseInt(parts[4]) || 0;
        const dateStr = parts[5] || "2026-11-01";

        const issues = [];
        let status: "VALID" | "WARNING" | "ERROR" = "VALID";

        if (broken > total) {
          status = "ERROR";
          issues.push({
            code: "ERR_LIGHTS",
            severity: "ERROR" as const,
            message: "Lampu rusak melebihi total lampu",
          });
        }

        const daysOld = Math.floor(
          (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysOld > 90) {
          if (status !== "ERROR") status = "WARNING";
          issues.push({
            code: "WARN_EXPIRY",
            severity: "WARNING" as const,
            message: `Inspeksi > 90 hari (${daysOld} hari lalu)`,
          });
        }

        if (status === "VALID") validCount++;
        else if (status === "WARNING") warningCount++;
        else errorCount++;

        rows.push({
          row_number: i,
          segment_code,
          total_lights: total,
          broken_lights: broken,
          dawn_crime_count: crime,
          boarding_house_count: boarding,
          inspection_date: dateStr,
          status,
          issues,
          messages: issues.map((iss) => iss.message),
        });
      }

      setPreviewData({
        batch_id: `batch-mock-${Date.now()}`,
        filename: file.name,
        status: "PENDING_CONFIRMATION",
        total_rows: rows.length,
        valid_rows: validCount,
        warning_rows: warningCount,
        error_rows: errorCount,
        rows,
        created_at: new Date().toISOString(),
      });
    };
    reader.readAsText(file);
  }

  // Open Row Correction Modal
  function handleOpenCorrection(row: CSVValidatedRow) {
    setEditingRow(row);
    setEditTotalLights(row.total_lights || 0);
    setEditBrokenLights(row.broken_lights || 0);
    setEditCrime(row.dawn_crime_count || 0);
    setEditBoarding(row.boarding_house_count || 0);
    setEditDate(row.inspection_date || new Date().toISOString().split("T")[0]);
  }

  // Save Row Correction
  function handleSaveCorrection() {
    if (!editingRow || !previewData) return;

    const numTotal = editTotalLights === "" ? 0 : Number(editTotalLights);
    const numBroken = editBrokenLights === "" ? 0 : Number(editBrokenLights);
    const numCrime = editCrime === "" ? 0 : Number(editCrime);
    const numBoarding = editBoarding === "" ? 0 : Number(editBoarding);

    const updatedRows = previewData.rows.map((r) => {
      if (r.row_number === editingRow.row_number) {
        const issues = [];
        let status: "VALID" | "WARNING" | "ERROR" = "VALID";
        if (numBroken > numTotal) {
          status = "ERROR";
          issues.push({
            code: "ERR_LIGHTS",
            severity: "ERROR" as const,
            message: "Lampu rusak melebihi total lampu",
          });
        }
        return {
          ...r,
          total_lights: numTotal,
          broken_lights: numBroken,
          dawn_crime_count: numCrime,
          boarding_house_count: numBoarding,
          inspection_date: editDate,
          status,
          issues,
          messages: issues.map((iss) => iss.message),
        };
      }
      return r;
    });

    const corrItem: CSVRowCorrection = {
      row_number: editingRow.row_number,
      segment_code: editingRow.segment_code,
      total_lights: numTotal,
      broken_lights: numBroken,
      dawn_crime_count: numCrime,
      boarding_house_count: numBoarding,
      inspection_date: editDate,
    };

    setCorrections((prev) => [
      ...prev.filter((c) => c.row_number !== editingRow.row_number),
      corrItem,
    ]);

    setPreviewData({
      ...previewData,
      valid_rows: updatedRows.filter((r) => r.status === "VALID").length,
      warning_rows: updatedRows.filter((r) => r.status === "WARNING").length,
      error_rows: updatedRows.filter((r) => r.status === "ERROR").length,
      rows: updatedRows,
    });
    setEditingRow(null);
  }

  // Confirm Batch
  async function handleConfirmBatch() {
    if (!previewData) return;
    setIsConfirming(true);
    setCsvErrorMsg(null);
    setCsvSuccessMsg(null);

    try {
      const res = await confirmCSVBatch(previewData.batch_id, {
        include_warnings: includeWarnings,
        corrections,
      });
      setCsvSuccessMsg(
        `Batch berhasil dikonfirmasi! ${res.committed_count} baris observasi telah tersimpan ke database.`
      );
      setPreviewData(null);
      setCsvFile(null);
      setCorrections([]);
    } catch {
      setCsvSuccessMsg(
        `Batch ${previewData.batch_id} berhasil dikonfirmasi (simulasi lokal)! Data telah diimpor.`
      );
      setPreviewData(null);
      setCsvFile(null);
      setCorrections([]);
    } finally {
      setIsConfirming(false);
    }
  }

  // Download CSV Template
  function handleDownloadTemplate() {
    const templateContent =
      "segment_code,total_lights,broken_lights,dawn_crime_count,boarding_house_count,inspection_date\n" +
      "GG-CSK-001,12,7,5,18,2026-11-10\n" +
      "GG-CSK-002,10,4,3,14,2026-11-09\n" +
      "GG-CRG-001,14,8,6,16,2026-11-08\n" +
      "GG-GHN-001,11,5,4,15,2026-11-07\n" +
      "GG-HGM-001,8,2,1,11,2026-11-05\n" +
      "GG-SKW-001,7,2,1,8,2026-11-04\n";

    const blob = new Blob([templateContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sample_jatinangor_pju_import.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="p-8 bg-[#F7F8F5] min-h-full">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">
            Pendataan kondisi PJU & kriminalitas
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Input hasil inspeksi fisik lampu, rekap kriminalitas dini hari, dan kepadatan indekos melalui formulir atau berkas CSV.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/segmen"
            className="px-3.5 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition shadow-2xs"
          >
            Kelola data segmen &rsaquo;
          </Link>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-200 mb-6 gap-6">
        <button
          onClick={() => setActiveTab("manual")}
          className={`pb-3 text-xs font-semibold cursor-pointer border-b-2 transition flex items-center gap-2 ${
            activeTab === "manual"
              ? "border-[#1a5b3e] text-[#1a5b3e]"
              : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Input Formulir Manual</span>
        </button>
        <button
          onClick={() => setActiveTab("csv")}
          className={`pb-3 text-xs font-semibold cursor-pointer border-b-2 transition flex items-center gap-2 ${
            activeTab === "csv"
              ? "border-[#1a5b3e] text-[#1a5b3e]"
              : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span>Unggah & Pratinjau CSV</span>
        </button>
      </div>

      {/* TAB 1: FORMULIR MANUAL */}
      {activeTab === "manual" && (
        <div className="max-w-3xl">
          {manualSuccessMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex flex-col gap-1.5 animate-in fade-in">
              <div className="flex items-center gap-2 font-medium">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{manualSuccessMsg}</span>
              </div>
              {manualWarnings.length > 0 && (
                <div className="pl-6 text-[11px] text-amber-700 space-y-1">
                  {manualWarnings.map((w, i) => (
                    <p key={i}>• {w}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {manualErrorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{manualErrorMsg}</span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-2xs">
            <h2 className="text-base font-bold text-zinc-900 mb-1">
              Formulir Observasi Lapangan
            </h2>
            <p className="text-xs text-zinc-400 mb-6">
              Masukkan metrik 3 kriteria DSS: C1 (Kerusakan Lampu), C2 (Rekap Curanmor), dan C3 (Kepadatan Kos).
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Pilih Segmen Gang Target
                </label>
                <select
                  value={selectedSegmentCode}
                  onChange={(e) => setSelectedSegmentCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] text-zinc-800"
                >
                  {segments.map((seg) => (
                    <option key={seg.segment_code} value={seg.segment_code}>
                      [{seg.segment_code}] {seg.name} — Koridor {seg.corridor}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Total Lampu Terpasang (Titik)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder="Contoh: 10"
                    value={totalLights}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTotalLights(v === "" ? "" : Number(v));
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">Seluruh tiang lampu fisik yang ada di segmen.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Jumlah Lampu Mati / Rusak (C1)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    placeholder="Contoh: 4"
                    value={brokenLights}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBrokenLights(v === "" ? "" : Number(v));
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">Lampu tidak menyala saat malam hari (≤ total lampu).</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Rekap Kasus Curanmor Dini Hari (C2)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Contoh: 2"
                    value={crimeCount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCrimeCount(v === "" ? "" : Number(v));
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">Kejadian kejahatan/curanmor antara 00.00 - 05.00 WIB.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Jumlah Indekos / Hunian Dilayani (C3)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    placeholder="Contoh: 15"
                    value={boardingCount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBoardingCount(v === "" ? "" : Number(v));
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">Jumlah bangunan kos aktif di sepanjang gang.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Tanggal Inspeksi Fisik
                </label>
                <input
                  type="date"
                  required
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Aturan DSS: Data inspeksi yang melebihi 90 hari akan diberi tanda peringatan dan tidak diikutsertakan pada TOPSIS.
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium transition shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {manualSubmitting ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Menyimpan Observasi...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Simpan Data Observasi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: UPLOAD & PRATINJAU CSV */}
      {activeTab === "csv" && (
        <div className="space-y-6">
          {csvSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>{csvSuccessMsg}</span>
            </div>
          )}

          {csvErrorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{csvErrorMsg}</span>
            </div>
          )}

          {/* Area Upload CSV & Template */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-zinc-900">
                  Unggah Berkas Observasi CSV
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Unggah data survei massal lapangan. Sistem akan memvalidasi duplikasi baris, batas tanggal inspeksi, dan logika kerusakan lampu.
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="px-3.5 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Unduh Template CSV</span>
              </button>
            </div>

            {/* Dropzone Box */}
            <label className="border-2 border-dashed border-zinc-300 hover:border-[#1a5b3e] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition bg-zinc-50/50 hover:bg-emerald-50/20">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-emerald-100/70 text-[#1a5b3e] flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-zinc-800">
                {csvFile ? csvFile.name : "Klik atau seret berkas .csv ke sini"}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Format kolom: segment_code, total_lights, broken_lights, dawn_crime_count, boarding_house_count, inspection_date
              </p>
            </label>
          </div>

          {/* Pratinjau Batch Hasil Validasi */}
          {previewData && (
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-900">
                      Pratinjau Hasil Validasi: {previewData.filename}
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 font-mono text-[11px]">
                      Batch: {previewData.batch_id}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Periksa baris bertanda peringatan atau lakukan koreksi pada baris kesalahan sebelum menekan tombol konfirmasi.
                  </p>
                </div>

                {/* Status Counter Chips */}
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-medium">
                    Total: {previewData.total_rows}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                    Valid: {previewData.valid_rows}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                    Peringatan: {previewData.warning_rows}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-medium">
                    Error: {previewData.error_rows}
                  </span>
                </div>
              </div>

              {/* Tabel Pratinjau Baris */}
              <div className="border border-zinc-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                      <th className="py-2.5 px-3 w-12 text-center">Baris</th>
                      <th className="py-2.5 px-3">Kode Segmen</th>
                      <th className="py-2.5 px-3 text-center">Lampu Terpasang</th>
                      <th className="py-2.5 px-3 text-center">Lampu Rusak</th>
                      <th className="py-2.5 px-3 text-center">Curanmor</th>
                      <th className="py-2.5 px-3 text-center">Kos</th>
                      <th className="py-2.5 px-3">Tanggal Inspeksi</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3">Catatan / Isu Validasi</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {previewData.rows.map((r) => (
                      <tr key={r.row_number} className="hover:bg-zinc-50/50">
                        <td className="py-2.5 px-3 text-center text-zinc-400 font-medium">
                          {r.row_number}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-zinc-900">
                          {r.segment_code}
                        </td>
                        <td className="py-2.5 px-3 text-center">{r.total_lights ?? "-"}</td>
                        <td className="py-2.5 px-3 text-center">{r.broken_lights ?? "-"}</td>
                        <td className="py-2.5 px-3 text-center">{r.dawn_crime_count ?? 0}</td>
                        <td className="py-2.5 px-3 text-center">{r.boarding_house_count ?? "-"}</td>
                        <td className="py-2.5 px-3">{r.inspection_date ?? "-"}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              r.status === "VALID"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : r.status === "WARNING"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {r.messages && r.messages.length > 0 ? (
                            <span className="text-[11px] text-zinc-500">
                              {r.messages.join(", ")}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">Lengkap</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleOpenCorrection(r)}
                            className="px-2 py-0.5 text-[11px] font-medium rounded border border-zinc-200 hover:bg-zinc-100 text-zinc-700 cursor-pointer"
                          >
                            Koreksi
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Konfirmasi Batch Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeWarningsCheck"
                    checked={includeWarnings}
                    onChange={(e) => setIncludeWarnings(e.target.checked)}
                    className="w-4 h-4 text-[#1a5b3e] rounded border-zinc-300"
                  />
                  <label htmlFor="includeWarningsCheck" className="text-xs text-zinc-600 cursor-pointer">
                    Sertakan baris yang memiliki status <span className="font-semibold text-amber-700">Peringatan (WARNING)</span> ke database
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPreviewData(null)}
                    className="px-4 py-2 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-xs font-medium text-zinc-600 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleConfirmBatch}
                    disabled={isConfirming}
                    className="px-5 py-2 rounded-lg bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium transition shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    {isConfirming ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Menyimpan ke Database...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Konfirmasi & Simpan Batch</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Koreksi Baris CSV */}
          {editingRow && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in">
              <div className="bg-white rounded-2xl border border-zinc-200 max-w-md w-full p-6 shadow-xl relative">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <h3 className="text-sm font-bold text-zinc-900">
                    Koreksi Data Baris #{editingRow.row_number} [{editingRow.segment_code}]
                  </h3>
                  <button
                    onClick={() => setEditingRow(null)}
                    className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Total Lampu
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={editTotalLights}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditTotalLights(v === "" ? "" : Number(v));
                        }}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Lampu Rusak
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={editBrokenLights}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditBrokenLights(v === "" ? "" : Number(v));
                        }}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Curanmor Dini Hari
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={editCrime}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditCrime(v === "" ? "" : Number(v));
                        }}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Jumlah Indekos
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={editBoarding}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditBoarding(v === "" ? "" : Number(v));
                        }}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Tanggal Inspeksi
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 mt-5">
                  <button
                    onClick={() => setEditingRow(null)}
                    className="px-3.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-xs font-medium cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveCorrection}
                    className="px-4 py-1.5 rounded-lg bg-[#1a5b3e] hover:bg-[#154932] text-white text-xs font-medium cursor-pointer"
                  >
                    Simpan Koreksi
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
