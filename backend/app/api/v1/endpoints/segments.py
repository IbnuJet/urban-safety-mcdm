"""Modul 2: Alley segment master data endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.models import AlleySegment, CorridorEnum, User, UserRole
from app.schemas.schemas import (
    SegmentCreateRequest,
    SegmentDetailResponse,
    SegmentResponse,
    SegmentUpdateRequest,
)

router = APIRouter(prefix="/segments", tags=["Alley Segments"])


@router.get("", response_model=list[SegmentResponse])
def list_segments(
    corridor: CorridorEnum | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    q: str | None = Query(default=None, description="Kata kunci kode atau nama gang"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SegmentResponse]:
    """List alley segments with optional corridor, status, and keyword filters."""
    stmt = select(AlleySegment)
    if corridor is not None:
        stmt = stmt.where(AlleySegment.corridor == corridor)
    if is_active is not None:
        stmt = stmt.where(AlleySegment.is_active == is_active)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                AlleySegment.segment_code.ilike(pattern),
                AlleySegment.name.ilike(pattern),
            )
        )
    stmt = stmt.order_by(AlleySegment.segment_code.asc())
    segments = db.scalars(stmt).all()
    return [SegmentResponse.model_validate(seg) for seg in segments]


@router.get("/{segment_id}", response_model=SegmentDetailResponse)
def get_segment_detail(
    segment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SegmentDetailResponse:
    """Return detail of a single alley segment along with its latest observation."""
    stmt = (
        select(AlleySegment)
        .options(selectinload(AlleySegment.observation))
        .where(AlleySegment.id == segment_id)
    )
    segment = db.scalar(stmt)
    if segment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Segmen gang dengan ID {segment_id} tidak ditemukan.",
        )
    return SegmentDetailResponse.model_validate(segment)


@router.post("", response_model=SegmentResponse, status_code=status.HTTP_201_CREATED)
def create_segment(
    payload: SegmentCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.OPERATOR, UserRole.ADMIN)),
) -> SegmentResponse:
    """Create a new alley segment with validated GeoJSON geometry."""
    existing = db.scalar(
        select(AlleySegment).where(AlleySegment.segment_code == payload.segment_code)
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Kode segmen '{payload.segment_code}' sudah terdaftar.",
        )

    segment = AlleySegment(
        segment_code=payload.segment_code,
        name=payload.name.strip(),
        corridor=payload.corridor,
        geojson_geometry=payload.geojson_geometry.model_dump(),
        is_active=payload.is_active,
    )
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return SegmentResponse.model_validate(segment)


@router.put("/{segment_id}", response_model=SegmentResponse)
def update_segment(
    segment_id: int,
    payload: SegmentUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.OPERATOR, UserRole.ADMIN)),
) -> SegmentResponse:
    """Update alley segment metadata or GeoJSON geometry."""
    segment = db.get(AlleySegment, segment_id)
    if segment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Segmen gang dengan ID {segment_id} tidak ditemukan.",
        )

    if payload.name is not None:
        segment.name = payload.name.strip()
    if payload.corridor is not None:
        segment.corridor = payload.corridor
    if payload.geojson_geometry is not None:
        segment.geojson_geometry = payload.geojson_geometry.model_dump()
    if payload.is_active is not None:
        segment.is_active = payload.is_active

    db.commit()
    db.refresh(segment)
    return SegmentResponse.model_validate(segment)
