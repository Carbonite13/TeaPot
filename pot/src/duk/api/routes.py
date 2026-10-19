"""FastAPI routes for asynchronous decisions, status, presets, and SSE progress."""

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from duk.api.jobs import DecisionJobManager
from duk.schemas.api import GenerateRequest, JobAccepted, JobStatus
from duk.tools.presets import PresetLoader

router = APIRouter()


def get_job_manager(request: Request) -> DecisionJobManager:
    """Read or lazy-initialize the application-scoped job manager from FastAPI state."""
    manager = getattr(request.app.state, "job_manager", None)
    if manager is None:
        manager = DecisionJobManager()
        request.app.state.job_manager = manager
    return manager


@router.get("", summary="DUK API v1 Status")
@router.get("/", summary="DUK API v1 Status", include_in_schema=False)
async def api_v1_index():
    """Return status and navigation for DUK API v1."""
    return {
        "status": "online",
        "version": "v1",
        "endpoints": {
            "presets": "/api/v1/presets",
            "generate": "/api/v1/generate",
        },
        "docs": "/docs",
    }


@router.post("/generate", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
@router.post("/generate/", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED, include_in_schema=False)
async def generate(payload: GenerateRequest, request: Request) -> JobAccepted:
    """Kick off a CrewAI Flow and return its polling and event-stream URLs."""
    job_id = get_job_manager(request).submit(payload)
    return JobAccepted(
        job_id=job_id,
        status="queued",
        status_url=f"/api/v1/generate/{job_id}",
        events_url=f"/api/v1/generate/{job_id}/events",
    )


@router.get("/generate", summary="Generate Endpoint Information")
@router.get("/generate/", summary="Generate Endpoint Information", include_in_schema=False)
async def generate_info():
    """Return usage information for the generate endpoint."""
    return {
        "endpoint": "/api/v1/generate",
        "method": "POST",
        "description": "Submit a 5G slice decision request via POST. See /docs for payload schema.",
    }


@router.get("/generate/{job_id}", response_model=JobStatus)
@router.get("/generate/{job_id}/", response_model=JobStatus, include_in_schema=False)
async def get_decision_status(job_id: str, request: Request) -> JobStatus:
    """Poll the current progress and final result for one decision job."""
    result = get_job_manager(request).get(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Decision job not found")
    return result


@router.get("/generate/{job_id}/events")
@router.get("/generate/{job_id}/events/", include_in_schema=False)
async def stream_decision_events(job_id: str, request: Request) -> StreamingResponse:
    """Stream progress events as server-sent events until the job is terminal."""
    manager = get_job_manager(request)
    if manager.get(job_id) is None:
        raise HTTPException(status_code=404, detail="Decision job not found")

    async def event_stream() -> AsyncIterator[str]:
        cursor = 0
        while True:
            if await request.is_disconnected():
                break
            snapshot = manager.events(job_id, cursor)
            if snapshot is None:
                break
            events, current_status, cursor = snapshot
            for event in events:
                yield f"id: {event.sequence}\nevent: progress\ndata: {event.model_dump_json()}\n\n"
            if current_status in {"completed", "failed"} and not events:
                yield f"event: done\ndata: {json.dumps({'status': current_status})}\n\n"
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@router.get("/presets", response_model=list[dict[str, str]])
@router.get("/presets/", response_model=list[dict[str, str]], include_in_schema=False)
async def list_presets() -> list[dict[str, str]]:
    """Return the available validated preset names and descriptions."""
    loader = PresetLoader()
    return [
        {"name": preset.name, "version": preset.version, "description": preset.description}
        for preset in (loader.load(path.stem) for path in sorted(loader.directory.glob("*.json")))
    ]
