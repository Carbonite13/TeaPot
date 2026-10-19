"""Threaded decision jobs with progress snapshots for polling and SSE clients."""

import asyncio
import json
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any

import structlog
from pydantic import ValidationError

from duk.flow import DecisionFlow
from duk.schemas.api import DecisionResult, GenerateRequest, JobStatus, ProgressEvent

logger = structlog.get_logger(__name__)


class _Job:
    """Mutable thread-safe state for one request."""

    def __init__(self, job_id: str) -> None:
        """Initialize a queued job without request-sensitive log output."""
        self.job_id = job_id
        self.status = "queued"
        self.progress: list[ProgressEvent] = []
        self.result: DecisionResult | None = None
        self.error: dict[str, Any] | None = None
        self.lock = threading.Lock()


class DecisionJobManager:
    """Run CrewAI Flow decisions in a bounded thread pool and expose progress."""

    def __init__(self, max_workers: int = 4) -> None:
        """Create a bounded executor for the synchronous CrewAI Flow runtime."""
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="duk-decision")
        self._jobs: dict[str, _Job] = {}
        self._lock = threading.Lock()

    def submit(self, request: GenerateRequest) -> str:
        """Queue one validated request and return its opaque job id immediately."""
        job_id = uuid.uuid4().hex
        job = _Job(job_id)
        with self._lock:
            self._jobs[job_id] = job
        self._executor.submit(self._run, job, request.model_dump(mode="json"))
        return job_id

    def _progress(self, job: _Job, status: str, message: str) -> None:
        """Record one stage event and update the externally visible job status."""
        with job.lock:
            job.status = status
            job.progress.append(ProgressEvent(
                sequence=len(job.progress) + 1,
                status=status,
                message=message,
                timestamp=datetime.now(UTC).isoformat(),
            ))

    def _run(self, job: _Job, request_data: dict[str, Any]) -> None:
        """Execute a Flow and store either its typed result or safe error details."""
        self._progress(job, "started", "Decision flow started.")
        try:
            flow = DecisionFlow(
                suppress_flow_events=True,
                tracing=False,
                progress_callback=lambda status, message: self._progress(job, status, message),
            )
            asyncio.run(flow.run_pipeline(request_data))
            job.result = DecisionResult.model_validate(flow.state.final_data)
            self._progress(job, "completed", "Decision is ready.")
        except ValidationError as exc:
            job.error = {"type": "validation_error", "details": exc.errors(include_url=False)}
            self._progress(job, "failed", "Input validation failed.")
        except FileNotFoundError as exc:
            job.error = {"type": "not_found", "message": str(exc)}
            self._progress(job, "failed", "A requested preset or resource was not found.")
        except Exception as exc:
            logger.exception("decision_job_failed", job_id=job.job_id, error_type=type(exc).__name__)
            job.error = {"type": "decision_failed", "message": "The decision could not be completed."}
            self._progress(job, "failed", "The decision could not be completed.")

    def get(self, job_id: str) -> JobStatus | None:
        """Return a stable snapshot of one job or None when it does not exist."""
        with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            return None
        with job.lock:
            return JobStatus(
                job_id=job.job_id,
                status=job.status,
                progress=list(job.progress),
                result=job.result,
                error=job.error,
            )

    def events(self, job_id: str, start_index: int = 0) -> tuple[list[ProgressEvent], str, int] | None:
        """Return new progress events, current state, and the next event cursor."""
        with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            return None
        with job.lock:
            return list(job.progress[start_index:]), job.status, len(job.progress)
