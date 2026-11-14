"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { SegmentItem } from "@/src/components/PriorityMap";

const PriorityMap = dynamic(() => import("@/src/components/PriorityMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[410px] rounded-xl bg-zinc-100 flex items-center justify-center border border-zinc-200">
      <div className="flex items-center gap-2 text-zinc-500 text-sm">
        <svg className="animate-spin h-5 w-5 text-[#1a5b3e]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <span>Memuat peta interaktif Leaflet Jatinangor...</span>
      </div>
    </div>
  ),
});

const INITIAL_SEGMENTS: SegmentItem[] = [
  {
    id: 1, rank: 1, segmentCode: "G-01",
    name: "Gang Ciseke 01", corridor: "Ciseke", priority: "Tinggi",
    color: "#1a5b3e", badgeColor: "#1a5b3e", score: 1.0,
    brokenLights: 6, totalLights: 8, crimeCount: 7, boardingCount: 26,
    inspectionDate: "8 Nov 2026",
    coordinates: [
      [-6.9312, 107.7702],
      [-6.9304, 107.7725],
      [-6.9298, 107.7745],
    ],
    markerPos: [-6.9304, 107.7725],
  },
  {
    id: 2, rank: 2, segmentCode: "G-02",
    name: "Gang Caringin 01", corridor: "Caringin", priority: "Tinggi",
    color: "#1a5b3e", badgeColor: "#1a5b3e", score: 0.782,
    brokenLights: 4, totalLights: 6, crimeCount: 4, boardingCount: 19,
    inspectionDate: "7 Nov 2026",
    coordinates: [
      [-6.9336, 107.7668],
      [-6.9342, 107.7686],
      [-6.934, 107.7705],
    ],
    markerPos: [-6.9342, 107.7686],
  },
  {
    id: 3, rank: 3, segmentCode: "G-03",
    name: "Gang H. Nena 01", corridor: "Gang H Nena", priority: "Sedang",
    color: "#c97a26", badgeColor: "#c97a26", score: 0.716,
    brokenLights: 5, totalLights: 9, crimeCount: 3, boardingCount: 15,
    inspectionDate: "6 Nov 2026",
    coordinates: [
      [-6.936, 107.7738],
      [-6.9366, 107.7758],
      [-6.9368, 107.7775],
    ],
    markerPos: [-6.9366, 107.7758],
  },
  {
    id: 4, rank: 4, segmentCode: "G-04",
    name: "Gang Ciseke Lama", corridor: "Ciseke", priority: "Sedang",
    color: "#c97a26", badgeColor: "#c97a26", score: 0.64,
    brokenLights: 3, totalLights: 7, crimeCount: 2, boardingCount: 14,
    inspectionDate: "6 Nov 2026",
    coordinates: [
      [-6.9372, 107.7702],
      [-6.9376, 107.7719],
      [-6.938, 107.7738],
    ],
    markerPos: [-6.9376, 107.7719],
  },
  {
    id: 5, rank: 5, segmentCode: "G-05",
    name: "Gang Hegarmanah 01", corridor: "Hegarmanah", priority: "Rendah",
    color: "#4b5563", badgeColor: "#4b5563", score: 0.312,
    brokenLights: 2, totalLights: 8, crimeCount: 1, boardingCount: 8,
    inspectionDate: "5 Nov 2026",
    coordinates: [
      [-6.9295, 107.7772],
      [-6.9298, 107.7794],
      [-6.9301, 107.7812],
    ],
    markerPos: [-6.9298, 107.7794],
  },
  {
    id: 6, rank: 6, segmentCode: "G-06",
    name: "Gang Sukawening 01", corridor: "Sukawening", priority: "Rendah",
    color: "#4b5563", badgeColor: "#4b5563", score: 0.285,
    brokenLights: 1, totalLights: 5, crimeCount: 0, boardingCount: 6,
    inspectionDate: "4 Nov 2026",
    coordinates: [
      [-6.9332, 107.7812],
      [-6.9334, 107.7831],
      [-6.9336, 107.7848],
    ],
    markerPos: [-6.9334, 107.7831],
  },
  {
    id: 7, rank: 0, segmentCode: "G-07",
    name: "Gang Cikuda Timur", corridor: "Hegarmanah", priority: "Perlu validasi",
    color: "#b91c1c", badgeColor: "#b91c1c", score: 0.0,
    brokenLights: 2, totalLights: 4, crimeCount: 0, boardingCount: 3,
    inspectionDate: "Kadaluwarsa (>90 hari)",
    coordinates: [
      [-6.9274, 107.7825],
      [-6.9279, 107.7842],
      [-6.9284, 107.786],
    ],
    markerPos: [-6.9279, 107.7842],
  },
];

export default function HomePage() {
  const [selectedSegmentId, setSelectedSegmentId] = useState<number>(1);
  const [selectedCorridor, setSelectedCorridor] = useState<string>("Semua koridor");

  function handleCorridorChange(corridor: string) {
    setSelectedCorridor(corridor);

    if (corridor === "Semua koridor") {
      setSelectedSegmentId(INITIAL_SEGMENTS[0].id);
    } else {
      const matched = INITIAL_SEGMENTS.find(
        (s) => s.corridor.toLowerCase() === corridor.toLowerCase()
      );
      if (matched) {
        setSelectedSegmentId(matched.id);
      }
    }
  }

  const selectedSegment =
    INITIAL_SEGMENTS.find((s) => s.id === selectedSegmentId) ||
    INITIAL_SEGMENTS[0];

  const corridorOptions = [ "Semua koridor", "Ciseke", "Caringin", "Gang H Nena", "Hegarmanah", "Sukawening",];

  return (
    <div className="p-8 bg-[#F7F8F5]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">Prioritas perbaikan PJU </h1>
          <p className="text-xs text-zinc-500 mt-1">Jatinangor, Sumedang &middot; Siklus November 2026</p>
        </div>
        <button type="button" className="px-4 py-2 bg-[#1a5b3e] hover:bg-[#164d34] text-white text-[13px] font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs">
          <span>Lihat pemeringkatan</span>
          <span className="text-sm font-semibold">&rarr;</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200/80 p-5 mb-6 shadow-xs grid grid-cols-4 divide-x divide-zinc-100">
        <div className="px-4 first:pl-2">
          <p className="text-[12px] text-zinc-400 mb-1">Segmen terdata</p>
          <p className="text-2xl font-bold text-zinc-900">8</p>
        </div>
        <div className="px-6">
          <p className="text-[12px] text-zinc-400 mb-1">Lampu mati</p>
          <p className="text-2xl font-bold text-zinc-900">23</p>
        </div>
        <div className="px-6">
          <p className="text-[12px] text-zinc-400 mb-1">Segmen layak</p>
          <p className="text-2xl font-bold text-zinc-900">6</p>
        </div>
        <div className="px-6">
          <p className="text-[12px] text-zinc-400 mb-1">Kapasitas perbaikan</p>
          <p className="text-2xl font-bold text-zinc-900">3</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-8 bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="text-[15px] font-bold text-zinc-900">Peta segmen</h3>
              <p className="text-[11px] text-zinc-400">Peta skematis &middot; posisi ilustratif</p>
            </div>

            <div className="relative">
              <select value={selectedCorridor} onChange={(e) => handleCorridorChange(e.target.value)} className="appearance-none bg-white border border-zinc-200 text-zinc-700 text-xs px-3 py-1.5 pr-8 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] cursor-pointer">
                {corridorOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <div className="absolute right-2.5 top-2 pointer-events-none text-zinc-400 text-xs">&or;</div>
            </div>
          </div>

          <PriorityMap segments={INITIAL_SEGMENTS} selectedSegmentId={selectedSegmentId} onSelectSegment={setSelectedSegmentId} selectedCorridor={selectedCorridor}/>
        </div>

        <div className="col-span-4 bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 font-medium">Detail segmen</span>
              {selectedSegment.rank > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-[#edf4f0] text-[#1a5b3e] text-[11px] font-semibold">Peringkat {selectedSegment.rank}</span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[11px] font-semibold border border-red-200">Perlu Validasi</span>
              )}
            </div>

            <h2 className="text-xl font-bold text-zinc-900 mt-2">{selectedSegment.name}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Koridor {selectedSegment.corridor} &middot;{" "}{selectedSegment.segmentCode}</p>
            <div className={`rounded-xl p-4 my-4 flex items-center justify-between ${ selectedSegment.priority === "Perlu validasi" ? "bg-red-50/70 border border-red-100" : "bg-[#edf4f0]/70" }`}>
              <span className="text-xs font-medium text-zinc-700">Skor TOPSIS</span>
              <span className={`text-3xl font-extrabold ${ selectedSegment.priority === "Perlu validasi" ? "text-red-600" : "text-[#1a5b3e]" }`}>
                {selectedSegment.score > 0 ? selectedSegment.score.toLocaleString("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3, }) : "-"}
              </span>
            </div>

            <div className="space-y-3 text-xs divide-y divide-zinc-100">
              <div className="flex items-center justify-between pt-1">
                <span className="text-zinc-500">Lampu mati</span>
                <span className="font-semibold text-zinc-800">{selectedSegment.brokenLights} dari{" "}{selectedSegment.totalLights} lampu</span>
              </div>
              <div className="flex items-center justify-between pt-3">
                <span className="text-zinc-500">Curanmor &middot; 00.00&ndash;05.00 WIB</span>
                <span className="font-semibold text-zinc-800">{selectedSegment.crimeCount} kasus</span>
              </div>
              <div className="flex items-center justify-between pt-3">
                <span className="text-zinc-500">Indekos dilayani</span>
                <span className="font-semibold text-zinc-800">{selectedSegment.boardingCount} unit</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 mt-6">
            <p className="text-[11px] text-zinc-400 mb-3">Sumber &middot; Rekap simulasi <br />Inspeksi &middot;{" "}
              <span className={ selectedSegment.inspectionDate.includes("Kadaluwarsa") ? "text-red-500 font-medium" : "" }>{selectedSegment.inspectionDate}</span>
            </p>

            <button type="button" className="w-full py-2.5 px-3 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5">
              <span>Lihat data inspeksi</span>
              <span className="text-sm font-semibold">&rarr;</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-zinc-900">Segmen teratas</h3>
          <button type="button" className="text-xs text-zinc-400 hover:text-zinc-700 font-medium flex items-center gap-1 cursor-pointer">
            <span>Semua hasil</span>
            <span>&rarr;</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-medium">
                <th className="py-2.5 px-3 w-16">Peringkat</th>
                <th className="py-2.5 px-3">Segmen</th>
                <th className="py-2.5 px-3">Koridor</th>
                <th className="py-2.5 px-3">Skor TOPSIS</th>
                <th className="py-2.5 px-3">Lampu mati</th>
                <th className="py-2.5 px-3 text-right">Kelayakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {INITIAL_SEGMENTS.filter((s) => s.rank > 0).map((seg) => {
                const isSelected = seg.id === selectedSegmentId;
                return (
                  <tr key={seg.id} onClick={() => setSelectedSegmentId(seg.id)} className={`hover:bg-zinc-50/80 transition-colors cursor-pointer ${ isSelected ? "bg-[#edf4f0]/50" : "" }`}>
                    <td className="py-3 px-3 font-semibold text-zinc-500">{seg.rank}</td>
                    <td className="py-3 px-3 font-semibold text-zinc-900">{seg.name}</td>
                    <td className="py-3 px-3 text-zinc-500">{seg.corridor}</td>
                    <td className="py-3 px-3 font-medium">
                      {seg.score.toLocaleString("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3, })}
                    </td>
                    <td className="py-3 px-3 text-zinc-600">{seg.brokenLights}/{seg.totalLights}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#edf4f0] text-[#1a5b3e] font-semibold text-[11px]">Layak</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}