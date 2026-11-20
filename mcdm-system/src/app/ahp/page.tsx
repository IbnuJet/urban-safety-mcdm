"use client";

import { useEffect, useState } from "react";
import {
  AHPCalculateResponse,
  AHPCriterion,
  AHPVersionResponse,
  calculateAHPPreview,
  createAHPVersion,
  fetchAHPVersions,
} from "../../lib/api";

const INITIAL_CRITERIA: AHPCriterion[] = [
  { key: "broken_lights", name: "Kerusakan Lampu PJU", direction: "max" },
  { key: "dawn_crime_count", name: "Curanmor Dini Hari", direction: "max" },
  { key: "boarding_house_count", name: "Kepadatan Indekos", direction: "max" },
];

const INITIAL_MATRIX = [
  [1, 3, 5],
  [1 / 3, 1, 2],
  [1 / 5, 1 / 2, 1],
];

export default function AHPPage() {
  const [criteria, setCriteria] = useState<AHPCriterion[]>(INITIAL_CRITERIA);
  const [matrix, setMatrix] = useState<number[][]>(INITIAL_MATRIX);
  const [calcResult, setCalcResult] = useState<AHPCalculateResponse | null>(null);
  const [versions, setVersions] = useState<AHPVersionResponse[]>([]);
  const [activeVersionName, setActiveVersionName] = useState("Belum ada");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadVersions() {
    try {
      const loadedVersions = await fetchAHPVersions();
      setVersions(loadedVersions);
      setActiveVersionName(
        loadedVersions.find((version) => version.is_active)?.version_name ?? "Belum ada"
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat versi AHP."
      );
    }
  }

  useEffect(() => {
    let active = true;
    fetchAHPVersions()
      .then((loadedVersions) => {
        if (!active) return;
        setVersions(loadedVersions);
        const activeVersion = loadedVersions.find((version) => version.is_active);
        setActiveVersionName(activeVersion?.version_name ?? "Belum ada");
        const nextCriteria = activeVersion?.criteria ?? INITIAL_CRITERIA;
        const nextMatrix = activeVersion?.pairwise_matrix ?? INITIAL_MATRIX;
        setCriteria(nextCriteria);
        setMatrix(nextMatrix);
        return calculateAHPPreview(nextMatrix, nextCriteria).then((result) => {
          if (active) setCalcResult(result);
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat versi AHP."
        );
      });
    return () => {
      active = false;
    };
  }, []);

  async function runCalculation(
    nextCriteria = criteria,
    nextMatrix = matrix
  ) {
    if (nextCriteria.length === 0) return;
    setIsCalculating(true);
    setErrorMessage(null);
    try {
      const result = await calculateAHPPreview(nextMatrix, nextCriteria);
      setCalcResult(result);
    } catch (error) {
      setCalcResult(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal menghitung bobot AHP."
      );
    } finally {
      setIsCalculating(false);
    }
  }

  function updateCriterion(index: number, patch: Partial<AHPCriterion>) {
    const updated = criteria.map((criterion, currentIndex) =>
      currentIndex === index ? { ...criterion, ...patch } : criterion
    );
    setCriteria(updated);
    void runCalculation(updated, matrix);
  }

  function addCriterion() {
    if (criteria.length >= 15) return;
    const nextCriteria = [
      ...criteria,
      {
        key: `criterion_${crypto.randomUUID().replaceAll("-", "")}`,
        name: `Kriteria ${criteria.length + 1}`,
        direction: "max" as const,
      },
    ];
    const nextMatrix = [
      ...matrix.map((row) => [...row, 1]),
      Array(nextCriteria.length).fill(1),
    ];
    setCriteria(nextCriteria);
    setMatrix(nextMatrix);
    void runCalculation(nextCriteria, nextMatrix);
  }

  function removeCriterion(index: number) {
    if (criteria.length <= 1) return;
    const nextCriteria = criteria.filter((_, currentIndex) => currentIndex !== index);
    const nextMatrix = matrix
      .filter((_, currentIndex) => currentIndex !== index)
      .map((row) => row.filter((_, currentIndex) => currentIndex !== index));
    setCriteria(nextCriteria);
    setMatrix(nextMatrix);
    void runCalculation(nextCriteria, nextMatrix);
  }

  function setPairwiseComparison(
    left: number,
    right: number,
    preferred: "left" | "right" | "equal",
    intensity: number
  ) {
    const value = preferred === "equal" ? 1 : preferred === "left" ? intensity : 1 / intensity;
    const nextMatrix = matrix.map((row) => [...row]);
    nextMatrix[left][right] = value;
    nextMatrix[right][left] = 1 / value;
    setMatrix(nextMatrix);
    void runCalculation(criteria, nextMatrix);
  }

  async function handleActivateWeight() {
    if (!calcResult?.is_consistent) return;
    setIsActivating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await createAHPVersion({
        pairwise_matrix: calcResult.pairwise_matrix,
        criteria: criteria.map(({ key, name, direction }) => ({ key, name, direction })),
        version_name: `Versi ${versions.length + 1}`,
        activate_immediately: true,
      });
      setActiveVersionName(created.version_name);
      setSuccessMessage(`Bobot "${created.version_name}" berhasil diaktifkan.`);
      await loadVersions();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal mengaktifkan bobot AHP."
      );
    } finally {
      setIsActivating(false);
    }
  }

  function formatPercent(value: number) {
    return `${(value * 100).toFixed(1).replace(".", ",")}%`;
  }

  return (
    <main className="min-h-full bg-[#F7F8F5] p-8">
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Pembobotan AHP
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Atur kriteria, bandingkan tingkat kepentingannya, lalu simpan bobot.
          </p>
        </div>
        <span className="rounded-full border border-[#d2e4d9] bg-[#edf4f0] px-3.5 py-1.5 text-xs font-semibold text-[#1a5b3e]">
          Bobot aktif - {activeVersionName}
        </span>
      </header>

      {errorMessage && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <section className="space-y-6 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs lg:col-span-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Daftar kriteria</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Maksimal 15 kriteria agar rasio konsistensi memiliki nilai RI.
              </p>
            </div>
            <button
              type="button"
              onClick={addCriterion}
              disabled={criteria.length >= 15}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Tambah kriteria
            </button>
          </div>

          <div className="space-y-3">
            {criteria.map((criterion, index) => {
              const isBuiltin = [
                "broken_lights",
                "dawn_crime_count",
                "boarding_house_count",
              ].includes(criterion.key);
              return (
                <div
                  key={`${index}-${criterion.key}`}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-100 p-3 sm:grid-cols-12"
                >
                  <label className="sm:col-span-3">
                      <span className="mb-1 block text-[11px] font-medium text-zinc-600">
                        Key data
                      </span>
                      <input
                        value={criterion.key}
                        onChange={(event) =>
                          updateCriterion(index, {
                            key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                          })
                        }
                        disabled={isBuiltin}
                        maxLength={80}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs disabled:bg-zinc-100"
                      />
                    </label>
                  <label className="sm:col-span-5">
                  <span className="mb-1 block text-[11px] font-medium text-zinc-600">
                    Nama kriteria
                  </span>
                  <input
                    value={criterion.name}
                    onChange={(event) =>
                      updateCriterion(index, { name: event.target.value })
                    }
                    maxLength={150}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs"
                  />
                </label>
                <label className="sm:col-span-3">
                  <span className="mb-1 block text-[11px] font-medium text-zinc-600">
                    Arah nilai
                  </span>
                  <select
                    value={criterion.direction}
                    onChange={(event) =>
                      updateCriterion(index, {
                        direction: event.target.value as "max" | "min",
                      })
                    }
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                  >
                    <option value="max">Semakin besar semakin baik</option>
                    <option value="min">Semakin kecil semakin baik</option>
                  </select>
                </label>
                <div className="flex items-end sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => removeCriterion(index)}
                    disabled={criteria.length <= 1}
                    aria-label={`Hapus ${criterion.name}`}
                    className="w-full rounded-lg px-2 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-30"
                  >
                    Hapus
                  </button>
                </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-zinc-100 pt-5">
            <h2 className="text-base font-bold text-zinc-900">
              Perbandingan berpasangan
            </h2>
            <p className="mb-4 mt-1 text-xs text-zinc-400">
              Skala Saaty 1–9. Nilai perbandingan kebalikannya dihitung otomatis.
            </p>
            <div className="space-y-4">
              {criteria.map((left, leftIndex) =>
                criteria.slice(leftIndex + 1).map((right, offset) => {
                  const rightIndex = leftIndex + offset + 1;
                  const ratio = matrix[leftIndex][rightIndex];
                  const preference =
                    ratio === 1 ? "equal" : ratio > 1 ? "left" : "right";
                  const intensity = Math.min(
                    9,
                    Math.max(1, Math.round(preference === "right" ? 1 / ratio : ratio))
                  );
                  return (
                    <div
                      key={`${left.key}-${right.key}`}
                      className="grid grid-cols-1 items-end gap-3 border-b border-zinc-100 pb-4 sm:grid-cols-12"
                    >
                      <p className="text-xs font-medium text-zinc-800 sm:col-span-5">
                        {left.name} <span className="text-zinc-400">dibanding</span>{" "}
                        {right.name}
                      </p>
                      <label className="sm:col-span-5">
                        <span className="mb-1 block text-[11px] text-zinc-600">
                          Kriteria yang lebih penting
                        </span>
                        <select
                          value={preference}
                          onChange={(event) =>
                            setPairwiseComparison(
                              leftIndex,
                              rightIndex,
                              event.target.value as "left" | "right" | "equal",
                              intensity
                            )
                          }
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                        >
                          <option value="left">{left.name}</option>
                          <option value="right">{right.name}</option>
                          <option value="equal">Sama penting</option>
                        </select>
                      </label>
                      <label className="sm:col-span-2">
                        <span className="mb-1 block text-[11px] text-zinc-600">
                          Intensitas
                        </span>
                        <select
                          value={intensity}
                          disabled={preference === "equal"}
                          onChange={(event) =>
                            setPairwiseComparison(
                              leftIndex,
                              rightIndex,
                              preference as "left" | "right" | "equal",
                              Number(event.target.value)
                            )
                          }
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs disabled:bg-zinc-100"
                        >
                          {Array.from({ length: 9 }, (_, number) => number + 1).map(
                            (number) => (
                              <option key={number} value={number}>
                                {number}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </div>
                  );
                })
              )}
            </div>
            <button
              type="button"
              onClick={() => void runCalculation()}
              disabled={isCalculating}
              className="mt-5 rounded-xl bg-[#1a5b3e] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#154932] disabled:opacity-50"
            >
              {isCalculating ? "Menghitung..." : "Hitung bobot"}
            </button>
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs lg:col-span-5">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Hasil pembobotan</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Bobot kriteria akan digunakan oleh TOPSIS.
            </p>
          </div>
          {calcResult ? (
            <>
              <div className="space-y-3">
                {calcResult.criteria.map((criterion) => (
                  <div key={criterion.key}>
                    <div className="mb-1 flex justify-between gap-3 text-xs">
                      <span className="font-medium text-zinc-700">{criterion.name}</span>
                      <span className="font-bold text-zinc-900">
                        {formatPercent(criterion.weight ?? 0)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-[#1a5b3e]"
                        style={{ width: `${(criterion.weight ?? 0) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div
                className={`rounded-xl border p-4 text-xs ${
                  calcResult.is_consistent
                    ? "border-[#d2e4d9] bg-[#edf4f0] text-[#1a5b3e]"
                    : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
              >
                <strong>
                  {calcResult.is_consistent ? "Konsisten" : "Tidak konsisten"} · CR{" "}
                  {calcResult.cr.toFixed(3).replace(".", ",")}
                </strong>
                <p className="mt-1 text-[11px]">
                  λmax {calcResult.lambda_max.toFixed(3)} · CI{" "}
                  {calcResult.ci.toFixed(3)} · RI {calcResult.ri}
                </p>
              </div>

              <button
                type="button"
                onClick={handleActivateWeight}
                disabled={!calcResult.is_consistent || isActivating}
                className="w-full rounded-xl bg-[#1a5b3e] py-2.5 text-xs font-semibold text-white hover:bg-[#154932] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isActivating ? "Mengaktifkan..." : "Simpan dan aktifkan"}
              </button>
            </>
          ) : (
            <p className="rounded-xl bg-zinc-50 p-4 text-xs text-zinc-500">
              {isCalculating ? "Menghitung bobot..." : "Hasil akan muncul setelah perhitungan."}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
