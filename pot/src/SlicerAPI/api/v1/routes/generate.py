"""SlicerAPI endpoints that submit and observe CrewAI-backed DUK decisions."""

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from typing import Any

from duk.api.jobs import DecisionJobManager
from duk.api.routes import get_decision_status, get_job_manager
from SlicerAPI.models.generate import GenerateAccepted, GenerateRequest, GenerateResponse

router = APIRouter(tags=["SlicerAPI"])


@router.get("", summary="SlicerAPI Status & Health Check")
@router.get("/", summary="SlicerAPI Status & Health Check", include_in_schema=False)
async def get_slicerapi_info() -> dict[str, Any]:
    """Health and discovery endpoint for the legacy SlicerAPI route."""
    return {
        "status": "online",
        "service": "SlicerAPI",
        "endpoint": "/v1/generate",
        "method": "POST",
        "description": "Submit a 5G slice requirements request via POST /v1/generate. See /docs for schema.",
    }


@router.post("", response_model=GenerateAccepted, status_code=status.HTTP_202_ACCEPTED)
@router.post("/", response_model=GenerateAccepted, status_code=status.HTTP_202_ACCEPTED, include_in_schema=False)
async def generate(payload: GenerateRequest, request: Request) -> GenerateAccepted:
    """Submit a typed SlicerAPI request to the shared CrewAI job manager."""
    try:
        decision_request = payload.to_decision_request()
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors(include_url=False)) from exc
    job_id = get_job_manager(request).submit(decision_request)
    return GenerateAccepted(
        job_id=job_id,
        status="queued",
        status_url=f"/v1/generate/{job_id}",
        events_url=f"/v1/generate/{job_id}/events",
    )


@router.get("/{job_id}", response_model=GenerateResponse)
@router.get("/{job_id}/", response_model=GenerateResponse, include_in_schema=False)
async def get_status(job_id: str, request: Request) -> GenerateResponse:
    """Return job progress and the same typed decision result as the DUK API."""
    result = await get_decision_status(job_id, request)
    return GenerateResponse.model_validate(result.model_dump())


@router.get("/{job_id}/events")
@router.get("/{job_id}/events/", include_in_schema=False)
async def stream_events(job_id: str, request: Request) -> StreamingResponse:
    """Stream progress for a submitted decision as server-sent events."""
    manager: DecisionJobManager = get_job_manager(request)
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


__all__ = ["router"]
