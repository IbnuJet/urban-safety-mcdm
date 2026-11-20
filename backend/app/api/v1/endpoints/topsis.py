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
    SegmentCriterionValue,
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
from app.services.ahp_engine import calculate_ahp

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
        normalized_values=res.snapshot_data.get("normalized_values", {}),
        weighted_values=res.snapshot_data.get("weighted_values", {}),
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
        select(AHPWeightVersion)
        .options(selectinload(AHPWeightVersion.criteria))
        .where(
            AHPWeightVersion.is_active.is_(True),
            AHPWeightVersion.is_consistent.is_(True),
        )
    )
    if active_ahp is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Belum ada versi bobot AHP yang aktif dan konsisten (CR <= 0.10).",
        )

    if active_ahp.criteria:
        criterion_definitions = [
            {
                "key": criterion.key,
                "name": criterion.name,
                "direction": criterion.direction,
                "weight": criterion.weight,
            }
            for criterion in active_ahp.criteria
        ]
    elif len(active_ahp.pairwise_matrix) == 3:
        criterion_definitions = [
            {
                "key": "broken_lights",
                "name": "Kerusakan Lampu PJU",
                "direction": "max",
                "weight": active_ahp.w_light_damage,
            },
            {
                "key": "dawn_crime_count",
                "name": "Curanmor Dini Hari",
                "direction": "max",
                "weight": active_ahp.w_dawn_crime,
            },
            {
                "key": "boarding_house_count",
                "name": "Kepadatan Indekos",
                "direction": "max",
                "weight": active_ahp.w_boarding_density,
            },
        ]
    else:
        calculated = calculate_ahp(active_ahp.pairwise_matrix)
        criterion_definitions = [
            {
                "key": f"criterion_{index + 1}",
                "name": f"Kriteria {index + 1}",
                "direction": "max",
                "weight": calculated.weights[index],
            }
            for index in range(len(calculated.weights))
        ]
    criterion_keys = [criterion["key"] for criterion in criterion_definitions]
    weights = [float(criterion["weight"]) for criterion in criterion_definitions]
    criteria_directions = (
        payload.criteria_directions
        if payload.criteria_directions is not None
        else [criterion["direction"] for criterion in criterion_definitions]
    )
    if len(criteria_directions) != len(criterion_keys):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Jumlah criteria_directions harus sama dengan jumlah kriteria AHP aktif.",
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
    custom_criterion_keys = set(criterion_keys) - {
        "broken_lights",
        "dawn_crime_count",
        "boarding_house_count",
    }
    dynamic_values: dict[int, dict[str, float]] = {}
    if segments and custom_criterion_keys:
        values = db.scalars(
            select(SegmentCriterionValue).where(
                SegmentCriterionValue.segment_id.in_([segment.id for segment in segments]),
                SegmentCriterionValue.criterion_key.in_(custom_criterion_keys),
            )
        ).all()
        for value in values:
            dynamic_values.setdefault(value.segment_id, {})[
                value.criterion_key
            ] = value.value

    eligible_inputs: list[TOPSISInputItem] = []
    snapshots_by_segment: dict[int, dict] = {}
    ineligible_records: list[tuple[AlleySegment, str]] = []

    for seg in segments:
        obs = seg.observation
        criterion_values: dict[str, float] = dict(dynamic_values.get(seg.id, {}))
        if obs is not None:
            legacy_values = {
                "broken_lights": float(obs.broken_lights),
                "dawn_crime_count": (
                    float(obs.dawn_crime_count)
                    if obs.dawn_crime_count is not None
                    else None
                ),
                "boarding_house_count": float(obs.boarding_house_count),
            }
            criterion_values.update(
                {
                    key: value
                    for key, value in legacy_values.items()
                    if value is not None
                }
            )
        is_eligible, reason = evaluate_segment_eligibility(
            segment=seg,
            observation=obs,
            reference_date=today,
            expiry_days=settings.INSPECTION_EXPIRY_DAYS,
            criteria_keys=criterion_keys,
            criteria_values=criterion_values,
        )
        if obs is not None:
            snapshots_by_segment[seg.id] = {
                "total_lights": obs.total_lights,
                "broken_lights": obs.broken_lights,
                "dawn_crime_count": obs.dawn_crime_count,
                "boarding_house_count": obs.boarding_house_count,
                "criteria_values": criterion_values,
                "inspection_date": obs.inspection_date.isoformat(),
                "data_source": obs.data_source.value,
            }
        else:
            snapshots_by_segment[seg.id] = {}

        if is_eligible and obs is not None:
            eligible_inputs.append(
                TOPSISInputItem(
                    segment_id=seg.id,
                    segment_code=seg.segment_code,
                    broken_lights=obs.broken_lights,
                    dawn_crime_count=obs.dawn_crime_count or 0,
                    boarding_house_count=obs.boarding_house_count,
                    criteria_values=criterion_values,
                )
            )
        else:
            ineligible_records.append((seg, reason or "Tidak memenuhi syarat kelayakan."))

    if not eligible_inputs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak ada segmen gang yang memenuhi syarat kelayakan (eligible) untuk pemeringkatan TOPSIS.",
        )

    try:
        ranked_items = calculate_topsis(
            items=eligible_inputs,
            weights=weights,
            criteria_directions=criteria_directions,
            criterion_keys=criterion_keys,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    weight_map = {
        criterion["key"]: float(criterion["weight"])
        for criterion in criterion_definitions
    }
    weights_snapshot = {
        "criteria": criterion_definitions,
        "weights": weight_map,
        "cr": active_ahp.cr,
        "version_name": active_ahp.version_name,
    }
    if "broken_lights" in weight_map:
        weights_snapshot["w_light_damage"] = weight_map["broken_lights"]
    if "dawn_crime_count" in weight_map:
        weights_snapshot["w_dawn_crime"] = weight_map["dawn_crime_count"]
    if "boarding_house_count" in weight_map:
        weights_snapshot["w_boarding_density"] = weight_map["boarding_house_count"]

    cycle = EvaluationCycle(
        cycle_name=payload.cycle_name.strip(),
        executed_by=current_user.id,
        ahp_version_id=active_ahp.id,
        weights_snapshot=weights_snapshot,
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
                snapshot_data={
                    **snapshots_by_segment[ranked.segment_id],
                    "normalized_values": ranked.normalized_values,
                    "weighted_values": ranked.weighted_values,
                },
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


@router.get("/cycles/latest", response_model=TOPSISCycleDetailResponse)
def get_latest_topsis_cycle(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> TOPSISCycleDetailResponse:
    """Retrieve the latest TOPSIS evaluation cycle ranking results."""
    cycle = db.scalar(
        select(EvaluationCycle)
        .options(
            selectinload(EvaluationCycle.ranking_results).selectinload(
                CycleRankingResult.segment
            )
        )
        .order_by(EvaluationCycle.created_at.desc(), EvaluationCycle.id.desc())
        .limit(1)
    )
    if cycle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Belum ada siklus evaluasi TOPSIS yang pernah dijalankan.",
        )
    return _build_cycle_response(cycle)


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
