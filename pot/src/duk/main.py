"""FastAPI application factory for the DUK decision API."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
import os

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from duk.crews.runtime import configure_runtime_storage

configure_runtime_storage()

from duk.api.jobs import DecisionJobManager
from duk.api.routes import router
from SlicerAPI.api.v1.routes import generateRouter


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Start bounded decision workers and stop them cleanly at shutdown."""
    app.state.job_manager = DecisionJobManager()
    yield
    app.state.job_manager._executor.shutdown(wait=False, cancel_futures=True)


def create_app(title: str = "DUK Slice Advisor", debug: bool = False) -> FastAPI:
    """Create the documented HTTP service with configurable frontend origins."""
    app = FastAPI(
        title=title,
        version="0.1.0",
        description="Simulated 5G slice decision support with trace-bound explanations.",
        lifespan=lifespan,
        debug=debug,
    )
    origins = [
        value.strip()
        for value in os.getenv(
            "DUK_CORS_ORIGINS",
            "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if value.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", summary="Service Health & Root Status")
    async def root():
        """Root status and navigation for DUK Slice Advisor."""
        return {
            "service": title,
            "version": "0.1.0",
            "status": "online",
            "docs": "/docs",
            "redoc": "/redoc",
            "endpoints": {
                "duk_api": "/api/v1",
                "presets": "/api/v1/presets",
                "generate": "/api/v1/generate",
                "legacy_generate": "/v1/generate",
            },
            "frontend": "http://localhost:5173",
        }

    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon():
        """Empty 204 response for browser favicon requests."""
        return Response(status_code=204)

    @app.get("/api", include_in_schema=False)
    @app.get("/api/", include_in_schema=False)
    async def api_root():
        """Root info for the API namespace."""
        return {
            "service": title,
            "status": "online",
            "versions": ["/api/v1"],
            "docs": "/docs",
        }

    @app.get("/v1", include_in_schema=False)
    @app.get("/v1/", include_in_schema=False)
    async def v1_root():
        """Root info for the legacy v1 namespace."""
        return {
            "service": title,
            "status": "online",
            "endpoints": {
                "generate": "/v1/generate",
            },
            "docs": "/docs",
        }

    app.include_router(router, prefix="/api/v1")
    app.include_router(generateRouter, prefix="/v1/generate")
    return app


app = create_app()
