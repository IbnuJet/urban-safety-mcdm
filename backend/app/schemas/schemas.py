"""Pydantic v2 schemas for all 8 DSS functional modules."""

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.models import (
    BatchStatus,
    CorridorEnum,
    CycleStatus,
    DataSourceEnum,
    UserRole,
)


def _validate_position(pos: Any) -> None:
    if not isinstance(pos, (list, tuple)) or len(pos) < 2:
        raise ValueError("Setiap titik koordinat GeoJSON harus berupa array [longitude, latitude].")
    lon, lat = pos[0], pos[1]
    if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
        raise ValueError("Koordinat longitude dan latitude harus berupa angka.")
    if not (-180.0 <= float(lon) <= 180.0) or not (-90.0 <= float(lat) <= 90.0):
        raise ValueError("Koordinat berada di luar rentang valid bumi (lon: [-180,180], lat: [-90,90]).")


class GeoJSONGeometry(BaseModel):
    """GeoJSON geometry supporting LineString and Polygon."""

    type: Literal["LineString", "Polygon"]
    coordinates: list[Any]

    @model_validator(mode="after")
    def validate_coordinates(self) -> "GeoJSONGeometry":
        if self.type == "LineString":
            if len(self.coordinates) < 2:
                raise ValueError("Geometri LineString wajib memiliki minimal 2 titik koordinat.")
            for pt in self.coordinates:
                _validate_position(pt)
        elif self.type == "Polygon":
            if len(self.coordinates) < 1:
                raise ValueError("Geometri Polygon wajib memiliki minimal 1 ring koordinat.")
            for ring in self.coordinates:
                if not isinstance(ring, list) or len(ring) < 4:
                    raise ValueError("Setiap ring Polygon wajib memiliki minimal 4 titik koordinat.")
                for pt in ring:
                    _validate_position(pt)
                if ring[0][:2] != ring[-1][:2]:
                    raise ValueError("Ring Polygon wajib tertutup (titik awal sama dengan titik akhir).")
        return self


# ---------------------------------------------------------------------------
# Modul 1: Auth & Users
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150)
    password: str = Field(..., min_length=6, max_length=128)
    role: UserRole
    is_active: bool = True


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    role: UserRole | None = None
    is_active: bool | None = None


# ---------------------------------------------------------------------------
# Modul 2: Alley Segments
# ---------------------------------------------------------------------------


class ObservationBriefResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    segment_id: int
    total_lights: int
    broken_lights: int
    dawn_crime_count: int | None
    boarding_house_count: int
    inspection_date: date
    data_source: DataSourceEnum
    updated_by: int
    updated_at: datetime


class SegmentCreateRequest(BaseModel):
    segment_code: str = Field(..., min_length=3, max_length=50)
    name: str = Field(..., min_length=3, max_length=200)
    corridor: CorridorEnum
    geojson_geometry: GeoJSONGeometry
    is_active: bool = True

    @field_validator("segment_code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().upper()


class SegmentUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=200)
    corridor: CorridorEnum | None = None
    geojson_geometry: GeoJSONGeometry | None = None
    is_active: bool | None = None


class SegmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    segment_code: str
    name: str
    corridor: CorridorEnum
    geojson_geometry: dict[str, Any]
    is_active: bool
    updated_at: datetime


class SegmentDetailResponse(SegmentResponse):
    observation: ObservationBriefResponse | None = None


# ---------------------------------------------------------------------------
# Modul 3: Observations & CSV Staging
# ---------------------------------------------------------------------------


class ObservationFormRequest(BaseModel):
    segment_id: int | None = None
    segment_code: str | None = None
    total_lights: int = Field(..., ge=0)
    broken_lights: int = Field(..., ge=0)
    dawn_crime_count: int | None = Field(default=None, ge=0)
    boarding_house_count: int = Field(..., ge=0)
    inspection_date: date

    @model_validator(mode="after")
    def validate_business_rules(self) -> "ObservationFormRequest":
        if self.segment_id is None and not self.segment_code:
            raise ValueError("Harus menyertakan segment_id atau segment_code.")
        if self.broken_lights > self.total_lights:
            raise ValueError(
                "INVALID_LIGHT_LOGIC: Jumlah lampu mati (broken_lights) tidak boleh melebihi total lampu terpasang (total_lights)."
            )
        return self


class ObservationFormResponse(BaseModel):
    observation: ObservationBriefResponse
    warnings: list[str] = Field(default_factory=list)


class CSVValidationIssue(BaseModel):
    code: str
    severity: Literal["WARNING", "ERROR"]
    message: str


class CSVValidatedRow(BaseModel):
    row_number: int
    segment_code: str
    total_lights: int | None = None
    broken_lights: int | None = None
    dawn_crime_count: int | None = None
    boarding_house_count: int | None = None
    inspection_date: str | None = None
    status: Literal["VALID", "WARNING", "ERROR"]
    issues: list[CSVValidationIssue] = Field(default_factory=list)
    messages: list[str] = Field(default_factory=list)


class CSVUploadPreviewResponse(BaseModel):
    batch_id: str
    filename: str
    status: BatchStatus
    total_rows: int
    valid_rows: int
    warning_rows: int
    error_rows: int
    rows: list[CSVValidatedRow]
    created_at: datetime


class CSVRowCorrection(BaseModel):
    row_number: int = Field(..., ge=1)
    segment_code: str = Field(..., min_length=1)
    total_lights: int = Field(..., ge=0)
    broken_lights: int = Field(..., ge=0)
    dawn_crime_count: int | None = Field(default=None, ge=0)
    boarding_house_count: int = Field(..., ge=0)
    inspection_date: date

    @model_validator(mode="after")
    def check_lights(self) -> "CSVRowCorrection":
        if self.broken_lights > self.total_lights:
            raise ValueError("broken_lights tidak boleh melebihi total_lights.")
        return self


class CSVConfirmRequest(BaseModel):
    include_warnings: bool = True
    corrections: list[CSVRowCorrection] = Field(default_factory=list)


class CSVConfirmResponse(BaseModel):
    batch_id: str
    status: BatchStatus
    committed_count: int
    skipped_error_count: int
    committed_segment_codes: list[str]


# ---------------------------------------------------------------------------
# Modul 4: AHP Weighting
# ---------------------------------------------------------------------------


class AHPCalculateRequest(BaseModel):
    pairwise_matrix: list[list[float]] = Field(
        ...,
        description="Matriks perbandingan berpasangan 3x3 untuk [C1: Kerusakan Lampu, C2: Curanmor Dini Hari, C3: Kepadatan Indekos].",
    )

    @field_validator("pairwise_matrix")
    @classmethod
    def validate_matrix_shape(cls, matrix: list[list[float]]) -> list[list[float]]:
        if len(matrix) != 3 or any(len(row) != 3 for row in matrix):
            raise ValueError("pairwise_matrix wajib berukuran 3x3.")
        return matrix


class AHPCalculateResponse(BaseModel):
    pairwise_matrix: list[list[float]]
    w_light_damage: float
    w_dawn_crime: float
    w_boarding_density: float
    lambda_max: float
    ci: float
    ri: float
    cr: float
    is_consistent: bool


class AHPVersionCreateRequest(AHPCalculateRequest):
    version_name: str = Field(..., min_length=2, max_length=150)
    activate_immediately: bool = False


class AHPVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version_name: str
    created_by: int
    pairwise_matrix: list[list[float]]
    w_light_damage: float
    w_dawn_crime: float
    w_boarding_density: float
    lambda_max: float
    ci: float
    ri: float
    cr: float
    is_consistent: bool
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Modul 5: TOPSIS Ranking
# ---------------------------------------------------------------------------


class TOPSISCycleCreateRequest(BaseModel):
    cycle_name: str = Field(..., min_length=2, max_length=200)
    criteria_directions: tuple[
        Literal["max", "min"], Literal["max", "min"], Literal["max", "min"]
    ] = ("max", "max", "max")


class CycleRankingItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    segment_id: int
    segment_code: str
    segment_name: str
    corridor: CorridorEnum
    is_eligible: bool
    ineligible_reason: str | None
    snapshot_data: dict[str, Any]
    norm_c1: float | None
    norm_c2: float | None
    norm_c3: float | None
    weighted_c1: float | None
    weighted_c2: float | None
    weighted_c3: float | None
    d_plus: float | None
    d_minus: float | None
    preference_score: float | None
    rank: int | None
    priority_category: str
    is_tie_broken: bool


class TOPSISCycleDetailResponse(BaseModel):
    cycle_id: int
    cycle_name: str
    executed_by: int
    ahp_version_id: int
    weights_snapshot: dict[str, Any]
    status: CycleStatus
    created_at: datetime
    eligible_count: int
    ineligible_count: int
    eligible_results: list[CycleRankingItemResponse]
    ineligible_results: list[CycleRankingItemResponse]


# ---------------------------------------------------------------------------
# Modul 6: Priority Map
# ---------------------------------------------------------------------------


class GeoJSONFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: dict[str, Any]
    properties: dict[str, Any]


class GeoJSONFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    cycle_id: int | None = None
    cycle_name: str | None = None
    features: list[GeoJSONFeature]


class MapSegmentDetailResponse(BaseModel):
    segment_id: int
    segment_code: str
    name: str
    corridor: CorridorEnum
    is_active: bool
    geojson_geometry: dict[str, Any]
    cycle_id: int | None = None
    cycle_name: str | None = None
    ahp_weights: dict[str, Any] | None = None
    indicators: dict[str, Any] | None = None
    normalized_values: dict[str, float | None] | None = None
    weighted_values: dict[str, float | None] | None = None
    d_plus: float | None = None
    d_minus: float | None = None
    preference_score: float | None = None
    rank: int | None = None
    priority_category: str
    is_eligible: bool | None = None
    ineligible_reason: str | None = None
    is_tie_broken: bool = False
    inspection_date: date | str | None = None
    data_source: str | None = None


# ---------------------------------------------------------------------------
# Modul 7: Worklists & Override Audit
# ---------------------------------------------------------------------------


class WorklistProposeRequest(BaseModel):
    capacity_quota: int = Field(..., gt=0, description="Kapasitas jumlah gang K > 0")


class WorklistCandidateItem(BaseModel):
    segment_id: int
    segment_code: str
    segment_name: str
    corridor: CorridorEnum
    rank: int
    preference_score: float
    broken_lights: int
    dawn_crime_count: int
    boarding_house_count: int
    is_tie_broken: bool


class WorklistProposeResponse(BaseModel):
    cycle_id: int
    cycle_name: str
    capacity_quota: int
    total_eligible: int
    system_proposed: list[WorklistCandidateItem]
    reserve_candidates: list[WorklistCandidateItem]


class WorklistFinalizeRequest(BaseModel):
    capacity_quota: int = Field(..., gt=0)
    final_selected_segment_ids: list[int] = Field(..., min_length=1)
    override_reason: str | None = None

    @field_validator("final_selected_segment_ids")
    @classmethod
    def validate_unique_ids(cls, ids: list[int]) -> list[int]:
        if len(set(ids)) != len(ids):
            raise ValueError("final_selected_segment_ids tidak boleh mengandung ID duplikat.")
        return ids

    @model_validator(mode="after")
    def validate_quota_limit(self) -> "WorklistFinalizeRequest":
        if len(self.final_selected_segment_ids) > self.capacity_quota:
            raise ValueError(
                f"Jumlah segmen terpilih ({len(self.final_selected_segment_ids)}) melebihi kuota kapasitas ({self.capacity_quota})."
            )
        return self


class WorklistDecisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cycle_id: int
    decided_by: int
    capacity_quota: int
    system_proposed_segment_ids: list[int]
    final_selected_segment_ids: list[int]
    is_overridden: bool
    override_reason: str | None
    finalized_at: datetime


# ---------------------------------------------------------------------------
# Modul 8: History
# ---------------------------------------------------------------------------


class CycleHistorySummaryResponse(BaseModel):
    cycle_id: int
    cycle_name: str
    created_at: datetime
    executed_by: int
    executed_by_username: str
    ahp_version_id: int
    ahp_version_name: str
    weights_snapshot: dict[str, Any]
    status: CycleStatus
    total_segments: int
    eligible_count: int
    ineligible_count: int
    is_overridden: bool | None = None
    capacity_quota: int | None = None
    finalized_at: datetime | None = None
