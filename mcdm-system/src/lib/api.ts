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
  has_geometry?: boolean;
  last_inspection_date?: string | null;
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

// In-Memory Seed Segments (8 Segmen Sesuai Desain Figma)
export const DEFAULT_SEGMENTS: SegmentResponse[] = [
  {
    id: 1,
    segment_code: "G-01",
    name: "Gang Ciseke 01",
    corridor: "Ciseke",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.7702, -6.9312], [107.7725, -6.9304], [107.7745, -6.9298]],
    },
    is_active: true,
    updated_at: "2026-11-15T00:00:00Z",
    has_geometry: true,
    last_inspection_date: "8 Nov 2026",
    observation: {
      id: 1,
      segment_id: 1,
      total_lights: 8,
      broken_lights: 6,
      dawn_crime_count: 7,
      boarding_house_count: 26,
      inspection_date: "8 Nov 2026",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: "2026-11-15T00:00:00Z",
    },
  },
  {
    id: 2,
    segment_code: "G-02",
    name: "Gang Caringin 01",
    corridor: "Caringin",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.7668, -6.9336], [107.7686, -6.9342], [107.7705, -6.934]],
    },
    is_active: true,
    updated_at: "2026-11-15T00:00:00Z",
    has_geometry: true,
    last_inspection_date: "4 Nov 2026",
    observation: {
      id: 2,
      segment_id: 2,
      total_lights: 6,
      broken_lights: 4,
      dawn_crime_count: 4,
      boarding_house_count: 19,
      inspection_date: "4 Nov 2026",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: "2026-11-15T00:00:00Z",
    },
  },
  {
    id: 3,
    segment_code: "G-03",
    name: "Gang H. Nena 01",
    corridor: "Gang H Nena",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.7738, -6.936], [107.7758, -6.9366], [107.7775, -6.9368]],
    },
    is_active: true,
    updated_at: "2026-11-15T00:00:00Z",
    has_geometry: true,
    last_inspection_date: "6 Nov 2026",
    observation: {
      id: 3,
      segment_id: 3,
      total_lights: 9,
      broken_lights: 5,
      dawn_crime_count: 3,
      boarding_house_count: 15,
      inspection_date: "6 Nov 2026",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: "2026-11-15T00:00:00Z",
    },
  },
  {
    id: 4,
    segment_code: "G-06",
    name: "Gang Ciseke 02",
    corridor: "Ciseke",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.7702, -6.9372], [107.7719, -6.9376], [107.7738, -6.938]],
    },
    is_active: true,
    updated_at: "2026-11-15T00:00:00Z",
    has_geometry: true,
    last_inspection_date: "2 Nov 2026",
    observation: {
      id: 4,
      segment_id: 4,
      total_lights: 7,
      broken_lights: 3,
      dawn_crime_count: 2,
      boarding_house_count: 14,
      inspection_date: "2 Nov 2026",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: "2026-11-15T00:00:00Z",
    },
  },
  {
    id: 5,
    segment_code: "G-04",
    name: "Gang Hegarmanah 01",
    corridor: "Hegarmanah",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.7772, -6.9295], [107.7794, -6.9298], [107.7812, -6.9301]],
    },
    is_active: true,
    updated_at: "2026-11-15T00:00:00Z",
    has_geometry: true,
    last_inspection_date: "29 Okt 2026",
    observation: {
      id: 5,
      segment_id: 5,
      total_lights: 8,
      broken_lights: 2,
      dawn_crime_count: 1,
      boarding_house_count: 8,
      inspection_date: "29 Okt 2026",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: "2026-11-15T00:00:00Z",
    },
  },
  {
    id: 6,
    segment_code: "G-05",
    name: "Gang Sukawening 01",
    corridor: "Sukawening",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.7812, -6.9332], [107.7831, -6.9334], [107.7848, -6.9336]],
    },
    is_active: true,
    updated_at: "2026-11-15T00:00:00Z",
    has_geometry: true,
    last_inspection_date: "27 Okt 2026",
    observation: {
      id: 6,
      segment_id: 6,
      total_lights: 5,
      broken_lights: 1,
      dawn_crime_count: 0,
      boarding_house_count: 6,
      inspection_date: "27 Okt 2026",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: "2026-11-15T00:00:00Z",
    },
  },
  {
    id: 7,
    segment_code: "G-07",
    name: "Gang Caringin 02",
    corridor: "Caringin",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.768, -6.935], [107.7695, -6.9355], [107.771, -6.936]],
    },
    is_active: true,
    updated_at: "2026-11-15T00:00:00Z",
    has_geometry: true,
    last_inspection_date: "23 Okt 2026",
    observation: {
      id: 7,
      segment_id: 7,
      total_lights: 7,
      broken_lights: 3,
      dawn_crime_count: 2,
      boarding_house_count: 10,
      inspection_date: "23 Okt 2026",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: "2026-11-15T00:00:00Z",
    },
  },
  {
    id: 8,
    segment_code: "G-08",
    name: "Gang Sukawening 02",
    corridor: "Sukawening",
    geojson_geometry: {
      type: "LineString",
      coordinates: [[107.782, -6.934], [107.7838, -6.9345], [107.7855, -6.935]],
    },
    is_active: true,
    updated_at: "2026-11-15T00:00:00Z",
    has_geometry: true,
    last_inspection_date: "2 Agu 2026",
    observation: {
      id: 8,
      segment_id: 8,
      total_lights: 6,
      broken_lights: 2,
      dawn_crime_count: 1,
      boarding_house_count: 7,
      inspection_date: "2 Agu 2026",
      data_source: "MANUAL_FORM",
      updated_by: 1,
      updated_at: "2026-11-15T00:00:00Z",
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
// Priority Map Layer & Segments Data
// -------------------------------------------------------------
export interface MapSummaryMetrics {
  total_segments: number;
  total_broken_lights: number;
  eligible_count: number;
  ineligible_count: number;
  capacity_quota: number | null;
}

export interface PriorityMapLayerResponse {
  type: string;
  cycle_id: number | null;
  cycle_name: string | null;
  summary: MapSummaryMetrics;
  features: Array<{
    type: string;
    geometry: {
      type: string;
      coordinates: [number, number][];
    };
    properties: {
      segment_id: number;
      segment_code: string;
      name: string;
      corridor: CorridorType;
      rank: number | null;
      preference_score: number | null;
      priority_category: "Tinggi" | "Sedang" | "Rendah" | "Perlu validasi";
      total_lights: number | null;
      broken_lights: number | null;
      dawn_crime_count: number | null;
      boarding_house_count: number | null;
      inspection_date: string | null;
      is_eligible: boolean;
      ineligible_reason: string | null;
      is_tie_broken: boolean;
    };
  }>;
}

export async function fetchPriorityMapLayer(params?: {
  cycleId?: number;
  corridor?: string;
}): Promise<PriorityMapLayerResponse | null> {
  try {
    const url = new URL(`${BACKEND_API_URL}/map/priority-layer`);
    if (params?.cycleId) {
      url.searchParams.append("cycle_id", String(params.cycleId));
    }
    if (params?.corridor && params.corridor !== "Semua koridor") {
      url.searchParams.append("corridor", params.corridor);
    }

    const res = await fetch(url.toString(), {
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return null;
}

// -------------------------------------------------------------
// Compatibility Wrapper for PriorityMap & Main Page
// -------------------------------------------------------------
export async function getSegmentsData(
  corridor?: string,
  fallbackData: SegmentItem[] = []
): Promise<{ segments: SegmentItem[]; summary?: MapSummaryMetrics; cycleName?: string | null }> {
  try {
    // 1. Coba ambil dari /map/priority-layer terlebih dahulu
    const mapLayer = await fetchPriorityMapLayer({ corridor });
    if (mapLayer && mapLayer.features && mapLayer.features.length > 0) {
      const segments: SegmentItem[] = mapLayer.features.map((feat) => {
        const props = feat.properties;
        // GeoJSON standard: [lon, lat] -> Leaflet standard: [lat, lon]
        const rawCoords = feat.geometry?.coordinates || [];
        const latLngCoords: [number, number][] = rawCoords.map(
          (c: [number, number]) => [c[1], c[0]]
        );
        const midIdx = Math.floor(latLngCoords.length / 2);
        const markerPos = latLngCoords[midIdx] || [-6.9332, 107.7745];

        const priority =
          !props.is_eligible || props.priority_category === "Perlu validasi"
            ? "Perlu validasi"
            : (props.priority_category as "Tinggi" | "Sedang" | "Rendah") || "Rendah";

        const color =
          priority === "Tinggi"
            ? "#1a5b3e"
            : priority === "Sedang"
            ? "#c97a26"
            : priority === "Rendah"
            ? "#4b5563"
            : "#b91c1c";

        return {
          id: props.segment_id,
          rank: props.rank || 0,
          segmentCode: props.segment_code,
          name: props.name,
          corridor: props.corridor,
          priority,
          color,
          badgeColor: color,
          score: props.preference_score ?? 0,
          brokenLights: props.broken_lights ?? 0,
          totalLights: props.total_lights ?? 0,
          crimeCount: props.dawn_crime_count ?? 0,
          boardingCount: props.boarding_house_count ?? 0,
          inspectionDate: props.inspection_date || "-",
          coordinates: latLngCoords,
          markerPos,
        };
      });

      return {
        segments,
        summary: mapLayer.summary,
        cycleName: mapLayer.cycle_name,
      };
    }

    // 2. Fallback ke fetchSegments jika belum ada siklus kalkulasi
    const data = await fetchSegments({
      corridor: corridor && corridor !== "Semua koridor" ? corridor : undefined,
    });
    if (Array.isArray(data) && data.length > 0) {
      const segments: SegmentItem[] = data.map((item: any, idx: number) => {
        const coords = item.geojson_geometry?.coordinates || [];
        const latLngCoords: [number, number][] = coords.map((c: [number, number]) => [c[1], c[0]]);
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
          brokenLights: item.observation?.broken_lights ?? item.broken_lights ?? 0,
          totalLights: item.observation?.total_lights ?? item.total_lights ?? 0,
          crimeCount: item.observation?.dawn_crime_count ?? item.dawn_crime_count ?? 0,
          boardingCount: item.observation?.boarding_house_count ?? item.boarding_house_count ?? 0,
          inspectionDate: item.observation?.inspection_date || item.last_inspection_date || "-",
          coordinates: latLngCoords,
          markerPos,
        };
      });

      return { segments };
    }
  } catch {}

  const filteredFallback =
    corridor && corridor !== "Semua koridor"
      ? fallbackData.filter((s) => s.corridor === corridor)
      : fallbackData;
  return { segments: filteredFallback };
}
