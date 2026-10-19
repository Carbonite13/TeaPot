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
    """Read the application-scoped job manager from FastAPI state."""
    return request.app.state.job_manager


@router.post("/generate", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
async def generate(payload: GenerateRequest, request: Request) -> JobAccepted:
    """Kick off a CrewAI Flow and return its polling and event-stream URLs."""
    job_id = get_job_manager(request).submit(payload)
    return JobAccepted(
        job_id=job_id,
        status="queued",
        status_url=f"/api/v1/generate/{job_id}",
        events_url=f"/api/v1/generate/{job_id}/events",
    )


@router.get("/generate/{job_id}", response_model=JobStatus)
async def get_decision_status(job_id: str, request: Request) -> JobStatus:
    """Poll the current progress and final result for one decision job."""
    result = get_job_manager(request).get(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Decision job not found")
    return result


@router.get("/generate/{job_id}/events")
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
async def list_presets() -> list[dict[str, str]]:
    """Return the available validated preset names and descriptions."""
    loader = PresetLoader()
    return [
        {"name": preset.name, "version": preset.version, "description": preset.description}
        for preset in (loader.load(path.stem) for path in sorted(loader.directory.glob("*.json")))
    ]
