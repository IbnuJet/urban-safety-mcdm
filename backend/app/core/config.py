"""Application configuration loaded from environment variables (Supabase PostgreSQL)."""

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Application settings using Pydantic v2 BaseSettings."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_NAME: str = "DSS Prioritas Perbaikan PJU & Mitigasi Kriminalitas Dini Hari Jatinangor"
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    DATABASE_URL: str

    JWT_SECRET_KEY: str = "dss-jatinangor-dev-secret-key-change-in-production-32chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    INSPECTION_EXPIRY_DAYS: int = 90

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_supabase_database_url(cls, value: str) -> str:
        """Ensure DATABASE_URL points to PostgreSQL / Supabase."""
        if not value or not isinstance(value, str):
            raise ValueError("DATABASE_URL wajib diisi dengan koneksi PostgreSQL Supabase.")
        cleaned = value.strip()
        if cleaned.startswith("postgres://"):
            cleaned = cleaned.replace("postgres://", "postgresql+psycopg://", 1)
        elif cleaned.startswith("postgresql://"):
            cleaned = cleaned.replace("postgresql://", "postgresql+psycopg://", 1)
        if not cleaned.startswith("postgresql"):
            raise ValueError(
                "Backend hanya menggunakan database PostgreSQL Supabase (bukan SQLite lokal)."
            )
        return cleaned

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        """Support comma-separated CORS origins in addition to JSON lists."""
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                import json

                return json.loads(stripped)
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings instance."""
    return Settings()


settings = get_settings()
