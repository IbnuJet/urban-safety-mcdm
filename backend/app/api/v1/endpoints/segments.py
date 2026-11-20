"""Modul 2: Alley segment master data endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_optional_user, require_roles
from app.core.database import get_db
from app.models.models import AlleySegment, CorridorEnum, User, UserRole
from app.schemas.schemas import (
    ObservationBriefResponse,
    SegmentCreateRequest,
    SegmentDetailResponse,
    SegmentResponse,
    SegmentUpdateRequest,
)

router = APIRouter(prefix="/segments", tags=["Alley Segments"])


def _to_segment_response(seg: AlleySegment) -> SegmentResponse:
    obs_brief = (
        ObservationBriefResponse.model_validate(seg.observation)
        if seg.observation is not None
        else None
    )
    return SegmentResponse(
        id=seg.id,
        segment_code=seg.segment_code,
        name=seg.name,
        corridor=seg.corridor,
        geojson_geometry=seg.geojson_geometry,
        is_active=seg.is_active,
        updated_at=seg.updated_at,
        has_geometry=bool(
            isinstance(seg.geojson_geometry, dict)
            and seg.geojson_geometry.get("coordinates")
        ),
        last_inspection_date=(
            seg.observation.inspection_date if seg.observation is not None else None
        ),
        observation=obs_brief,
    )


@router.get("", response_model=list[SegmentResponse])
def list_segments(
    corridor: CorridorEnum | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    q: str | None = Query(default=None, description="Kata kunci kode atau nama gang"),
    db: Session = Depends(get_db),
    _: User | None = Depends(get_optional_user),
) -> list[SegmentResponse]:
    """List alley segments directly from Supabase with optional filters."""
    stmt = select(AlleySegment).options(selectinload(AlleySegment.observation))
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
    return [_to_segment_response(seg) for seg in segments]


@router.get("/{segment_id}", response_model=SegmentDetailResponse)
def get_segment_detail(
    segment_id: int,
    db: Session = Depends(get_db),
    _: User | None = Depends(get_optional_user),
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
    base = _to_segment_response(segment)
    return SegmentDetailResponse(**base.model_dump())


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
    created = db.scalar(
        select(AlleySegment)
        .options(selectinload(AlleySegment.observation))
        .where(AlleySegment.id == segment.id)
    )
    assert created is not None
    return _to_segment_response(created)


@router.put("/{segment_id}", response_model=SegmentResponse)
def update_segment(
    segment_id: int,
    payload: SegmentUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.OPERATOR, UserRole.ADMIN)),
) -> SegmentResponse:
    """Update alley segment metadata or GeoJSON geometry."""
    segment = db.scalar(
        select(AlleySegment)
        .options(selectinload(AlleySegment.observation))
        .where(AlleySegment.id == segment_id)
    )
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
    return _to_segment_response(segment)
