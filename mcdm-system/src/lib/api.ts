import { SegmentItem } from "../components/PriorityMap";

export const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000/api/v1";

export type CorridorType =
  | "Ciseke"
  | "Caringin"
  | "Gang H Nena"
  | "Hegarmanah"
  | "Sukawening";

export const VALID_CORRIDORS: CorridorType[] = [
  "Ciseke",
  "Caringin",
  "Gang H Nena",
  "Hegarmanah",
  "Sukawening",
];

// -------------------------------------------------------------
// Auth Token Helper
// -------------------------------------------------------------
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("auth_token="));
    if (match) return decodeURIComponent(match.split("=")[1]);

    const sessionMatch = document.cookie
      .split("; ")
      .find((row) => row.startsWith("auth_session="));
    if (sessionMatch) {
      const session = JSON.parse(decodeURIComponent(sessionMatch.split("=")[1]));
      return session.accessToken || null;
    }
  } catch {}
  return null;
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// -------------------------------------------------------------
// 1. DATA SEGMEN GANG (Alley Segments)
// -------------------------------------------------------------
export interface GeoJSONGeometry {
  type: "LineString" | "Polygon";
  coordinates: any[];
}

export interface SegmentObservationBrief {
  id: number;
  segment_id: number;
  total_lights: number;
  broken_lights: number;
  dawn_crime_count: number | null;
  boarding_house_count: number;
  inspection_date: string;
  data_source: "MANUAL_FORM" | "CSV_IMPORT";
  updated_by: number;
  updated_at: string;
}

export interface SegmentResponse {
  id: number;
  segment_code: string;
  name: string;
  corridor: CorridorType;
  geojson_geometry: GeoJSONGeometry;
  is_active: boolean;
  updated_at: string;
  observation?: SegmentObservationBrief | null;
}

export interface SegmentCreateRequest {
  segment_code: string;
  name: string;
  corridor: CorridorType;
  geojson_geometry: GeoJSONGeometry;
  is_active?: boolean;
}

export interface SegmentUpdateRequest {
  name?: string | null;
  corridor?: CorridorType | null;
  geojson_geometry?: GeoJSONGeometry | null;
  is_active?: boolean | null;
}

// In-Memory Seed Segments (Fallback jika Backend belum aktif)
export const DEFAULT_SEGMENTS: SegmentResponse[] = [
  {
    id: 1,
    segment_code: "GG-CSK-001",
    name: "Gang Ciseke Lama Utara",
    corridor: "Ciseke",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.7691, -6.9324], [107.7702, -6.9331], [107.771, -6.9336]],
    },
    is_active: true,
    updated_at: new Date().toISOString(),
    observation: {
      id: 1,
      segment_id: 1,
      total_lights: 12,
      broken_lights: 7,
      dawn_crime_count: 5,
      boarding_house_count: 18,
      inspection_date: "2026-11-10",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: new Date().toISOString(),
    },
  },
  {
    id: 2,
    segment_code: "GG-CSK-002",
    name: "Gang Ciseke Baru Selatan",
    corridor: "Ciseke",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.7698, -6.934], [107.7709, -6.9348], [107.7718, -6.9352]],
    },
    is_active: true,
    updated_at: new Date().toISOString(),
    observation: {
      id: 2,
      segment_id: 2,
      total_lights: 10,
      broken_lights: 4,
      dawn_crime_count: 3,
      boarding_house_count: 14,
      inspection_date: "2026-11-09",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: new Date().toISOString(),
    },
  },
  {
    id: 3,
    segment_code: "GG-CRG-001",
    name: "Gang Caringin Masjid Al-Falah",
    corridor: "Caringin",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.772, -6.9345], [107.7731, -6.9354], [107.774, -6.9361]],
    },
    is_active: true,
    updated_at: new Date().toISOString(),
    observation: {
      id: 3,
      segment_id: 3,
      total_lights: 14,
      broken_lights: 8,
      dawn_crime_count: 6,
      boarding_house_count: 16,
      inspection_date: "2026-11-08",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: new Date().toISOString(),
    },
  },
  {
    id: 4,
    segment_code: "GG-GHN-001",
    name: "Gang H. Nena Utama",
    corridor: "Gang H Nena",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.7735, -6.9362], [107.7748, -6.937], [107.7758, -6.9376]],
    },
    is_active: true,
    updated_at: new Date().toISOString(),
    observation: {
      id: 4,
      segment_id: 4,
      total_lights: 11,
      broken_lights: 5,
      dawn_crime_count: 4,
      boarding_house_count: 15,
      inspection_date: "2026-11-07",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: new Date().toISOString(),
    },
  },
  {
    id: 5,
    segment_code: "GG-HGM-001",
    name: "Gang Hegarmanah Atas",
    corridor: "Hegarmanah",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.775, -6.931], [107.7762, -6.9318], [107.7772, -6.9325]],
    },
    is_active: true,
    updated_at: new Date().toISOString(),
    observation: {
      id: 5,
      segment_id: 5,
      total_lights: 8,
      broken_lights: 2,
      dawn_crime_count: 1,
      boarding_house_count: 11,
      inspection_date: "2026-11-05",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: new Date().toISOString(),
    },
  },
  {
    id: 6,
    segment_code: "GG-SKW-001",
    name: "Gang Sukawening Barat",
    corridor: "Sukawening",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.7725, -6.938], [107.7738, -6.9388], [107.7749, -6.9395]],
    },
    is_active: true,
    updated_at: new Date().toISOString(),
    observation: {
      id: 6,
      segment_id: 6,
      total_lights: 7,
      broken_lights: 2,
      dawn_crime_count: 1,
      boarding_house_count: 8,
      inspection_date: "2026-11-04",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: new Date().toISOString(),
    },
  },
];

export async function fetchSegments(params?: {
  corridor?: string;
  is_active?: boolean;
  q?: string;
}): Promise<SegmentResponse[]> {
  try {
    const url = new URL(`${BACKEND_API_URL}/segments`);
    if (params?.corridor && params.corridor !== "Semua") {
      url.searchParams.append("corridor", params.corridor);
    }
    if (params?.is_active !== undefined) {
      url.searchParams.append("is_active", String(params.is_active));
    }
    if (params?.q) {
      url.searchParams.append("q", params.q);
    }

    const res = await fetch(url.toString(), {
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {}

  // Fallback filtering
  let result = [...DEFAULT_SEGMENTS];
  if (params?.corridor && params.corridor !== "Semua") {
    result = result.filter((s) => s.corridor === params.corridor);
  }
  if (params?.is_active !== undefined) {
    result = result.filter((s) => s.is_active === params.is_active);
  }
  if (params?.q) {
    const query = params.q.toLowerCase();
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.segment_code.toLowerCase().includes(query)
    );
  }
  return result;
}

export async function createSegment(
  payload: SegmentCreateRequest
): Promise<SegmentResponse> {
  const res = await fetch(`${BACKEND_API_URL}/segments`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Gagal menambahkan segmen gang.");
  }
  return await res.json();
}

export async function updateSegment(
  segmentId: number,
  payload: SegmentUpdateRequest
): Promise<SegmentResponse> {
  const res = await fetch(`${BACKEND_API_URL}/segments/${segmentId}`, {
    method: "PUT",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Gagal memperbarui segmen gang.");
  }
  return await res.json();
}

// -------------------------------------------------------------
// 2. PENDATAAN & CSV IMPORT
// -------------------------------------------------------------
export interface ObservationFormRequest {
  segment_id?: number | null;
  segment_code?: string | null;
  total_lights: number;
  broken_lights: number;
  dawn_crime_count?: number | null;
  boarding_house_count: number;
  inspection_date: string;
}

export interface ObservationFormResponse {
  observation: SegmentObservationBrief;
  warnings?: string[];
}

export interface CSVValidationIssue {
  code: string;
  severity: "WARNING" | "ERROR";
  message: string;
}

export interface CSVValidatedRow {
  row_number: number;
  segment_code: string;
  total_lights: number | null;
  broken_lights: number | null;
  dawn_crime_count: number | null;
  boarding_house_count: number | null;
  inspection_date: string | null;
  status: "VALID" | "WARNING" | "ERROR";
  issues?: CSVValidationIssue[];
  messages?: string[];
}

export interface CSVUploadPreviewResponse {
  batch_id: string;
  filename: string;
  status: "PENDING_CONFIRMATION" | "CONFIRMED" | "CANCELLED";
  total_rows: number;
  valid_rows: number;
  warning_rows: number;
  error_rows: number;
  rows: CSVValidatedRow[];
  created_at: string;
}

export interface CSVRowCorrection {
  row_number: number;
  segment_code: string;
  total_lights: number;
  broken_lights: number;
  dawn_crime_count?: number | null;
  boarding_house_count: number;
  inspection_date: string;
}

export interface CSVConfirmRequest {
  include_warnings?: boolean;
  corrections?: CSVRowCorrection[];
}

export interface CSVConfirmResponse {
  batch_id: string;
  status: "PENDING_CONFIRMATION" | "CONFIRMED" | "CANCELLED";
  committed_count: number;
  skipped_error_count: number;
  committed_segment_codes: string[];
}

export async function submitObservationForm(
  payload: ObservationFormRequest
): Promise<ObservationFormResponse> {
  const res = await fetch(`${BACKEND_API_URL}/observations/form`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Gagal menyimpan formulir observasi.");
  }
  return await res.json();
}

export async function uploadCSVObservation(
  file: File
): Promise<CSVUploadPreviewResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BACKEND_API_URL}/observations/upload-csv`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Gagal mengunggah berkas CSV.");
  }
  return await res.json();
}

export async function confirmCSVBatch(
  batchId: string,
  payload: CSVConfirmRequest = { include_warnings: true }
): Promise<CSVConfirmResponse> {
  const res = await fetch(
    `${BACKEND_API_URL}/observations/batches/${batchId}/confirm`,
    {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Gagal mengonfirmasi batch CSV.");
  }
  return await res.json();
}

// -------------------------------------------------------------
// 3. PEMBOBOTAN AHP & KONSISTENSI
// -------------------------------------------------------------
export interface AHPCalculateRequest {
  pairwise_matrix: number[][];
}

export interface AHPCalculateResponse {
  pairwise_matrix: number[][];
  w_light_damage: number;
  w_dawn_crime: number;
  w_boarding_density: number;
  lambda_max: number;
  ci: number;
  ri: number;
  cr: number;
  is_consistent: boolean;
}

export interface AHPVersionCreateRequest {
  pairwise_matrix: number[][];
  version_name: string;
  activate_immediately?: boolean;
}

export interface AHPVersionResponse {
  id: number;
  version_name: string;
  created_by: number;
  pairwise_matrix: number[][];
  w_light_damage: number;
  w_dawn_crime: number;
  w_boarding_density: number;
  lambda_max: number;
  ci: number;
  ri: number;
  cr: number;
  is_consistent: boolean;
  is_active: boolean;
  created_at: string;
}

export async function calculateAHPPreview(
  pairwise_matrix: number[][]
): Promise<AHPCalculateResponse> {
  try {
    const res = await fetch(`${BACKEND_API_URL}/ahp/calculate-preview`, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ pairwise_matrix }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  // Fallback perhitungan AHP lokal (NumPy simulation)
  const [a12, a13] = [pairwise_matrix[0][1], pairwise_matrix[0][2]];
  const a23 = pairwise_matrix[1][2];
  const m = [
    [1.0, a12, a13],
    [1.0 / a12, 1.0, a23],
    [1.0 / a13, 1.0 / a23, 1.0],
  ];
  const colSums = [0, 1, 2].map(
    (c) => m[0][c] + m[1][c] + m[2][c]
  );
  const normM = m.map((row) => row.map((val, c) => val / colSums[c]));
  const w = normM.map(
    (row) => row.reduce((acc, v) => acc + v, 0) / 3
  );

  const Aw = [0, 1, 2].map(
    (r) => m[r][0] * w[0] + m[r][1] * w[1] + m[r][2] * w[2]
  );
  const lambda_max =
    (Aw[0] / w[0] + Aw[1] / w[1] + Aw[2] / w[2]) / 3;
  const ci = (lambda_max - 3) / (3 - 1);
  const ri = 0.58; // RI untuk n=3
  const cr = ci / ri;
  const is_consistent = cr <= 0.1;

  return {
    pairwise_matrix: m,
    w_light_damage: Number(w[0].toFixed(4)),
    w_dawn_crime: Number(w[1].toFixed(4)),
    w_boarding_density: Number(w[2].toFixed(4)),
    lambda_max: Number(lambda_max.toFixed(4)),
    ci: Number(ci.toFixed(4)),
    ri,
    cr: Number(cr.toFixed(4)),
    is_consistent,
  };
}

export async function fetchAHPVersions(): Promise<AHPVersionResponse[]> {
  try {
    const res = await fetch(`${BACKEND_API_URL}/ahp/versions`, {
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  // Fallback mock AHP versions
  return [
    {
      id: 1,
      version_name: "Bobot Standar Pakar DSS 2026",
      created_by: 3,
      pairwise_matrix: [
        [1.0, 2.0, 4.0],
        [0.5, 1.0, 3.0],
        [0.25, 0.3333, 1.0],
      ],
      w_light_damage: 0.5571,
      w_dawn_crime: 0.3202,
      w_boarding_density: 0.1226,
      lambda_max: 3.0183,
      ci: 0.0091,
      ri: 0.58,
      cr: 0.0157,
      is_consistent: true,
      is_active: true,
      created_at: "2026-11-13T18:30:00Z",
    },
    {
      id: 2,
      version_name: "Prioritas Mitigasi Kriminalitas Khusus",
      created_by: 3,
      pairwise_matrix: [
        [1.0, 0.5, 3.0],
        [2.0, 1.0, 4.0],
        [0.3333, 0.25, 1.0],
      ],
      w_light_damage: 0.3196,
      w_dawn_crime: 0.5584,
      w_boarding_density: 0.122,
      lambda_max: 3.0175,
      ci: 0.0088,
      ri: 0.58,
      cr: 0.0151,
      is_consistent: true,
      is_active: false,
      created_at: "2026-11-10T10:00:00Z",
    },
  ];
}

export async function createAHPVersion(
  payload: AHPVersionCreateRequest
): Promise<AHPVersionResponse> {
  const res = await fetch(`${BACKEND_API_URL}/ahp/versions`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Gagal menyimpan versi bobot AHP.");
  }
  return await res.json();
}

export async function activateAHPVersion(
  versionId: number
): Promise<AHPVersionResponse> {
  const res = await fetch(`${BACKEND_API_URL}/ahp/versions/${versionId}/activate`, {
    method: "PATCH",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.detail ||
        "Gagal mengaktifkan versi bobot AHP (Pastikan CR <= 0.10)."
    );
  }
  return await res.json();
}

// -------------------------------------------------------------
// 4. PEMERINGKATAN TOPSIS
// -------------------------------------------------------------
export interface CycleRankingItemResponse {
  id: number;
  segment_id: number;
  segment_code: string;
  segment_name: string;
  corridor: CorridorType;
  is_eligible: boolean;
  ineligible_reason: string | null;
  snapshot_data: {
    total_lights?: number;
    broken_lights?: number;
    dawn_crime_count?: number;
    boarding_house_count?: number;
    inspection_date?: string;
  };
  norm_c1: number | null;
  norm_c2: number | null;
  norm_c3: number | null;
  weighted_c1: number | null;
  weighted_c2: number | null;
  weighted_c3: number | null;
  d_plus: number | null;
  d_minus: number | null;
  preference_score: number | null;
  rank: number | null;
  priority_category: "Tinggi" | "Sedang" | "Rendah" | "Tidak Layak";
  is_tie_broken: boolean;
}

export interface TOPSISCycleDetailResponse {
  cycle_id: number;
  cycle_name: string;
  executed_by: number;
  ahp_version_id: number;
  weights_snapshot: {
    w_light_damage?: number;
    w_dawn_crime?: number;
    w_boarding_density?: number;
    version_name?: string;
  };
  status: "RANKED" | "WORKLIST_FINALIZED";
  created_at: string;
  eligible_count: number;
  ineligible_count: number;
  eligible_results: CycleRankingItemResponse[];
  ineligible_results: CycleRankingItemResponse[];
}

export interface TOPSISCycleCreateRequest {
  cycle_name: string;
  criteria_directions?: string[];
}

export async function runTOPSISCycle(
  payload: TOPSISCycleCreateRequest
): Promise<TOPSISCycleDetailResponse> {
  const res = await fetch(`${BACKEND_API_URL}/topsis/cycles`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Gagal menjalankan siklus pemeringkatan TOPSIS.");
  }
  return await res.json();
}

export async function getTOPSISCycleDetail(
  cycleId: number
): Promise<TOPSISCycleDetailResponse> {
  const res = await fetch(`${BACKEND_API_URL}/topsis/cycles/${cycleId}`, {
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Gagal mengambil detail siklus TOPSIS.");
  }
  return await res.json();
}

// -------------------------------------------------------------
// Compatibility Wrapper for PriorityMap & Main Page
// -------------------------------------------------------------
export async function getSegmentsData(
  corridor?: string,
  fallbackData: SegmentItem[] = []
): Promise<SegmentItem[]> {
  try {
    const data = await fetchSegments({
      corridor: corridor && corridor !== "Semua koridor" ? corridor : undefined,
    });
    if (Array.isArray(data) && data.length > 0) {
      return data.map((item: any, idx: number) => {
        const coords = item.geojson_geometry?.coordinates || [];
        const latLngCoords = coords.map((c: [number, number]) => [c[1], c[0]]);
        const midIdx = Math.floor(latLngCoords.length / 2);
        const markerPos = latLngCoords[midIdx] || [-6.9332, 107.7745];

        const priority = (item.priority_category as any) || "Tinggi";
        return {
          id: item.id || idx + 1,
          rank: idx + 1,
          segmentCode: item.segment_code || `G-0${idx + 1}`,
          name: item.name,
          corridor: item.corridor,
          priority,
          color:
            priority === "Tinggi"
              ? "#1a5b3e"
              : priority === "Sedang"
              ? "#c97a26"
              : priority === "Rendah"
              ? "#4b5563"
              : "#b91c1c",
          badgeColor:
            priority === "Tinggi"
              ? "#1a5b3e"
              : priority === "Sedang"
              ? "#c97a26"
              : priority === "Rendah"
              ? "#4b5563"
              : "#b91c1c",
          score: item.preference_score || 0.85 - idx * 0.08,
          brokenLights: item.observation?.broken_lights || 5,
          totalLights: item.observation?.total_lights || 8,
          crimeCount: item.observation?.dawn_crime_count || 3,
          boardingCount: item.observation?.boarding_house_count || 15,
          inspectionDate: item.observation?.inspection_date || "10 Nov 2026",
          coordinates: latLngCoords,
          markerPos,
        };
      });
    }
  } catch {}

  if (corridor && corridor !== "Semua koridor") {
    return fallbackData.filter((s) => s.corridor === corridor);
  }
  return fallbackData;
}
