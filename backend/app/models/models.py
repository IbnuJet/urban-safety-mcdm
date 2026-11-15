"""SQLAlchemy 2.0 database models for all 8 core entities."""

import enum
import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Portable JSON column: uses native JSONB on PostgreSQL and JSON on SQLite
JSONType = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    """Return timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


def _enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"
    PENILAI = "PENILAI"
    PENANGGUNG_JAWAB_PJU = "PENANGGUNG_JAWAB_PJU"


class CorridorEnum(str, enum.Enum):
    CISEKE = "Ciseke"
    CARINGIN = "Caringin"
    GANG_H_NENA = "Gang H Nena"
    HEGARMANAH = "Hegarmanah"
    SUKAWENING = "Sukawening"


class DataSourceEnum(str, enum.Enum):
    MANUAL_FORM = "MANUAL_FORM"
    CSV_IMPORT = "CSV_IMPORT"


class BatchStatus(str, enum.Enum):
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class CycleStatus(str, enum.Enum):
    RANKED = "RANKED"
    WORKLIST_FINALIZED = "WORKLIST_FINALIZED"


class User(Base):
    """1. Tabel akun pengguna dan peran RBAC."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, values_callable=_enum_values, native_enum=False, length=32),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )


class AlleySegment(Base):
    """2. Data master segmen gang beserta koridor dan geometri GeoJSON."""

    __tablename__ = "alley_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    segment_code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    corridor: Mapped[CorridorEnum] = mapped_column(
        SAEnum(CorridorEnum, values_callable=_enum_values, native_enum=False, length=50),
        nullable=False,
        index=True,
    )
    geojson_geometry: Mapped[dict[str, Any]] = mapped_column(JSONType, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    observation: Mapped["SegmentObservation | None"] = relationship(
        "SegmentObservation",
        back_populates="segment",
        uselist=False,
        cascade="all, delete-orphan",
    )


class SegmentObservation(Base):
    """3. Data kondisi lampu PJU & indikator lapangan terbaru per segmen."""

    __tablename__ = "segment_observations"
    __table_args__ = (
        CheckConstraint("total_lights >= 0", name="ck_obs_total_lights_nonneg"),
        CheckConstraint("broken_lights >= 0", name="ck_obs_broken_lights_nonneg"),
        CheckConstraint("broken_lights <= total_lights", name="ck_obs_broken_le_total"),
        CheckConstraint(
            "dawn_crime_count IS NULL OR dawn_crime_count >= 0",
            name="ck_obs_crime_nonneg",
        ),
        CheckConstraint("boarding_house_count >= 0", name="ck_obs_boarding_nonneg"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    segment_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("alley_segments.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    total_lights: Mapped[int] = mapped_column(Integer, nullable=False)
    broken_lights: Mapped[int] = mapped_column(Integer, nullable=False)
    dawn_crime_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    boarding_house_count: Mapped[int] = mapped_column(Integer, nullable=False)
    inspection_date: Mapped[date] = mapped_column(Date, nullable=False)
    data_source: Mapped[DataSourceEnum] = mapped_column(
        SAEnum(DataSourceEnum, values_callable=_enum_values, native_enum=False, length=32),
        nullable=False,
    )
    updated_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    segment: Mapped["AlleySegment"] = relationship(
        "AlleySegment", back_populates="observation"
    )
    updater: Mapped["User"] = relationship("User")


class CSVImportBatch(Base):
    """4. Staging & pratinjau validasi impor CSV."""

    __tablename__ = "csv_import_batches"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    uploaded_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[BatchStatus] = mapped_column(
        SAEnum(BatchStatus, values_callable=_enum_values, native_enum=False, length=32),
        default=BatchStatus.PENDING_CONFIRMATION,
        nullable=False,
    )
    rows_payload: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    uploader: Mapped["User"] = relationship("User")


class AHPWeightVersion(Base):
    """5. Riwayat dan versi bobot kriteria AHP."""

    __tablename__ = "ahp_weight_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version_name: Mapped[str] = mapped_column(String(150), nullable=False)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    pairwise_matrix: Mapped[list[list[float]]] = mapped_column(JSONType, nullable=False)
    w_light_damage: Mapped[float] = mapped_column(Float, nullable=False)
    w_dawn_crime: Mapped[float] = mapped_column(Float, nullable=False)
    w_boarding_density: Mapped[float] = mapped_column(Float, nullable=False)
    lambda_max: Mapped[float] = mapped_column(Float, nullable=False)
    ci: Mapped[float] = mapped_column(Float, nullable=False)
    ri: Mapped[float] = mapped_column(Float, default=0.58, nullable=False)
    cr: Mapped[float] = mapped_column(Float, nullable=False)
    is_consistent: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    creator: Mapped["User"] = relationship("User")


class EvaluationCycle(Base):
    """6. Siklus perhitungan TOPSIS dan snapshot bobot AHP."""

    __tablename__ = "evaluation_cycles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cycle_name: Mapped[str] = mapped_column(String(200), nullable=False)
    executed_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    ahp_version_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ahp_weight_versions.id"), nullable=False
    )
    weights_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONType, nullable=False)
    status: Mapped[CycleStatus] = mapped_column(
        SAEnum(CycleStatus, values_callable=_enum_values, native_enum=False, length=32),
        default=CycleStatus.RANKED,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    executor: Mapped["User"] = relationship("User")
    ahp_version: Mapped["AHPWeightVersion"] = relationship("AHPWeightVersion")
    ranking_results: Mapped[list["CycleRankingResult"]] = relationship(
        "CycleRankingResult",
        back_populates="cycle",
        cascade="all, delete-orphan",
    )
    worklist_decision: Mapped["WorklistDecision | None"] = relationship(
        "WorklistDecision",
        back_populates="cycle",
        uselist=False,
        cascade="all, delete-orphan",
    )


class CycleRankingResult(Base):
    """7. Hasil perankingan per segmen pada suatu siklus TOPSIS."""

    __tablename__ = "cycle_ranking_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cycle_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("evaluation_cycles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    segment_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("alley_segments.id"),
        nullable=False,
        index=True,
    )
    is_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    ineligible_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    snapshot_data: Mapped[dict[str, Any]] = mapped_column(JSONType, nullable=False)
    norm_c1: Mapped[float | None] = mapped_column(Float, nullable=True)
    norm_c2: Mapped[float | None] = mapped_column(Float, nullable=True)
    norm_c3: Mapped[float | None] = mapped_column(Float, nullable=True)
    weighted_c1: Mapped[float | None] = mapped_column(Float, nullable=True)
    weighted_c2: Mapped[float | None] = mapped_column(Float, nullable=True)
    weighted_c3: Mapped[float | None] = mapped_column(Float, nullable=True)
    d_plus: Mapped[float | None] = mapped_column(Float, nullable=True)
    d_minus: Mapped[float | None] = mapped_column(Float, nullable=True)
    preference_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_tie_broken: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    cycle: Mapped["EvaluationCycle"] = relationship(
        "EvaluationCycle", back_populates="ranking_results"
    )
    segment: Mapped["AlleySegment"] = relationship("AlleySegment")


class WorklistDecision(Base):
    """8. Daftar kerja perbaikan final dan audit override."""

    __tablename__ = "worklist_decisions"
    __table_args__ = (
        CheckConstraint("capacity_quota > 0", name="ck_worklist_quota_pos"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cycle_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("evaluation_cycles.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    decided_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    capacity_quota: Mapped[int] = mapped_column(Integer, nullable=False)
    system_proposed_segment_ids: Mapped[list[int]] = mapped_column(
        JSONType, nullable=False
    )
    final_selected_segment_ids: Mapped[list[int]] = mapped_column(
        JSONType, nullable=False
    )
    is_overridden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    finalized_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    cycle: Mapped["EvaluationCycle"] = relationship(
        "EvaluationCycle", back_populates="worklist_decision"
    )
    decider: Mapped["User"] = relationship("User")
