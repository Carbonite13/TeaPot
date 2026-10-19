"""FastAPI application factory for the DUK decision API."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from duk.api.jobs import DecisionJobManager
from duk.api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Start bounded decision workers and stop them cleanly at shutdown."""
    app.state.job_manager = DecisionJobManager()
    yield
    app.state.job_manager._executor.shutdown(wait=False, cancel_futures=True)


def create_app() -> FastAPI:
    """Create the documented HTTP service with configurable frontend origins."""
    app = FastAPI(
        title="DUK Slice Advisor",
        version="0.1.0",
        description="Simulated 5G slice decision support with trace-bound explanations.",
        lifespan=lifespan,
    )
    origins = [value.strip() for value in os.getenv("DUK_CORS_ORIGINS", "http://localhost:5173").split(",") if value.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Last-Event-ID"],
    )
    app.include_router(router, prefix="/api/v1")
    return app


app = create_app()
