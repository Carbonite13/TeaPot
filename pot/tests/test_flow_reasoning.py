"""Flow tests for review retries and deterministic no-prose fallback."""

from crewai.events import crewai_event_bus

import duk.flow as flow_module
from duk.audit.log import JsonlAuditWriter
from duk.crews.reasoning.crew import Explanation, ReviewResult
from duk.flow import DecisionFlow, numeric_claims_match_trace


def _run_flow(monkeypatch, tmp_path, outputs):
    """Run a complete decision using queued mock reasoning/review outputs."""
    calls = []

    class MockReasoningCrew:
        async def run(self, inputs):
            calls.append(inputs)
            return outputs[len(calls) - 1]

    monkeypatch.setattr(flow_module, "ReasoningCrew", MockReasoningCrew)
    monkeypatch.setattr(
        flow_module,
        "JsonlAuditWriter",
        lambda: JsonlAuditWriter(tmp_path / "audit.jsonl"),
    )
    with crewai_event_bus.scoped_handlers():
        flow = DecisionFlow(suppress_flow_events=True, tracing=False)
        flow.state.request_data = {"preset_name": "campus_vr"}
        import asyncio

        async def run_layers() -> None:
            intake = await flow.intake_layer()
            analysis = await flow.analysis_layer(intake)
            reasoning = await flow.reasoning_layer(analysis)
            await flow.audit_layer(reasoning)

        asyncio.run(run_layers())
    return flow.state.final_data, calls


def test_mismatched_number_retries_then_accepts_valid_explanation(monkeypatch, tmp_path) -> None:
    """Reject unsupported digits and make exactly one correction attempt."""
    import duk.flow as flow_module

    outputs = [
        (Explanation(text="The decision score is 999."), ReviewResult(valid=False, issues=["999 is absent"])),
        (Explanation(text="Campus VR matches eMBB."), ReviewResult(valid=True, issues=[])),
    ]
    result, calls = _run_flow(monkeypatch, tmp_path, outputs)
    assert len(calls) == 2
    assert result["reasoning"] == "Campus VR matches eMBB."
    assert result["reasoning_verified"] is True
    assert flow_module.JsonlAuditWriter().path == tmp_path / "audit.jsonl"


def test_second_mismatch_returns_deterministic_result_without_prose(monkeypatch, tmp_path) -> None:
    """After a failed retry, keep the numeric result and return no explanation."""
    output = (Explanation(text="The score is 999."), ReviewResult(valid=False, issues=["unsupported number"]))
    result, calls = _run_flow(monkeypatch, tmp_path, [output, output])
    assert len(calls) == 2
    assert result["reasoning"] == ""
    assert result["reasoning_verified"] is False
    assert result["recommended_slice"] == "eMBB"


def test_number_checker_accepts_trace_values_and_ignores_5g_label() -> None:
    """Check numeric tokens against JSON trace values without treating 5G as 5."""
    trace = {"probabilities": {"eMBB": 0.5}, "latency_ms": 25}
    assert numeric_claims_match_trace("The 5G choice has probability 0.5 at 25 ms.", trace)
    assert not numeric_claims_match_trace("The choice has probability 99.", trace)
