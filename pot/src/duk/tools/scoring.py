"""Deterministic requirement fit, weighted scoring, and softmax probabilities."""

import json
from pathlib import Path
from typing import Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field, model_validator

from duk.schemas.requirements import Criticality, Mobility, NormalizedRequirements
from duk.tools.catalogue import SliceProfile

ScoreDimension = Literal["latency", "throughput", "reliability", "mobility", "device_density", "priority"]


class ScoringWeights(BaseModel):
    """Validated versioned category-scoring parameters and source metadata."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    version: str
    temperature: float = Field(gt=0)
    weights: dict[ScoreDimension, float]
    metadata: dict[str, object]

    @model_validator(mode="after")
    def weights_sum_to_one(self) -> "ScoringWeights":
        """Require complete, normalized weights for deterministic softmax."""
        expected = set(ScoreDimension.__args__)
        if set(self.weights) != expected or not np.isclose(sum(self.weights.values()), 1.0):
            raise ValueError("Scoring weights must cover every dimension and sum to 1")
        return self


class ScoreTrace(BaseModel):
    """Immutable scores, probability distribution, and exact scoring versions."""

    model_config = ConfigDict(frozen=True)

    categories: list[str]
    fit_scores: dict[str, dict[str, float]]
    weighted_scores: dict[str, float]
    probabilities: dict[str, float]
    weights_version: str
    temperature: float

    @property
    def winner(self) -> str:
        """Return the highest-probability category with stable tie-breaking."""
        return max(self.categories, key=lambda category: self.probabilities[category])


def load_scoring_weights(path: Path | None = None) -> ScoringWeights:
    """Load and validate the checked-in scoring weights JSON."""
    source = path or Path("data/scoring_weights.v1.json")
    return ScoringWeights.model_validate(json.loads(source.read_text(encoding="utf-8")))


def _capacity_fit(demand: float, capacity: float, log_span: float) -> float:
    """Score how well a profile capacity covers demand on a bounded log scale."""
    return float(np.clip(1.0 - max(0.0, np.log10(demand / capacity)) / log_span, 0.0, 1.0))


def compute_fit_scores(
    requirements: NormalizedRequirements,
    profiles: list[SliceProfile],
) -> dict[str, dict[str, float]]:
    """Compute deterministic per-requirement scores for each profile."""
    latency = requirements.latency_ms.value
    throughput = requirements.throughput_mbps.value
    reliability = requirements.reliability_per.value
    density = requirements.device_density_per_km2.value
    criticality = requirements.criticality.value
    arp_fit = 1.0 - (requirements.arp_level.value - 1) / 14.0
    fits: dict[str, dict[str, float]] = {}
    for profile in profiles:
        target = profile.targets
        latency_fit = _capacity_fit(target.latency_ms, latency, 3.0)
        throughput_fit = _capacity_fit(throughput, target.throughput_mbps, 3.0)
        if requirements.throughput_guaranteed.value and not target.guaranteed_throughput:
            throughput_fit *= 0.25
        reliability_fit = _capacity_fit(target.reliability_per, reliability, 8.0)
        density_fit = _capacity_fit(density, target.device_density_per_km2, 6.0)
        mobility_fit = float(requirements.mobility.value in target.mobility)
        criticality_fit = float(criticality in target.criticality)
        priority_fit = 0.4 * arp_fit + 0.6 * criticality_fit
        fits[profile.category] = {
            "latency": latency_fit,
            "throughput": throughput_fit,
            "reliability": reliability_fit,
            "mobility": mobility_fit,
            "device_density": density_fit,
            "priority": priority_fit,
        }
    return fits


def score_requirements(
    requirements: NormalizedRequirements,
    profiles: list[SliceProfile],
    weights: ScoringWeights,
) -> ScoreTrace:
    """Calculate weighted category scores and stable softmax probabilities."""
    fit_scores = compute_fit_scores(requirements, profiles)
    categories = [profile.category for profile in profiles]
    raw_scores = np.array([
        sum(fit_scores[category][name] * weight for name, weight in weights.weights.items())
        for category in categories
    ], dtype=np.float64)
    scaled = (raw_scores - raw_scores.max()) / weights.temperature
    exponents = np.exp(scaled)
    probabilities = exponents / exponents.sum()
    return ScoreTrace(
        categories=categories,
        fit_scores=fit_scores,
        weighted_scores={category: float(score) for category, score in zip(categories, raw_scores, strict=True)},
        probabilities={category: float(probability) for category, probability in zip(categories, probabilities, strict=True)},
        weights_version=weights.version,
        temperature=weights.temperature,
    )
