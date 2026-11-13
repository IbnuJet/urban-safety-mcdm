"""Modul 5: TOPSIS evaluation cycle execution and ranking retrieval endpoints."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_roles
from app.core.config import settings
from app.core.database import get_db
from app.models.models import (
    AHPWeightVersion,
    AlleySegment,
    CycleRankingResult,
    CycleStatus,
    EvaluationCycle,
    User,
    UserRole,
)
from app.schemas.schemas import (
    CycleRankingItemResponse,
    TOPSISCycleCreateRequest,
    TOPSISCycleDetailResponse,
)
from app.services.topsis_engine import (
    TOPSISInputItem,
    calculate_topsis,
    evaluate_segment_eligibility,
    get_priority_category,
)

router = APIRouter(prefix="/topsis", tags=["TOPSIS Ranking"])


def _build_ranking_item(res: CycleRankingResult) -> CycleRankingItemResponse:
    return CycleRankingItemResponse(
        id=res.id,
        segment_id=res.segment_id,
        segment_code=res.segment.segment_code,
        segment_name=res.segment.name,
        corridor=res.segment.corridor,
        is_eligible=res.is_eligible,
        ineligible_reason=res.ineligible_reason,
        snapshot_data=res.snapshot_data,
        norm_c1=res.norm_c1,
        norm_c2=res.norm_c2,
        norm_c3=res.norm_c3,
        weighted_c1=res.weighted_c1,
        weighted_c2=res.weighted_c2,
        weighted_c3=res.weighted_c3,
        d_plus=res.d_plus,
        d_minus=res.d_minus,
        preference_score=res.preference_score,
        rank=res.rank,
        priority_category=get_priority_category(res.is_eligible, res.preference_score),
        is_tie_broken=res.is_tie_broken,
    )


def _build_cycle_response(cycle: EvaluationCycle) -> TOPSISCycleDetailResponse:
    eligible = [
        _build_ranking_item(r)
        for r in sorted(
            (item for item in cycle.ranking_results if item.is_eligible),
            key=lambda x: x.rank or 10**9,
        )
    ]
    ineligible = [
        _build_ranking_item(r)
        for r in sorted(
            (item for item in cycle.ranking_results if not item.is_eligible),
            key=lambda x: x.segment.segment_code,
        )
    ]
    return TOPSISCycleDetailResponse(
        cycle_id=cycle.id,
        cycle_name=cycle.cycle_name,
        executed_by=cycle.executed_by,
        ahp_version_id=cycle.ahp_version_id,
        weights_snapshot=cycle.weights_snapshot,
        status=cycle.status,
        created_at=cycle.created_at,
        eligible_count=len(eligible),
        ineligible_count=len(ineligible),
        eligible_results=eligible,
        ineligible_results=ineligible,
    )


@router.post(
    "/cycles",
    response_model=TOPSISCycleDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def run_topsis_cycle(
    payload: TOPSISCycleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.PENANGGUNG_JAWAB_PJU, UserRole.ADMIN)
    ),
) -> TOPSISCycleDetailResponse:
    """Execute a new TOPSIS ranking cycle using the active consistent AHP weight version."""
    active_ahp = db.scalar(
        select(AHPWeightVersion).where(
            AHPWeightVersion.is_active.is_(True),
            AHPWeightVersion.is_consistent.is_(True),
        )
    )
    if active_ahp is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Belum ada versi bobot AHP yang aktif dan konsisten (CR <= 0.10).",
        )

    segments = db.scalars(
        select(AlleySegment)
        .options(selectinload(AlleySegment.observation))
        .order_by(AlleySegment.segment_code.asc())
    ).all()
    if not segments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Belum ada data master segmen gang untuk dievaluasi.",
        )

    today = date.today()
    eligible_inputs: list[TOPSISInputItem] = []
    snapshots_by_segment: dict[int, dict] = {}
    ineligible_records: list[tuple[AlleySegment, str]] = []

    for seg in segments:
        obs = seg.observation
        is_eligible, reason = evaluate_segment_eligibility(
            segment=seg,
            observation=obs,
            reference_date=today,
            expiry_days=settings.INSPECTION_EXPIRY_DAYS,
        )
        if obs is not None:
            snapshots_by_segment[seg.id] = {
                "total_lights": obs.total_lights,
                "broken_lights": obs.broken_lights,
                "dawn_crime_count": obs.dawn_crime_count,
                "boarding_house_count": obs.boarding_house_count,
                "inspection_date": obs.inspection_date.isoformat(),
                "data_source": obs.data_source.value,
            }
        else:
            snapshots_by_segment[seg.id] = {}

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
        else:
            ineligible_records.append((seg, reason or "Tidak memenuhi syarat kelayakan."))

    if not eligible_inputs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak ada segmen gang yang memenuhi syarat kelayakan (eligible) untuk pemeringkatan TOPSIS.",
        )

    weights = (
        active_ahp.w_light_damage,
        active_ahp.w_dawn_crime,
        active_ahp.w_boarding_density,
    )
    ranked_items = calculate_topsis(
        items=eligible_inputs,
        weights=weights,
        criteria_directions=payload.criteria_directions,
    )

    cycle = EvaluationCycle(
        cycle_name=payload.cycle_name.strip(),
        executed_by=current_user.id,
        ahp_version_id=active_ahp.id,
        weights_snapshot={
            "w_light_damage": active_ahp.w_light_damage,
            "w_dawn_crime": active_ahp.w_dawn_crime,
            "w_boarding_density": active_ahp.w_boarding_density,
            "cr": active_ahp.cr,
            "version_name": active_ahp.version_name,
        },
        status=CycleStatus.RANKED,
    )
    db.add(cycle)
    db.flush()

    for ranked in ranked_items:
        db.add(
            CycleRankingResult(
                cycle_id=cycle.id,
                segment_id=ranked.segment_id,
                is_eligible=True,
                ineligible_reason=None,
                snapshot_data=snapshots_by_segment[ranked.segment_id],
                norm_c1=ranked.norm_c1,
                norm_c2=ranked.norm_c2,
                norm_c3=ranked.norm_c3,
                weighted_c1=ranked.weighted_c1,
                weighted_c2=ranked.weighted_c2,
                weighted_c3=ranked.weighted_c3,
                d_plus=ranked.d_plus,
                d_minus=ranked.d_minus,
                preference_score=ranked.preference_score,
                rank=ranked.rank,
                is_tie_broken=ranked.is_tie_broken,
            )
        )

    for seg, reason in ineligible_records:
        db.add(
            CycleRankingResult(
                cycle_id=cycle.id,
                segment_id=seg.id,
                is_eligible=False,
                ineligible_reason=reason,
                snapshot_data=snapshots_by_segment[seg.id],
                norm_c1=None,
                norm_c2=None,
                norm_c3=None,
                weighted_c1=None,
                weighted_c2=None,
                weighted_c3=None,
                d_plus=None,
                d_minus=None,
                preference_score=None,
                rank=None,
                is_tie_broken=False,
            )
        )

    db.commit()

    loaded_cycle = db.scalar(
        select(EvaluationCycle)
        .options(
            selectinload(EvaluationCycle.ranking_results).selectinload(
                CycleRankingResult.segment
            )
        )
        .where(EvaluationCycle.id == cycle.id)
    )
    assert loaded_cycle is not None
    return _build_cycle_response(loaded_cycle)


@router.get("/cycles/{cycle_id}", response_model=TOPSISCycleDetailResponse)
def get_topsis_cycle_detail(
    cycle_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> TOPSISCycleDetailResponse:
    """Retrieve ranked eligible segments and ineligible segments for a cycle."""
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
            detail=f"Siklus evaluasi TOPSIS dengan ID {cycle_id} tidak ditemukan.",
        )
    return _build_cycle_response(cycle)
