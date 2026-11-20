"""Modul 4: AHP weighting, consistency ratio validation, and versioning endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.models import AHPVersionCriterion, AHPWeightVersion, User, UserRole
from app.schemas.schemas import (
    AHPCriterionWeight,
    AHPCalculateRequest,
    AHPCalculateResponse,
    AHPVersionCreateRequest,
    AHPVersionResponse,
)
from app.services.ahp_engine import calculate_ahp

router = APIRouter(prefix="/ahp", tags=["AHP Weighting"])

DEFAULT_CRITERIA = (
    ("broken_lights", "Kerusakan Lampu PJU"),
    ("dawn_crime_count", "Curanmor Dini Hari"),
    ("boarding_house_count", "Kepadatan Indekos"),
)


def _legacy_weights(criteria: list[AHPCriterionWeight]) -> dict[str, float | None]:
    weights = {criterion.key: criterion.weight for criterion in criteria}
    return {
        "w_light_damage": weights.get("broken_lights"),
        "w_dawn_crime": weights.get("dawn_crime_count"),
        "w_boarding_density": weights.get("boarding_house_count"),
    }


def _version_criteria(version: AHPWeightVersion) -> list[AHPCriterionWeight]:
    if version.criteria:
        return [
            AHPCriterionWeight(
                key=item.key,
                name=item.name,
                direction=item.direction,
                weight=item.weight,
            )
            for item in version.criteria
        ]

    n = len(version.pairwise_matrix)
    if n == 3:
        keys_and_names = DEFAULT_CRITERIA
        legacy_weights = [
            version.w_light_damage,
            version.w_dawn_crime,
            version.w_boarding_density,
        ]
    else:
        keys_and_names = tuple(
            (f"criterion_{index + 1}", f"Kriteria {index + 1}") for index in range(n)
        )
        legacy_weights = calculate_ahp(version.pairwise_matrix).weights
    return [
        AHPCriterionWeight(
            key=key,
            name=name,
            direction="max",
            weight=legacy_weights[index],
        )
        for index, (key, name) in enumerate(keys_and_names)
    ]


def _version_response(version: AHPWeightVersion) -> AHPVersionResponse:
    criteria = _version_criteria(version)
    return AHPVersionResponse(
        id=version.id,
        version_name=version.version_name,
        created_by=version.created_by,
        pairwise_matrix=version.pairwise_matrix,
        criteria=criteria,
        weights=[criterion.weight for criterion in criteria],
        **_legacy_weights(criteria),
        lambda_max=version.lambda_max,
        ci=version.ci,
        ri=version.ri,
        cr=version.cr,
        is_consistent=version.is_consistent,
        is_active=version.is_active,
        created_at=version.created_at,
    )


@router.post("/calculate-preview", response_model=AHPCalculateResponse)
def preview_ahp(
    payload: AHPCalculateRequest,
    _: User = Depends(require_roles(UserRole.PENILAI, UserRole.ADMIN)),
) -> AHPCalculateResponse:
    """Calculate AHP priority weights and CR without persisting to database."""
    assert payload.pairwise_matrix is not None
    try:
        result = calculate_ahp(payload.pairwise_matrix)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    criteria = [
        AHPCriterionWeight(
            key=criterion.key,
            name=criterion.name,
            direction=criterion.direction,
            weight=result.weights[index],
        )
        for index, criterion in enumerate(payload.criteria or [])
    ]
    return AHPCalculateResponse(
        pairwise_matrix=result.pairwise_matrix,
        criteria=criteria,
        weights=result.weights,
        **_legacy_weights(criteria),
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
    assert payload.pairwise_matrix is not None
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

    criterion_weights = [
        AHPCriterionWeight(
            key=criterion.key,
            name=criterion.name,
            direction=criterion.direction,
            weight=result.weights[index],
        )
        for index, criterion in enumerate(payload.criteria or [])
    ]
    legacy_weights = _legacy_weights(criterion_weights)
    version = AHPWeightVersion(
        version_name=payload.version_name.strip(),
        created_by=current_user.id,
        pairwise_matrix=result.pairwise_matrix,
        w_light_damage=legacy_weights["w_light_damage"] or 0.0,
        w_dawn_crime=legacy_weights["w_dawn_crime"] or 0.0,
        w_boarding_density=legacy_weights["w_boarding_density"] or 0.0,
        lambda_max=result.lambda_max,
        ci=result.ci,
        ri=result.ri,
        cr=result.cr,
        is_consistent=result.is_consistent,
        is_active=should_activate,
    )
    db.add(version)
    db.flush()
    db.add_all(
        [
            AHPVersionCriterion(
                ahp_version_id=version.id,
                key=criterion.key,
                name=criterion.name,
                direction=criterion.direction,
                weight=criterion.weight,
                position=index,
            )
            for index, criterion in enumerate(criterion_weights)
        ]
    )
    db.commit()
    db.refresh(version)
    return _version_response(version)


@router.get("/versions", response_model=list[AHPVersionResponse])
def list_ahp_versions(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AHPVersionResponse]:
    """List all saved AHP weight versions ordered from newest to oldest."""
    versions = db.scalars(
        select(AHPWeightVersion)
        .options(selectinload(AHPWeightVersion.criteria))
        .order_by(AHPWeightVersion.created_at.desc(), AHPWeightVersion.id.desc())
    ).all()
    return [_version_response(version) for version in versions]


@router.get("/criteria", response_model=list[AHPCriterionWeight])
def get_active_criteria(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AHPCriterionWeight]:
    """Return criteria configured by the active AHP version."""
    version = db.scalar(
        select(AHPWeightVersion)
        .options(selectinload(AHPWeightVersion.criteria))
        .where(AHPWeightVersion.is_active.is_(True))
        .limit(1)
    )
    return _version_criteria(version) if version is not None else []


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
    return _version_response(version)
