"""Authentication and Role-Based Access Control (RBAC) FastAPI dependencies."""

from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.models import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


def _resolve_user_from_token(token: str, db: Session) -> User | None:
    """Resolve active User from either a signed JWT or a frontend seeder session token."""
    if token.startswith("mock-jwt-token-"):
        # Format from frontend actions.ts: mock-jwt-token-<username>-<timestamp>
        remainder = token.removeprefix("mock-jwt-token-")
        username = remainder.rsplit("-", 1)[0]
        user = db.scalar(select(User).where(User.username == username))
        if user is not None and user.is_active:
            return user
        return None

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (ValueError, KeyError, TypeError):
        return None

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        return None
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validate Bearer JWT token and return the active authenticated User."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autentikasi diperlukan (Bearer token tidak ditemukan).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = _resolve_user_from_token(credentials.credentials, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token autentikasi tidak valid atau telah kedaluwarsa.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Return authenticated User if a valid Bearer token is provided, otherwise None."""
    if credentials is None or not credentials.credentials:
        return None
    return _resolve_user_from_token(credentials.credentials, db)


def require_roles(*allowed_roles: UserRole) -> Callable[[User], User]:
    """Dependency factory enforcing RBAC role authorization."""

    def _role_checker(current_user: User = Depends(get_current_user)) -> User:
        if allowed_roles and current_user.role not in allowed_roles:
            allowed_names = ", ".join(role.value for role in allowed_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Peran yang diizinkan: {allowed_names}.",
            )
        return current_user

    return _role_checker
