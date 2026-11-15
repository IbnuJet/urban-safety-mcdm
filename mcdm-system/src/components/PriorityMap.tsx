"use client";
import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface SegmentItem {
  id: number;
  rank: number;
  segmentCode: string;
  name: string;
  corridor: string;
  priority: "Tinggi" | "Sedang" | "Rendah" | "Perlu validasi";
  color: string;
  badgeColor: string;
  score: number;
  brokenLights: number;
  totalLights: number;
  crimeCount: number;
  boardingCount: number;
  inspectionDate: string;
  coordinates: [number, number][];
  markerPos: [number, number];
}

interface PriorityMapProps {
  segments: SegmentItem[];
  selectedSegmentId: number;
  onSelectSegment: (id: number) => void;
  selectedCorridor: string;
}

export default function PriorityMap({
  segments,
  selectedSegmentId,
  onSelectSegment,
  selectedCorridor,
}: PriorityMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-6.9332, 107.7745],
        zoom: 15,
        zoomControl: false,
      });

      L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", { attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>', maxZoom: 20,}).addTo(map);
      L.control.zoom({ position: "bottomright", }).addTo(map);

      const layersGroup = L.featureGroup().addTo(map);
      layersGroupRef.current = layersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layersGroup = layersGroupRef.current;
    if (!map || !layersGroup) return;
    layersGroup.clearLayers();

    const filteredSegments = selectedCorridor === "Semua koridor" ? segments : segments.filter((s) => s.corridor === selectedCorridor);
    filteredSegments.forEach((seg) => {
      const isSelected = seg.id === selectedSegmentId;
      const polyline = L.polyline(seg.coordinates, {
        color: seg.color,
        weight: isSelected ? 8 : 5,
        opacity: isSelected ? 1 : 0.85,
        lineCap: "round",
        lineJoin: "round",
      });

      polyline.on("click", () => {
        onSelectSegment(seg.id);
      });

      polyline.on("mouseover", () => {
        polyline.setStyle({ weight: 8, opacity: 1 });
      });
      polyline.on("mouseout", () => {
        if (seg.id !== selectedSegmentId) {
          polyline.setStyle({ weight: 5, opacity: 0.85 });
        }
      });

      layersGroup.addLayer(polyline);
      if (seg.priority !== "Perlu validasi") {
        const badgeIcon = L.divIcon({
          className: "custom-map-marker",
          html: `
            <div style="
              background-color: ${seg.badgeColor};
              color: white;
              width: 22px;
              height: 22px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: 11px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.25);
              border: 2px solid white;
              cursor: pointer;
              transform: ${isSelected ? "scale(1.25)" : "scale(1)"};
              transition: transform 0.15s ease;
            ">
              ${seg.rank}
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker(seg.markerPos, { icon: badgeIcon });
        marker.on("click", () => {
          onSelectSegment(seg.id);
        });
        layersGroup.addLayer(marker);
      }
    });

    const activeSeg = segments.find((s) => s.id === selectedSegmentId);
    if (activeSeg) {
      map.flyTo(activeSeg.markerPos, 16, {
        duration: 0.6,
        easeLinearity: 0.25,
      });
    } else if (selectedCorridor === "Semua koridor") {
      map.flyTo([-6.9332, 107.7745], 15, { duration: 0.6 });
    }
  }, [segments, selectedSegmentId, selectedCorridor, onSelectSegment]);

  return (
    <div className="relative w-full h-[410px] rounded-xl overflow-hidden border border-zinc-200/80 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-xs px-2 py-1 rounded-md border border-zinc-200/80 shadow-xs flex flex-col items-center pointer-events-none select-none">
        <span className="text-[10px] font-bold text-zinc-700 leading-none">U</span>
        <svg className="w-3 h-3 text-zinc-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </div>

      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-zinc-200/90 shadow-sm flex items-center gap-4 text-[11px] text-zinc-600 select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-1 rounded-full bg-[#1a5b3e]" />
          <span>Tinggi</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-1 rounded-full bg-[#c97a26]" />
          <span>Sedang</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-1 rounded-full bg-[#4b5563]" />
          <span>Rendah</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-1 rounded-full bg-[#b91c1c]" />
          <span>Perlu validasi</span>
        </div>
      </div>
    </div>
  );
}