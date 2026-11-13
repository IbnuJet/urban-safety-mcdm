"""Modul 3: Field observation entry and two-step CSV staging/validation endpoints."""

from datetime import date
from typing import Any

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import settings
from app.core.database import get_db
from app.models.models import (
    AlleySegment,
    BatchStatus,
    CSVImportBatch,
    DataSourceEnum,
    SegmentObservation,
    User,
    UserRole,
)
from app.schemas.schemas import (
    CSVConfirmRequest,
    CSVConfirmResponse,
    CSVUploadPreviewResponse,
    CSVValidatedRow,
    ObservationBriefResponse,
    ObservationFormRequest,
    ObservationFormResponse,
)
from app.services.csv_validator import validate_csv_observations

router = APIRouter(prefix="/observations", tags=["Observations & CSV Import"])


def _upsert_observation(
    db: Session,
    segment_id: int,
    total_lights: int,
    broken_lights: int,
    dawn_crime_count: int | None,
    boarding_house_count: int,
    inspection_date: date,
    data_source: DataSourceEnum,
    updated_by: int,
) -> SegmentObservation:
    obs = db.scalar(
        select(SegmentObservation).where(SegmentObservation.segment_id == segment_id)
    )
    if obs is None:
        obs = SegmentObservation(
            segment_id=segment_id,
            total_lights=total_lights,
            broken_lights=broken_lights,
            dawn_crime_count=dawn_crime_count,
            boarding_house_count=boarding_house_count,
            inspection_date=inspection_date,
            data_source=data_source,
            updated_by=updated_by,
        )
        db.add(obs)
    else:
        obs.total_lights = total_lights
        obs.broken_lights = broken_lights
        obs.dawn_crime_count = dawn_crime_count
        obs.boarding_house_count = boarding_house_count
        obs.inspection_date = inspection_date
        obs.data_source = data_source
        obs.updated_by = updated_by
    return obs


@router.post("/form", response_model=ObservationFormResponse)
def submit_observation_form(
    payload: ObservationFormRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.OPERATOR, UserRole.ADMIN)),
) -> ObservationFormResponse:
    """Create or update a segment observation via manual form with validation checks."""
    segment: AlleySegment | None = None
    if payload.segment_id is not None:
        segment = db.get(AlleySegment, payload.segment_id)
    elif payload.segment_code is not None:
        code = payload.segment_code.strip().upper()
        segment = db.scalar(
            select(AlleySegment).where(AlleySegment.segment_code == code)
        )

    if segment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="UNKNOWN_SEGMENT_CODE: Segmen gang tidak ditemukan.",
        )

    warnings: list[str] = []
    age_days = (date.today() - payload.inspection_date).days
    if age_days > settings.INSPECTION_EXPIRY_DAYS:
        warnings.append(
            f"EXPIRED_INSPECTION_DATE: Tanggal inspeksi sudah berusia {age_days} hari (melebihi {settings.INSPECTION_EXPIRY_DAYS} hari)."
        )
    if payload.dawn_crime_count is None:
        warnings.append(
            "INCOMPLETE_CRIME_DATA: Nilai dawn_crime_count kosong; segmen akan tidak layak evaluasi TOPSIS sampai dilengkapi."
        )

    obs = _upsert_observation(
        db=db,
        segment_id=segment.id,
        total_lights=payload.total_lights,
        broken_lights=payload.broken_lights,
        dawn_crime_count=payload.dawn_crime_count,
        boarding_house_count=payload.boarding_house_count,
        inspection_date=payload.inspection_date,
        data_source=DataSourceEnum.MANUAL_FORM,
        updated_by=current_user.id,
    )
    db.commit()
    db.refresh(obs)

    return ObservationFormResponse(
        observation=ObservationBriefResponse.model_validate(obs),
        warnings=warnings,
    )


@router.post(
    "/upload-csv",
    response_model=CSVUploadPreviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_csv_preview(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.OPERATOR, UserRole.ADMIN)),
) -> CSVUploadPreviewResponse:
    """Upload a CSV file, run pre-commit validations, and store a staging batch."""
    filename = file.filename or "uploaded_observations.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File yang diunggah harus berformat .csv.",
        )

    raw_bytes = await file.read()
    known_codes = set(db.scalars(select(AlleySegment.segment_code)).all())

    try:
        summary = validate_csv_observations(
            csv_bytes=raw_bytes,
            known_segment_codes=known_codes,
            reference_date=date.today(),
            expiry_days=settings.INSPECTION_EXPIRY_DAYS,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    batch = CSVImportBatch(
        uploaded_by=current_user.id,
        filename=filename,
        status=BatchStatus.PENDING_CONFIRMATION,
        rows_payload=summary.rows,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    return CSVUploadPreviewResponse(
        batch_id=batch.id,
        filename=batch.filename,
        status=batch.status,
        total_rows=summary.total_rows,
        valid_rows=summary.valid_rows,
        warning_rows=summary.warning_rows,
        error_rows=summary.error_rows,
        rows=[CSVValidatedRow.model_validate(r) for r in summary.rows],
        created_at=batch.created_at,
    )


@router.post("/batches/{batch_id}/confirm", response_model=CSVConfirmResponse)
def confirm_csv_batch(
    batch_id: str,
    payload: CSVConfirmRequest = Body(default_factory=CSVConfirmRequest),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.OPERATOR, UserRole.ADMIN)),
) -> CSVConfirmResponse:
    """Confirm and commit valid/corrected rows from staging into segment_observations."""
    batch = db.get(CSVImportBatch, batch_id)
    if batch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch impor CSV '{batch_id}' tidak ditemukan.",
        )
    if batch.status != BatchStatus.PENDING_CONFIRMATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch '{batch_id}' berstatus {batch.status.value} dan tidak dapat dikonfirmasi lagi.",
        )

    segment_map = {
        seg.segment_code: seg for seg in db.scalars(select(AlleySegment)).all()
    }
    corrections_by_row = {corr.row_number: corr for corr in payload.corrections}

    rows_to_commit: list[dict[str, Any]] = []
    skipped_error_count = 0
    seen_codes: set[str] = set()
    updated_payload: list[dict[str, Any]] = []

    for row in batch.rows_payload:
        row_num = int(row["row_number"])
        if row_num in corrections_by_row:
            corr = corrections_by_row[row_num]
            code = corr.segment_code.strip().upper()
            if code not in segment_map:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Baris {row_num}: segment_code '{code}' tidak terdaftar.",
                )
            issues: list[dict[str, str]] = []
            age_days = (date.today() - corr.inspection_date).days
            if age_days > settings.INSPECTION_EXPIRY_DAYS:
                issues.append(
                    {
                        "code": "EXPIRED_INSPECTION_DATE",
                        "severity": "WARNING",
                        "message": f"Tanggal inspeksi kedaluwarsa ({age_days} hari).",
                    }
                )
            if corr.dawn_crime_count is None:
                issues.append(
                    {
                        "code": "INCOMPLETE_CRIME_DATA",
                        "severity": "WARNING",
                        "message": "Data curanmor kosong.",
                    }
                )
            row_status = "WARNING" if issues else "VALID"
            normalized_row = {
                "row_number": row_num,
                "segment_code": code,
                "total_lights": corr.total_lights,
                "broken_lights": corr.broken_lights,
                "dawn_crime_count": corr.dawn_crime_count,
                "boarding_house_count": corr.boarding_house_count,
                "inspection_date": corr.inspection_date.isoformat(),
                "status": row_status,
                "issues": issues,
                "messages": [f"[{i['code']}] {i['message']}" for i in issues],
            }
            updated_payload.append(normalized_row)
            candidate = normalized_row
        else:
            updated_payload.append(row)
            candidate = row

        row_status = candidate["status"]
        if row_status == "ERROR":
            skipped_error_count += 1
            continue
        if row_status == "WARNING" and not payload.include_warnings:
            skipped_error_count += 1
            continue

        code = str(candidate["segment_code"]).strip().upper()
        if code in seen_codes:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Duplikat kode segmen '{code}' saat konfirmasi batch.",
            )
        seen_codes.add(code)
        rows_to_commit.append(candidate)

    committed_codes: list[str] = []
    for item in rows_to_commit:
        code = str(item["segment_code"]).strip().upper()
        segment = segment_map.get(code)
        if segment is None:
            skipped_error_count += 1
            continue
        _upsert_observation(
            db=db,
            segment_id=segment.id,
            total_lights=int(item["total_lights"]),
            broken_lights=int(item["broken_lights"]),
            dawn_crime_count=(
                int(item["dawn_crime_count"])
                if item["dawn_crime_count"] is not None
                else None
            ),
            boarding_house_count=int(item["boarding_house_count"]),
            inspection_date=date.fromisoformat(str(item["inspection_date"])),
            data_source=DataSourceEnum.CSV_IMPORT,
            updated_by=current_user.id,
        )
        committed_codes.append(code)

    batch.rows_payload = updated_payload
    batch.status = BatchStatus.CONFIRMED
    db.commit()

    return CSVConfirmResponse(
        batch_id=batch.id,
        status=batch.status,
        committed_count=len(committed_codes),
        skipped_error_count=skipped_error_count,
        committed_segment_codes=committed_codes,
    )
