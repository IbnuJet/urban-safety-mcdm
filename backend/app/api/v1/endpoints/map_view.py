"""Modul 6: Priority map GeoJSON layer and segment calculation detail endpoints (Supabase)."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_optional_user
from app.core.config import settings
from app.core.database import get_db
from app.models.models import (
    AHPWeightVersion,
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
    MapSummaryMetrics,
)
from app.services.topsis_engine import (
    TOPSISInputItem,
    TOPSISRankedItem,
    calculate_topsis,
    evaluate_segment_eligibility,
    get_priority_category,
)

router = APIRouter(prefix="/map", tags=["Priority Map"])


def _resolve_cycle(db: Session, cycle_id: int | None) -> EvaluationCycle | None:
    if cycle_id is not None:
        cycle = db.scalar(
            select(EvaluationCycle)
            .options(
                selectinload(EvaluationCycle.ranking_results).selectinload(
                    CycleRankingResult.segment
                ),
                selectinload(EvaluationCycle.worklist_decision),
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
            ),
            selectinload(EvaluationCycle.worklist_decision),
        )
        .order_by(EvaluationCycle.created_at.desc(), EvaluationCycle.id.desc())
        .limit(1)
    )


def _compute_live_ranking_from_supabase(
    db: Session,
) -> tuple[
    list[AlleySegment],
    dict[int, TOPSISRankedItem],
    dict[int, tuple[bool, str | None]],
    dict[str, float],
]:
    """Compute live TOPSIS ranking directly from Supabase alley_segments & segment_observations."""
    segments = list(
        db.scalars(
            select(AlleySegment)
            .options(selectinload(AlleySegment.observation))
            .order_by(AlleySegment.segment_code.asc())
        ).all()
    )
    active_ahp = db.scalar(
        select(AHPWeightVersion).where(
            AHPWeightVersion.is_active.is_(True),
            AHPWeightVersion.is_consistent.is_(True),
        )
    )
    if active_ahp is not None:
        weights = (
            active_ahp.w_light_damage,
            active_ahp.w_dawn_crime,
            active_ahp.w_boarding_density,
        )
    else:
        weights = (0.2970, 0.5396, 0.1634)

    weights_dict = {
        "w_light_damage": float(weights[0]),
        "w_dawn_crime": float(weights[1]),
        "w_boarding_density": float(weights[2]),
    }

    today = date.today()
    eligible_inputs: list[TOPSISInputItem] = []
    eligibility_map: dict[int, tuple[bool, str | None]] = {}

    for seg in segments:
        obs = seg.observation
        is_eligible, reason = evaluate_segment_eligibility(
            segment=seg,
            observation=obs,
            reference_date=today,
            expiry_days=settings.INSPECTION_EXPIRY_DAYS,
        )
        eligibility_map[seg.id] = (is_eligible, reason)
        if is_eligible and obs is not None and obs.dawn_crime_count is not None:
            eligible_inputs.append(
                TOPSISInputItem(
                    segment_id=seg.id,
                    segment_code=seg.segment_code,
                    broken_lights=obs.broken_lights,
                    dawn_crime_count=obs.dawn_crime_count,
                    boarding_house_count=obs.boarding_house_count,
                )
            )

    ranked_items = (
        calculate_topsis(items=eligible_inputs, weights=weights)
        if eligible_inputs
        else []
    )
    ranked_map = {item.segment_id: item for item in ranked_items}
    return segments, ranked_map, eligibility_map, weights_dict


@router.get("/priority-layer", response_model=GeoJSONFeatureCollection)
def get_priority_map_layer(
    cycle_id: int | None = Query(default=None),
    corridor: CorridorEnum | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User | None = Depends(get_optional_user),
) -> GeoJSONFeatureCollection:
    """Return a GeoJSON FeatureCollection of ranked alley segments directly from Supabase."""
    cycle = _resolve_cycle(db, cycle_id)

    # Always use live computation from Supabase when no specific cycle_id is requested
    # or when no evaluation cycle exists yet, so changes in Supabase Table Editor reflect immediately.
    if cycle_id is None:
        segments, ranked_map, eligibility_map, _ = _compute_live_ranking_from_supabase(db)
        if corridor is not None:
            segments = [s for s in segments if s.corridor == corridor]

        def _sort_key(seg: AlleySegment):
            is_el, _ = eligibility_map.get(seg.id, (False, None))
            r_item = ranked_map.get(seg.id)
            return (
                0 if is_el else 1,
                r_item.rank if r_item is not None else 10**9,
                seg.segment_code,
            )

        segments.sort(key=_sort_key)

        features: list[GeoJSONFeature] = []
        total_broken_lights = 0
        eligible_count = 0

        for seg in segments:
            obs = seg.observation
            is_el, reason = eligibility_map.get(seg.id, (False, None))
            r_item = ranked_map.get(seg.id)
            if is_el:
                eligible_count += 1
            if obs is not None and obs.broken_lights:
                total_broken_lights += int(obs.broken_lights)

            pref_score = r_item.preference_score if r_item is not None else None
            features.append(
                GeoJSONFeature(
                    type="Feature",
                    geometry=seg.geojson_geometry,
                    properties={
                        "segment_id": seg.id,
                        "segment_code": seg.segment_code,
                        "name": seg.name,
                        "corridor": seg.corridor.value,
                        "rank": r_item.rank if r_item is not None else None,
                        "preference_score": pref_score,
                        "priority_category": get_priority_category(is_el, pref_score),
                        "total_lights": obs.total_lights if obs else 0,
                        "broken_lights": obs.broken_lights if obs else 0,
                        "dawn_crime_count": obs.dawn_crime_count if obs else 0,
                        "boarding_house_count": obs.boarding_house_count if obs else 0,
                        "inspection_date": (
                            obs.inspection_date.isoformat() if obs else None
                        ),
                        "is_eligible": is_el,
                        "ineligible_reason": reason,
                        "is_tie_broken": (
                            r_item.is_tie_broken if r_item is not None else False
                        ),
                    },
                )
            )

        capacity_quota = (
            cycle.worklist_decision.capacity_quota
            if cycle and cycle.worklist_decision
            else None
        )
        return GeoJSONFeatureCollection(
            type="FeatureCollection",
            cycle_id=cycle.id if cycle else None,
            cycle_name=cycle.cycle_name if cycle else "Data Langsung Supabase",
            summary=MapSummaryMetrics(
                total_segments=len(segments),
                total_broken_lights=total_broken_lights,
                eligible_count=eligible_count,
                ineligible_count=len(segments) - eligible_count,
                capacity_quota=capacity_quota,
            ),
            features=features,
        )

    assert cycle is not None
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

    features = []
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

    total_broken_lights = sum(
        int((r.snapshot_data or {}).get("broken_lights") or 0) for r in results
    )
    eligible_count = sum(1 for r in results if r.is_eligible)
    ineligible_count = len(results) - eligible_count
    capacity_quota = (
        cycle.worklist_decision.capacity_quota if cycle.worklist_decision else None
    )

    return GeoJSONFeatureCollection(
        type="FeatureCollection",
        cycle_id=cycle.id,
        cycle_name=cycle.cycle_name,
        summary=MapSummaryMetrics(
            total_segments=len(results),
            total_broken_lights=total_broken_lights,
            eligible_count=eligible_count,
            ineligible_count=ineligible_count,
            capacity_quota=capacity_quota,
        ),
        features=features,
    )


@router.get("/segments/{segment_id}/detail", response_model=MapSegmentDetailResponse)
def get_map_segment_detail(
    segment_id: int,
    cycle_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User | None = Depends(get_optional_user),
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

    # Live calculation fallback directly from Supabase tables
    _, ranked_map, eligibility_map, weights_dict = _compute_live_ranking_from_supabase(db)
    is_el, reason = eligibility_map.get(segment.id, (False, None))
    r_item = ranked_map.get(segment.id)
    obs = segment.observation
    pref_score = r_item.preference_score if r_item is not None else None

    return MapSegmentDetailResponse(
        segment_id=segment.id,
        segment_code=segment.segment_code,
        name=segment.name,
        corridor=segment.corridor,
        is_active=segment.is_active,
        geojson_geometry=segment.geojson_geometry,
        cycle_id=cycle.id if cycle else None,
        cycle_name=cycle.cycle_name if cycle else "Data Langsung Supabase",
        ahp_weights=weights_dict,
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
        normalized_values=(
            {
                "norm_c1": r_item.norm_c1,
                "norm_c2": r_item.norm_c2,
                "norm_c3": r_item.norm_c3,
            }
            if r_item
            else None
        ),
        weighted_values=(
            {
                "weighted_c1": r_item.weighted_c1,
                "weighted_c2": r_item.weighted_c2,
                "weighted_c3": r_item.weighted_c3,
            }
            if r_item
            else None
        ),
        d_plus=r_item.d_plus if r_item else None,
        d_minus=r_item.d_minus if r_item else None,
        preference_score=pref_score,
        rank=r_item.rank if r_item else None,
        priority_category=get_priority_category(is_el, pref_score),
        is_eligible=is_el,
        ineligible_reason=reason,
        is_tie_broken=r_item.is_tie_broken if r_item else False,
        inspection_date=obs.inspection_date.isoformat() if obs else None,
        data_source=obs.data_source.value if obs else None,
    )
