"""Modul 7: Worklist proposal and override-audited finalization endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.models import (
    CycleRankingResult,
    CycleStatus,
    EvaluationCycle,
    User,
    UserRole,
    WorklistDecision,
)
from app.schemas.schemas import (
    WorklistCandidateItem,
    WorklistDecisionResponse,
    WorklistDetailResponse,
    WorklistFinalizeRequest,
    WorklistProposeRequest,
    WorklistProposeResponse,
    WorklistSelectedSegmentDetail,
)

router = APIRouter(prefix="/worklists", tags=["Worklists & Override Audit"])

OVERRIDE_REASON_ERROR = (
    "Alasan perubahan wajib diisi (minimal 10 karakter) karena daftar segmen "
    "yang dipilih berbeda dari usulan prioritas sistem."
)


def _get_cycle_with_results(db: Session, cycle_id: int) -> EvaluationCycle:
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


def _to_candidate_item(row: CycleRankingResult) -> WorklistCandidateItem:
    snap = row.snapshot_data or {}
    return WorklistCandidateItem(
        segment_id=row.segment_id,
        segment_code=row.segment.segment_code,
        segment_name=row.segment.name,
        corridor=row.segment.corridor,
        rank=int(row.rank or 0),
        preference_score=float(row.preference_score or 0.0),
        broken_lights=int(snap.get("broken_lights", 0)),
        dawn_crime_count=int(snap.get("dawn_crime_count", 0)),
        boarding_house_count=int(snap.get("boarding_house_count", 0)),
        is_tie_broken=row.is_tie_broken,
    )


@router.post("/cycles/{cycle_id}/propose", response_model=WorklistProposeResponse)
def propose_worklist(
    cycle_id: int,
    payload: WorklistProposeRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.PENANGGUNG_JAWAB_PJU, UserRole.ADMIN)),
) -> WorklistProposeResponse:
    """Return Top-K system-proposed segments and reserve eligible candidates."""
    cycle = _get_cycle_with_results(db, cycle_id)
    eligible = sorted(
        (r for r in cycle.ranking_results if r.is_eligible),
        key=lambda r: r.rank or 10**9,
    )
    if not eligible:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Siklus ini tidak memiliki segmen eligible untuk diusulkan.",
        )

    proposed = [_to_candidate_item(r) for r in eligible[: payload.capacity_quota]]
    reserves = [_to_candidate_item(r) for r in eligible[payload.capacity_quota :]]
    return WorklistProposeResponse(
        cycle_id=cycle.id,
        cycle_name=cycle.cycle_name,
        capacity_quota=payload.capacity_quota,
        total_eligible=len(eligible),
        system_proposed=proposed,
        reserve_candidates=reserves,
    )


@router.post(
    "/cycles/{cycle_id}/finalize",
    response_model=WorklistDecisionResponse,
    status_code=status.HTTP_201_CREATED,
)
def finalize_worklist(
    cycle_id: int,
    payload: WorklistFinalizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.PENANGGUNG_JAWAB_PJU, UserRole.ADMIN)
    ),
) -> WorklistDecisionResponse:
    """Finalize worklist selection, enforcing mandatory override justification."""
    cycle = _get_cycle_with_results(db, cycle_id)
    if (
        cycle.worklist_decision is not None
        or cycle.status == CycleStatus.WORKLIST_FINALIZED
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Daftar kerja untuk siklus {cycle_id} sudah ditetapkan sebelumnya.",
        )

    eligible = sorted(
        (r for r in cycle.ranking_results if r.is_eligible),
        key=lambda r: r.rank or 10**9,
    )
    eligible_ids = {r.segment_id for r in eligible}

    invalid_ids = [
        seg_id
        for seg_id in payload.final_selected_segment_ids
        if seg_id not in eligible_ids
    ]
    if invalid_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Segmen dengan ID {invalid_ids} tidak valid atau tidak berstatus eligible pada siklus ini.",
        )

    system_proposed_ids = [r.segment_id for r in eligible[: payload.capacity_quota]]
    is_overridden = set(payload.final_selected_segment_ids) != set(system_proposed_ids)

    cleaned_reason = (
        payload.override_reason.strip() if payload.override_reason is not None else ""
    )
    if is_overridden and len(cleaned_reason) < 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=OVERRIDE_REASON_ERROR,
        )

    decision = WorklistDecision(
        cycle_id=cycle.id,
        decided_by=current_user.id,
        capacity_quota=payload.capacity_quota,
        system_proposed_segment_ids=system_proposed_ids,
        final_selected_segment_ids=payload.final_selected_segment_ids,
        is_overridden=is_overridden,
        override_reason=cleaned_reason if is_overridden else (cleaned_reason or None),
    )
    cycle.status = CycleStatus.WORKLIST_FINALIZED
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return WorklistDecisionResponse.model_validate(decision)


def build_worklist_detail(
    db: Session, cycle: EvaluationCycle
) -> WorklistDetailResponse:
    """Build detailed finalized worklist comparison including replaced system proposals."""
    decision = cycle.worklist_decision
    if decision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Daftar kerja final untuk siklus {cycle.id} belum ditetapkan.",
        )

    decider = db.get(User, decision.decided_by)
    decided_by_name = decider.full_name if decider else str(decision.decided_by)

    results_by_seg = {r.segment_id: r for r in cycle.ranking_results}
    proposed_set = set(decision.system_proposed_segment_ids)
    selected_set = set(decision.final_selected_segment_ids)

    selected_segments: list[WorklistSelectedSegmentDetail] = []
    for idx, seg_id in enumerate(decision.final_selected_segment_ids, start=1):
        row = results_by_seg.get(seg_id)
        if row is None:
            continue
        snap = row.snapshot_data or {}
        selected_segments.append(
            WorklistSelectedSegmentDetail(
                order_number=idx,
                segment_id=row.segment_id,
                segment_code=row.segment.segment_code,
                segment_name=row.segment.name,
                corridor=row.segment.corridor,
                rank=int(row.rank or 0),
                preference_score=float(row.preference_score or 0.0),
                total_lights=int(snap.get("total_lights", 0)),
                broken_lights=int(snap.get("broken_lights", 0)),
                dawn_crime_count=int(snap.get("dawn_crime_count", 0)),
                boarding_house_count=int(snap.get("boarding_house_count", 0)),
                choice_status=(
                    "USULAN_SISTEM" if seg_id in proposed_set else "PILIHAN_OVERRIDE"
                ),
            )
        )

    replaced_proposed_segments: list[WorklistCandidateItem] = []
    for seg_id in decision.system_proposed_segment_ids:
        if seg_id in selected_set:
            continue
        row = results_by_seg.get(seg_id)
        if row is not None:
            replaced_proposed_segments.append(_to_candidate_item(row))

    return WorklistDetailResponse(
        decision=WorklistDecisionResponse.model_validate(decision),
        decided_by_name=decided_by_name,
        selected_segments=selected_segments,
        replaced_proposed_segments=replaced_proposed_segments,
    )


@router.get("/cycles/{cycle_id}", response_model=WorklistDetailResponse)
def get_cycle_worklist_detail(
    cycle_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> WorklistDetailResponse:
    """Retrieve finalized worklist decision and override comparison for a cycle."""
    cycle = _get_cycle_with_results(db, cycle_id)
    return build_worklist_detail(db, cycle)
