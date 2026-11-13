"""FastAPI application entrypoint with CORS middleware and DB lifecycle."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Ensure database tables exist on application startup."""
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "REST API Decision Support System (DSS) Prioritas Perbaikan PJU & "
        "Mitigasi Kriminalitas Dini Hari di Kecamatan Jatinangor (Metode AHP + TOPSIS)."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Simple healthcheck endpoint."""
    return {"status": "ok", "service": settings.APP_NAME, "version": settings.APP_VERSION}
