"""Modul 6: Priority map GeoJSON layer and segment calculation detail endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.models import (
    AlleySegment,
    CorridorEnum,
    CycleRankingResult,
    EvaluationCycle,
    User,
)
from app.schemas.schemas import (
    GeoJSONFeature,
    GeoJSONFeatureCollection,
    MapSegmentDetailResponse,
)
from app.services.topsis_engine import get_priority_category

router = APIRouter(prefix="/map", tags=["Priority Map"])


def _resolve_cycle(db: Session, cycle_id: int | None) -> EvaluationCycle | None:
    if cycle_id is not None:
        cycle = db.scalar(
            select(EvaluationCycle)
            .options(
                selectinload(EvaluationCycle.ranking_results).selectinload(
                    CycleRankingResult.segment
                )
            )
            .where(EvaluationCycle.id == cycle_id)
        )
        if cycle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Siklus evaluasi dengan ID {cycle_id} tidak ditemukan.",
            )
        return cycle

    return db.scalar(
        select(EvaluationCycle)
        .options(
            selectinload(EvaluationCycle.ranking_results).selectinload(
                CycleRankingResult.segment
            )
        )
        .order_by(EvaluationCycle.created_at.desc(), EvaluationCycle.id.desc())
        .limit(1)
    )


@router.get("/priority-layer", response_model=GeoJSONFeatureCollection)
def get_priority_map_layer(
    cycle_id: int | None = Query(default=None),
    corridor: CorridorEnum | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> GeoJSONFeatureCollection:
    """Return a GeoJSON FeatureCollection of ranked alley segments for map rendering."""
    cycle = _resolve_cycle(db, cycle_id)
    if cycle is None:
        return GeoJSONFeatureCollection(
            type="FeatureCollection",
            cycle_id=None,
            cycle_name=None,
            features=[],
        )

    results = cycle.ranking_results
    if corridor is not None:
        results = [r for r in results if r.segment.corridor == corridor]

    results = sorted(
        results,
        key=lambda r: (
            0 if r.is_eligible else 1,
            r.rank if r.rank is not None else 10**9,
            r.segment.segment_code,
        ),
    )

    features: list[GeoJSONFeature] = []
    for r in results:
        snap = r.snapshot_data or {}
        features.append(
            GeoJSONFeature(
                type="Feature",
                geometry=r.segment.geojson_geometry,
                properties={
                    "segment_id": r.segment.id,
                    "segment_code": r.segment.segment_code,
                    "name": r.segment.name,
                    "corridor": r.segment.corridor.value,
                    "rank": r.rank,
                    "preference_score": r.preference_score,
                    "priority_category": get_priority_category(
                        r.is_eligible, r.preference_score
                    ),
                    "total_lights": snap.get("total_lights"),
                    "broken_lights": snap.get("broken_lights"),
                    "dawn_crime_count": snap.get("dawn_crime_count"),
                    "boarding_house_count": snap.get("boarding_house_count"),
                    "inspection_date": snap.get("inspection_date"),
                    "is_eligible": r.is_eligible,
                    "ineligible_reason": r.ineligible_reason,
                    "is_tie_broken": r.is_tie_broken,
                },
            )
        )

    return GeoJSONFeatureCollection(
        type="FeatureCollection",
        cycle_id=cycle.id,
        cycle_name=cycle.cycle_name,
        features=features,
    )


@router.get("/segments/{segment_id}/detail", response_model=MapSegmentDetailResponse)
def get_map_segment_detail(
    segment_id: int,
    cycle_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> MapSegmentDetailResponse:
    """Return full segment attributes, TOPSIS computation breakdown, and data provenance."""
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

    cycle = _resolve_cycle(db, cycle_id)
    ranking_row: CycleRankingResult | None = None
    if cycle is not None:
        for r in cycle.ranking_results:
            if r.segment_id == segment_id:
                ranking_row = r
                break

    if cycle is not None and ranking_row is not None:
        snap = ranking_row.snapshot_data or {}
        return MapSegmentDetailResponse(
            segment_id=segment.id,
            segment_code=segment.segment_code,
            name=segment.name,
            corridor=segment.corridor,
            is_active=segment.is_active,
            geojson_geometry=segment.geojson_geometry,
            cycle_id=cycle.id,
            cycle_name=cycle.cycle_name,
            ahp_weights={
                "w_light_damage": float(cycle.weights_snapshot.get("w_light_damage", 0.0)),
                "w_dawn_crime": float(cycle.weights_snapshot.get("w_dawn_crime", 0.0)),
                "w_boarding_density": float(
                    cycle.weights_snapshot.get("w_boarding_density", 0.0)
                ),
            },
            indicators={
                "total_lights": snap.get("total_lights"),
                "broken_lights": snap.get("broken_lights"),
                "dawn_crime_count": snap.get("dawn_crime_count"),
                "boarding_house_count": snap.get("boarding_house_count"),
            },
            normalized_values={
                "norm_c1": ranking_row.norm_c1,
                "norm_c2": ranking_row.norm_c2,
                "norm_c3": ranking_row.norm_c3,
            },
            weighted_values={
                "weighted_c1": ranking_row.weighted_c1,
                "weighted_c2": ranking_row.weighted_c2,
                "weighted_c3": ranking_row.weighted_c3,
            },
            d_plus=ranking_row.d_plus,
            d_minus=ranking_row.d_minus,
            preference_score=ranking_row.preference_score,
            rank=ranking_row.rank,
            priority_category=get_priority_category(
                ranking_row.is_eligible, ranking_row.preference_score
            ),
            is_eligible=ranking_row.is_eligible,
            ineligible_reason=ranking_row.ineligible_reason,
            is_tie_broken=ranking_row.is_tie_broken,
            inspection_date=snap.get("inspection_date"),
            data_source=snap.get("data_source"),
        )

    obs = segment.observation
    return MapSegmentDetailResponse(
        segment_id=segment.id,
        segment_code=segment.segment_code,
        name=segment.name,
        corridor=segment.corridor,
        is_active=segment.is_active,
        geojson_geometry=segment.geojson_geometry,
        cycle_id=cycle.id if cycle else None,
        cycle_name=cycle.cycle_name if cycle else None,
        ahp_weights=cycle.weights_snapshot if cycle else None,
        indicators=(
            {
                "total_lights": obs.total_lights,
                "broken_lights": obs.broken_lights,
                "dawn_crime_count": obs.dawn_crime_count,
                "boarding_house_count": obs.boarding_house_count,
            }
            if obs
            else None
        ),
        priority_category="Tidak Layak",
        is_eligible=False if obs is None else None,
        ineligible_reason=(
            "Belum ada siklus perhitungan TOPSIS." if cycle is None else "Segmen belum masuk dalam siklus."
        ),
        inspection_date=obs.inspection_date.isoformat() if obs else None,
        data_source=obs.data_source.value if obs else None,
    )
