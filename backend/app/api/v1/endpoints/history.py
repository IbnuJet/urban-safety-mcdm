"""Modul 8: Evaluation cycle history and CSV worklist export endpoints."""

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.models import CycleRankingResult, EvaluationCycle, User
from app.schemas.schemas import CycleHistorySummaryResponse

router = APIRouter(prefix="/history", tags=["History & Export"])


@router.get("/cycles", response_model=list[CycleHistorySummaryResponse])
def list_cycle_history(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CycleHistorySummaryResponse]:
    """List historical TOPSIS evaluation cycles with worklist and override summary."""
    cycles = db.scalars(
        select(EvaluationCycle)
        .options(
            selectinload(EvaluationCycle.executor),
            selectinload(EvaluationCycle.ahp_version),
            selectinload(EvaluationCycle.ranking_results),
            selectinload(EvaluationCycle.worklist_decision),
        )
        .order_by(EvaluationCycle.created_at.desc(), EvaluationCycle.id.desc())
    ).all()

    summaries: list[CycleHistorySummaryResponse] = []
    for cycle in cycles:
        eligible_count = sum(1 for r in cycle.ranking_results if r.is_eligible)
        ineligible_count = len(cycle.ranking_results) - eligible_count
        wd = cycle.worklist_decision
        summaries.append(
            CycleHistorySummaryResponse(
                cycle_id=cycle.id,
                cycle_name=cycle.cycle_name,
                created_at=cycle.created_at,
                executed_by=cycle.executed_by,
                executed_by_username=cycle.executor.username,
                ahp_version_id=cycle.ahp_version_id,
                ahp_version_name=cycle.ahp_version.version_name,
                weights_snapshot=cycle.weights_snapshot,
                status=cycle.status,
                total_segments=len(cycle.ranking_results),
                eligible_count=eligible_count,
                ineligible_count=ineligible_count,
                is_overridden=wd.is_overridden if wd else None,
                capacity_quota=wd.capacity_quota if wd else None,
                finalized_at=wd.finalized_at if wd else None,
            )
        )
    return summaries


@router.get("/cycles/{cycle_id}/export-csv")
def export_cycle_worklist_csv(
    cycle_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> StreamingResponse:
    """Export the finalized repair worklist of an evaluation cycle to CSV."""
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

    decision = cycle.worklist_decision
    if decision is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Daftar kerja final untuk siklus {cycle_id} belum ditetapkan.",
        )

    decider = db.get(User, decision.decided_by)
    decider_name = decider.full_name if decider else str(decision.decided_by)
    finalized_str = decision.finalized_at.isoformat()

    results_by_seg = {r.segment_id: r for r in cycle.ranking_results}
    proposed_set = set(decision.system_proposed_segment_ids)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "No_Urut_Kerja",
            "Peringkat_TOPSIS",
            "Kode_Segmen",
            "Nama_Gang",
            "Koridor",
            "Skor_Preferensi",
            "Lampu_Terpasang",
            "Lampu_Mati",
            "Curanmor_Dini_Hari",
            "Jumlah_Indekos",
            "Tanggal_Inspeksi",
            "Status_Pilihan",
            "Alasan_Override",
            "Ditetapkan_Oleh",
            "Tanggal_Penetapan",
        ]
    )

    for order_idx, seg_id in enumerate(decision.final_selected_segment_ids, start=1):
        row = results_by_seg.get(seg_id)
        if row is None:
            continue
        snap = row.snapshot_data or {}
        choice_status = (
            "USULAN_SISTEM" if seg_id in proposed_set else "PILIHAN_OVERRIDE"
        )
        writer.writerow(
            [
                order_idx,
                row.rank,
                row.segment.segment_code,
                row.segment.name,
                row.segment.corridor.value,
                f"{row.preference_score:.6f}" if row.preference_score is not None else "",
                snap.get("total_lights", ""),
                snap.get("broken_lights", ""),
                snap.get("dawn_crime_count", ""),
                snap.get("boarding_house_count", ""),
                snap.get("inspection_date", ""),
                choice_status,
                decision.override_reason or "",
                decider_name,
                finalized_str,
            ]
        )

    buffer.seek(0)
    headers = {
        "Content-Disposition": f'attachment; filename="worklist_cycle_{cycle_id}.csv"'
    }
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )
