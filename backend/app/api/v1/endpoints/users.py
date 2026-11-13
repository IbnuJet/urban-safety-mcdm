"""Modul 1: User account management endpoints (ADMIN only)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.security import hash_password
from app.models.models import User, UserRole
from app.schemas.schemas import UserCreateRequest, UserResponse, UserUpdateRequest

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> list[UserResponse]:
    """Return all user accounts (ADMIN only)."""
    users = db.scalars(select(User).order_by(User.id.asc())).all()
    return [UserResponse.model_validate(u) for u in users]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> UserResponse:
    """Create a new user account with assigned role (ADMIN only)."""
    username = payload.username.strip()
    email = payload.email.strip().lower()

    existing_username = db.scalar(select(User).where(User.username == username))
    if existing_username is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{username}' sudah digunakan.",
        )
    existing_email = db.scalar(select(User).where(User.email == email))
    if existing_email is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{email}' sudah terdaftar.",
        )

    user = User(
        username=username,
        email=email,
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> UserResponse:
    """Update user role, full name, or active status (ADMIN only)."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pengguna dengan ID {user_id} tidak ditemukan.",
        )

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)
