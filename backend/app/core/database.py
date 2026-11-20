"""Database engine, session factory, and declarative base (Supabase PostgreSQL)."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


def _build_engine():
    return create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
    )


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy ORM models."""


def get_db() -> Generator[Session, None, None]:
    """Yield a database session per request and ensure cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create database tables if they do not exist."""
    from app.models import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
