"""CrewAI Flow orchestrator for validation, analysis, reasoning, and audit."""

import json
import re
import traceback
from collections.abc import Callable
from typing import Any, ClassVar

import structlog
from crewai.flow import Flow, listen, start
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from duk.audit.log import JsonlAuditWriter, new_record
from duk.crews.intake.crew import IntakeNormalizationCrew
from duk.crews.runtime import configure_runtime_storage
from duk.crews.reasoning.crew import Explanation, ReasoningCrew
from duk.schemas.api import GenerateRequest
from duk.schemas.requirements import (
    NormalizedRequirements,
    Provenance,
    RequirementsInput,
    SourcedValue,
)
from duk.tools.catalogue import SimulatedSliceProvider
from duk.tools.counterfactuals import Counterfactual, search_counterfactuals
from duk.tools.presets import PresetLoader
from duk.tools.scoring import ScoreTrace, load_scoring_weights, score_requirements
from duk.llm import model_config

logger = structlog.get_logger(__name__)
NUMBER = re.compile(r"(?<![A-Za-z0-9])[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?(?![A-Za-z0-9])")


class DecisionState(BaseModel):
    """Typed state carried through the three decision layers."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    request_data: dict[str, Any] = Field(default_factory=dict)
    raw_input: dict[str, Any] = Field(default_factory=dict)
    normalized_data: dict[str, Any] = Field(default_factory=dict)
    trace_data: dict[str, Any] = Field(default_factory=dict)
    counterfactual_data: list[dict[str, Any]] = Field(default_factory=list)
    layer_snapshots: dict[str, dict[str, Any]] = Field(default_factory=dict)
    final_data: dict[str, Any] = Field(default_factory=dict)
    error_data: dict[str, Any] = Field(default_factory=dict)


def numeric_claims_match_trace(text: str, trace: dict[str, Any]) -> bool:
    """Accept numeric tokens only when their numeric value occurs in the trace."""
    serialized = json.dumps(trace, sort_keys=True, allow_nan=False)
    available = {float(value) for value in NUMBER.findall(serialized)}
    return all(float(value) in available for value in NUMBER.findall(text))


def _jsonable(value: Any) -> Any:
    """Convert Pydantic values, enums, and nested collections to JSON values."""
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    return value


class DecisionFlow(Flow[DecisionState]):
    """Top-level flow with API-safe async execution and progress callbacks."""

    _skip_auto_memory: ClassVar[bool] = True
    progress_callback: Callable[[str, str], None] | None = None

    def __init__(self, **data: Any) -> None:
        """Initialize CrewAI's runtime under the writable project data path."""
        configure_runtime_storage()
        super().__init__(**data)

    def _progress(self, status: str, message: str) -> None:
        """Emit a concise stage update without logging decision prose."""
        if self.progress_callback is not None:
            self.progress_callback(status, message)
        logger.info("decision_stage", status=status, message=message)

    async def run_pipeline(self, request_data: dict[str, Any]) -> dict[str, Any]:
        """Run decorated Flow stages sequentially without CrewAI's sync thread handoff.

        CrewAI 1.15.28's synchronous Flow kickoff stalls in its internal
        ``asyncio.to_thread`` completion path in the supported sandbox runtime.
        This explicit async entry point executes the same typed stage methods,
        while CrewAI crews still perform the model-backed intake and reasoning.
        """
        self.state.request_data = request_data
        intake = await self.intake_layer()
        analysis = await self.analysis_layer(intake)
        reasoning = await self.reasoning_layer(analysis)
        return await self.audit_layer(reasoning)

    @start()
    async def intake_layer(self) -> dict[str, Any]:
        """Validate, merge preset and declared values, and tag every field."""
        self._progress("intake", "Validating inputs and resolving preset values.")
        request = GenerateRequest.model_validate(self.state.request_data)
        self.state.raw_input = request.model_dump(mode="json")
        preset = PresetLoader().load(request.preset_name) if request.preset_name else None
        values = preset.values.model_dump(mode="python") if preset else {}
        overrides = request.requirements.model_dump(exclude_none=True)
        values.update(overrides)
        try:
            validated = RequirementsInput.model_validate(values)
        except ValidationError as exc:
            self.state.error_data = {"type": "validation_error", "details": exc.errors()}
            raise
        sourced = {}
        for name in RequirementsInput.model_fields:
            origin = Provenance.DECLARED if name in overrides else Provenance.PRESET
            source = "request" if origin is Provenance.DECLARED else f"{preset.name}@{preset.version}"
            sourced[name] = SourcedValue(value=getattr(validated, name), provenance=origin, source=source)
        normalized = NormalizedRequirements.model_validate(sourced)
        self._progress("intake_normalized", "All fields are validated and have provenance tags.")
        if request.description:
            result = await IntakeNormalizationCrew().crew().akickoff(inputs={"free_text": request.description})
            hints = result.pydantic
            self.state.layer_snapshots["intake"] = {"qualitative_hints": _jsonable(hints)}
        else:
            self.state.layer_snapshots["intake"] = {"qualitative_hints": None}
        self.state.normalized_data = normalized.model_dump(mode="json")
        self._progress("intake_serialized", "Normalized requirements are ready for deterministic analysis.")
        self.state.layer_snapshots["intake"]["requirements"] = self.state.normalized_data
        self.state.layer_snapshots["intake"]["preset"] = (
            {"name": preset.name, "version": preset.version} if preset else None
        )
        return self.state.normalized_data

    @listen(intake_layer)
    async def analysis_layer(self, _: dict[str, Any]) -> dict[str, Any]:
        """Run the provider lookup, fit scores, probabilities, and counterfactuals."""
        self._progress("analysis", "Computing slice fit scores and bounded counterfactuals.")
        requirements = NormalizedRequirements.model_validate(self.state.normalized_data)
        profiles = SimulatedSliceProvider().get_profiles()
        weights = load_scoring_weights()
        trace = score_requirements(requirements, profiles, weights)
        self._progress("analysis_scored", "Category fit scores and probabilities are calculated.")
        counterfactuals = search_counterfactuals(requirements, profiles, weights)
        self._progress("analysis_counterfactuals", "Counterfactual candidates were checked with the scorer.")
        self.state.trace_data = trace.model_dump(mode="json")
        self.state.counterfactual_data = [item.model_dump(mode="json") for item in counterfactuals]
        self.state.layer_snapshots["analysis"] = {
            "trace": self.state.trace_data,
            "counterfactuals": self.state.counterfactual_data,
            "catalogue": [{"category": item.category, "version": item.profile_version} for item in profiles],
        }
        self._progress("analysis_complete", "Deterministic analysis is ready for explanation.")
        return self.state.layer_snapshots["analysis"]

    @listen(analysis_layer)
    async def reasoning_layer(self, _: dict[str, Any]) -> dict[str, Any]:
        """Ask for prose, review it, retry once, then fall back to no prose."""
        self._progress("reasoning", "Writing and checking a trace-bound explanation.")
        profiles = SimulatedSliceProvider().get_profiles()
        weights = load_scoring_weights()
        trace = {
            "analysis": self.state.trace_data,
            "counterfactuals": self.state.counterfactual_data,
            "normalized_requirements": self.state.normalized_data,
        }
        trace_text = json.dumps(trace, sort_keys=True, separators=(",", ":"), allow_nan=False)
        crew = ReasoningCrew()
        explanation: Explanation | None = None
        review_valid = False
        review_issues: list[str] = []
        for attempt in range(2):
            try:
                explanation, review = await crew.run({
                    "trace": trace_text,
                    "explanation": explanation.text if explanation else "",
                    "review_feedback": "; ".join(review_issues) if review_issues else "No previous review.",
                })
                review_issues = review.issues
                review_valid = review.valid and numeric_claims_match_trace(explanation.text, trace)
                if review_valid:
                    break
                review_issues.append("Explanation contains a numeric claim absent from the deterministic trace.")
            except Exception as exc:
                frames = traceback.extract_tb(exc.__traceback__)
                location = frames[-1] if frames else None
                logger.warning(
                    "reasoning_attempt_failed",
                    attempt=attempt + 1,
                    error_type=type(exc).__name__,
                    error_site=(f"{location.name}:{location.lineno}" if location else "unknown"),
                )
                review_issues = ["Reasoning or review execution failed."]
        reasoning_text = explanation.text if explanation and review_valid else ""
        if not reasoning_text:
            self._progress("reasoning_fallback", "Explanation did not pass numeric review; returning the deterministic result.")
        config = model_config()
        self.state.layer_snapshots["reasoning"] = {
            "attempts": 2 if not review_valid else attempt + 1,
            "verified": review_valid,
            "issues": review_issues,
            "text": reasoning_text,
        }
        self.state.final_data = {
            "recommended_slice": max(
                self.state.trace_data["categories"],
                key=lambda category: self.state.trace_data["probabilities"][category],
            ),
            "probabilities": self.state.trace_data["probabilities"],
            "scores": self.state.trace_data["weighted_scores"],
            "reasoning": reasoning_text,
            "reasoning_verified": review_valid,
            "counterfactuals": self.state.counterfactual_data,
            "normalized_requirements": self.state.normalized_data,
            "weights_version": weights.version,
            "model_names": {
                "intake_normaliser": config["roles"]["intake_normaliser"]["model"],
                "reasoner": config["roles"]["reasoner"]["model"],
                "consistency_reviewer": config["roles"]["consistency_reviewer"]["model"],
            },
        }
        return self.state.final_data

    @listen(reasoning_layer)
    async def audit_layer(self, _: dict[str, Any]) -> dict[str, Any]:
        """Write the sole idempotent decision record from the orchestrator."""
        self._progress("audit", "Recording the completed decision and provenance.")
        request_data = self.state.raw_input
        preset_data = self.state.layer_snapshots["intake"]["preset"]
        profiles = SimulatedSliceProvider().get_profiles()
        weights = load_scoring_weights()
        normalized = NormalizedRequirements.model_validate(self.state.normalized_data)
        counterfactuals = [Counterfactual.model_validate(item) for item in self.state.counterfactual_data]
        record = new_record(
            raw_input=request_data,
            normalized_requirements=normalized,
            preset_name=preset_data["name"] if preset_data else None,
            preset_version=preset_data["version"] if preset_data else None,
            scoring_weights_version=weights.version,
            probabilities=self.state.final_data["probabilities"],
            counterfactuals=counterfactuals,
            reasoning_text=self.state.final_data["reasoning"],
            model_names=self.state.final_data["model_names"],
            layer_snapshots=self.state.layer_snapshots,
        )
        persisted = JsonlAuditWriter().append_once(record)
        self.state.final_data["decision_id"] = persisted.decision_id
        return self.state.final_data
