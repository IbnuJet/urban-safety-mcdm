import { SegmentItem } from "../components/PriorityMap";

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000/api/v1";

export async function getSegmentsData(
  corridor?: string,
  fallbackData: SegmentItem[] = []
): Promise<SegmentItem[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const query =
      corridor && corridor !== "Semua koridor"
        ? `?corridor=${encodeURIComponent(corridor)}`
        : "";

    const res = await fetch(`${BACKEND_API_URL}/segments${query}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any, idx: number) => {
          const coords = item.geojson_geometry?.coordinates || [];
          const latLngCoords = coords.map((c: [number, number]) => [c[1], c[0]]);
          const midIdx = Math.floor(latLngCoords.length / 2);
          const markerPos = latLngCoords[midIdx] || [-6.9332, 107.7745];

          return {
            id: item.id || idx + 1,
            rank: idx + 1,
            segmentCode: item.segment_code || `G-0${idx + 1}`,
            name: item.name,
            corridor: item.corridor,
            priority: (item.priority_category as any) || "Tinggi",
            color:
              item.priority_category === "Tinggi" ? "#1a5b3e"
                : item.priority_category === "Sedang" ? "#c97a26"
                : item.priority_category === "Rendah" ? "#4b5563" : "#b91c1c",
            badgeColor:
              item.priority_category === "Tinggi" ? "#1a5b3e"
                : item.priority_category === "Sedang" ? "#c97a26"
                : item.priority_category === "Rendah" ? "#4b5563" : "#b91c1c",
            score: item.preference_score || 1.0,
            brokenLights: item.observation?.broken_lights || 5,
            totalLights: item.observation?.total_lights || 8,
            crimeCount: item.observation?.dawn_crime_count || 3,
            boardingCount: item.observation?.boarding_house_count || 15,
            inspectionDate: item.observation?.inspection_date || "Terbaru",
            coordinates: latLngCoords,
            markerPos,
          };
        });
      }
    }
  } catch {}

  if (corridor && corridor !== "Semua koridor") {
    return fallbackData.filter((s) => s.corridor === corridor);
  }
  return fallbackData;
}
