"""Typed HTTP request, job-progress, and final decision response models."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator

from duk.schemas.requirements import Criticality, Mobility
from duk.tools.counterfactuals import Counterfactual


class RequirementOverrides(BaseModel):
    """Optional validated fields that override a selected preset."""

    model_config = ConfigDict(extra="forbid")

    latency_ms: FiniteFloat | None = Field(default=None, ge=0.1, le=1000)
    throughput_mbps: FiniteFloat | None = Field(default=None, ge=0.001, le=10000)
    throughput_guaranteed: bool | None = None
    reliability_per: FiniteFloat | None = Field(default=None, ge=1e-9, le=1e-1)
    mobility: Mobility | None = None
    device_density_per_km2: FiniteFloat | None = Field(default=None, ge=1, le=1e6)
    arp_level: int | None = Field(default=None, ge=1, le=15)
    criticality: Criticality | None = None


class GenerateRequest(BaseModel):
    """Start a decision from a preset, complete fields, or preset overrides."""

    model_config = ConfigDict(extra="forbid")

    preset_name: str | None = None
    requirements: RequirementOverrides = Field(default_factory=RequirementOverrides)
    description: str | None = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def has_an_input_path(self) -> "GenerateRequest":
        """Require a preset or a complete declared profile before queueing."""
        if self.preset_name is None:
            supplied = self.requirements.model_dump(exclude_none=True)
            required = {
                "latency_ms", "throughput_mbps", "throughput_guaranteed", "reliability_per",
                "mobility", "device_density_per_km2", "arp_level", "criticality",
            }
            missing = sorted(required - supplied.keys())
            if missing:
                raise ValueError(f"A preset is required unless all requirements are supplied; missing: {', '.join(missing)}")
        return self


class JobAccepted(BaseModel):
    """Acknowledgement returned after an asynchronous decision is queued."""

    job_id: str
    status: str
    status_url: str
    events_url: str


class ProgressEvent(BaseModel):
    """One human-readable analysis stage update."""

    sequence: int
    status: str
    message: str
    timestamp: str


class DecisionResult(BaseModel):
    """Completed deterministic decision, explanation, trace, and provenance."""

    decision_id: str
    recommended_slice: str
    probabilities: dict[str, float]
    scores: dict[str, float]
    reasoning: str
    reasoning_verified: bool
    counterfactuals: list[Counterfactual]
    normalized_requirements: dict[str, Any]
    weights_version: str


class JobStatus(BaseModel):
    """Status view returned by polling a decision job."""

    job_id: str
    status: str
    progress: list[ProgressEvent]
    result: DecisionResult | None = None
    error: dict[str, Any] | None = None
