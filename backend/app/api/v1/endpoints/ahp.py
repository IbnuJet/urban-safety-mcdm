"""Modul 4: AHP weighting, consistency ratio validation, and versioning endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.models import AHPWeightVersion, User, UserRole
from app.schemas.schemas import (
    AHPCalculateRequest,
    AHPCalculateResponse,
    AHPVersionCreateRequest,
    AHPVersionResponse,
)
from app.services.ahp_engine import calculate_ahp

router = APIRouter(prefix="/ahp", tags=["AHP Weighting"])


@router.post("/calculate-preview", response_model=AHPCalculateResponse)
def preview_ahp(
    payload: AHPCalculateRequest,
    _: User = Depends(require_roles(UserRole.PENILAI, UserRole.ADMIN)),
) -> AHPCalculateResponse:
    """Calculate AHP priority weights and CR without persisting to database."""
    try:
        result = calculate_ahp(payload.pairwise_matrix)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return AHPCalculateResponse(
        pairwise_matrix=result.pairwise_matrix,
        w_light_damage=result.w_light_damage,
        w_dawn_crime=result.w_dawn_crime,
        w_boarding_density=result.w_boarding_density,
        lambda_max=result.lambda_max,
        ci=result.ci,
        ri=result.ri,
        cr=result.cr,
        is_consistent=result.is_consistent,
    )


@router.post(
    "/versions",
    response_model=AHPVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_ahp_version(
    payload: AHPVersionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PENILAI, UserRole.ADMIN)),
) -> AHPVersionResponse:
    """Calculate and store an AHP weight version; activate only if CR <= 0.10."""
    try:
        result = calculate_ahp(payload.pairwise_matrix)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    should_activate = bool(payload.activate_immediately and result.is_consistent)
    if should_activate:
        db.execute(update(AHPWeightVersion).values(is_active=False))

    version = AHPWeightVersion(
        version_name=payload.version_name.strip(),
        created_by=current_user.id,
        pairwise_matrix=result.pairwise_matrix,
        w_light_damage=result.w_light_damage,
        w_dawn_crime=result.w_dawn_crime,
        w_boarding_density=result.w_boarding_density,
        lambda_max=result.lambda_max,
        ci=result.ci,
        ri=result.ri,
        cr=result.cr,
        is_consistent=result.is_consistent,
        is_active=should_activate,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return AHPVersionResponse.model_validate(version)


@router.get("/versions", response_model=list[AHPVersionResponse])
def list_ahp_versions(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AHPVersionResponse]:
    """List all saved AHP weight versions ordered from newest to oldest."""
    versions = db.scalars(
        select(AHPWeightVersion).order_by(
            AHPWeightVersion.created_at.desc(), AHPWeightVersion.id.desc()
        )
    ).all()
    return [AHPVersionResponse.model_validate(v) for v in versions]


@router.patch("/versions/{version_id}/activate", response_model=AHPVersionResponse)
def activate_ahp_version(
    version_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.PENILAI, UserRole.ADMIN)),
) -> AHPVersionResponse:
    """Activate an existing consistent AHP weight version (rejects CR > 0.10 with 400)."""
    version = db.get(AHPWeightVersion, version_id)
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Versi bobot AHP dengan ID {version_id} tidak ditemukan.",
        )
    if not version.is_consistent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Aktivasi ditolak: Versi bobot '{version.version_name}' tidak konsisten (CR={version.cr:.4f} > 0.10).",
        )

    db.execute(update(AHPWeightVersion).values(is_active=False))
    version.is_active = True
    db.commit()
    db.refresh(version)
    return AHPVersionResponse.model_validate(version)
