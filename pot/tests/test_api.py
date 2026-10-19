"""HTTP acceptance tests for job kickoff, progress, and field validation."""

import asyncio
from types import SimpleNamespace

import duk.api.jobs as jobs_module
from duk.main import create_app
from httpx import ASGITransport, AsyncClient


class FakeFlow:
    """Complete an in-memory run without calling a remote model provider."""

    def __init__(self, progress_callback):
        self.progress_callback = progress_callback
        self.state = SimpleNamespace(final_data={})

    def kickoff(self, inputs):
        self.progress_callback("analysis", "Computing deterministic test scores.")
        self.state.final_data = {
            "decision_id": "decision-test",
            "recommended_slice": "eMBB",
            "probabilities": {"eMBB": 0.8, "URLLC": 0.1, "mMTC": 0.1},
            "scores": {"eMBB": 0.9, "URLLC": 0.4, "mMTC": 0.3},
            "reasoning": "Campus VR requires throughput.",
            "reasoning_verified": True,
            "counterfactuals": [],
            "normalized_requirements": {},
            "weights_version": "1.0.0",
        }


def test_generate_queues_flow_and_exposes_progress(monkeypatch) -> None:
    """Return a job id, then expose stage updates and a completed result."""
    monkeypatch.setattr(jobs_module, "DecisionFlow", FakeFlow)
    async def exercise() -> None:
        app = create_app()
        from duk.api.jobs import DecisionJobManager

        app.state.job_manager = DecisionJobManager()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            accepted = await client.post("/api/v1/generate", json={"preset_name": "campus_vr"})
            assert accepted.status_code == 202
            payload = accepted.json()
            for _ in range(100):
                state = await client.get(payload["status_url"])
                if state.json()["status"] in {"completed", "failed"}:
                    break
                await asyncio.sleep(0.01)
            assert state.status_code == 200
            assert state.json()["status"] == "completed"
            assert state.json()["result"]["recommended_slice"] == "eMBB"
            assert any(event["status"] == "analysis" for event in state.json()["progress"])
        app.state.job_manager._executor.shutdown(wait=True)

    asyncio.run(exercise())


def test_generate_rejects_out_of_range_field_immediately() -> None:
    """Return a FastAPI field-specific error before a job reaches analysis."""
    async def exercise() -> None:
        async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/generate",
                json={"preset_name": "campus_vr", "requirements": {"latency_ms": 0}},
            )
        assert response.status_code == 422
        assert "latency_ms" in response.text

    asyncio.run(exercise())


def test_unknown_job_returns_404() -> None:
    """Do not expose an empty result for an unknown job id."""
    async def exercise() -> None:
        app = create_app()
        from duk.api.jobs import DecisionJobManager

        app.state.job_manager = DecisionJobManager()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/generate/missing")
        assert response.status_code == 404
        app.state.job_manager._executor.shutdown(wait=True)

    asyncio.run(exercise())
