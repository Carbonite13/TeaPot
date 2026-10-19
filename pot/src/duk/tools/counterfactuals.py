"""Bounded deterministic search for small one- and two-field decision flips."""

from itertools import combinations, product
from math import log
from typing import Any

import numpy as np
from pydantic import BaseModel, ConfigDict, Field

from duk.schemas.requirements import NormalizedRequirements, RequirementsInput
from duk.tools.catalogue import SliceProfile
from duk.tools.scoring import ScoringWeights, score_requirements


class Counterfactual(BaseModel):
    """A validated one- or two-field change that changes the winning category."""

    model_config = ConfigDict(frozen=True)

    changes: dict[str, Any]
    from_category: str
    to_category: str
    distance: float = Field(ge=0)
    verified: bool


def _raw_values(requirements: NormalizedRequirements) -> dict[str, Any]:
    """Flatten provenance-wrapped requirements for candidate evaluation."""
    return {
        name: getattr(requirements, name).value
        for name in NormalizedRequirements.model_fields
    }


def _grid(name: str, value: Any) -> list[Any]:
    """Return a bounded candidate grid including schema limits and current value."""
    if name == "latency_ms":
        values = np.geomspace(0.1, 1000, 17).tolist()
    elif name == "throughput_mbps":
        values = np.geomspace(0.001, 10000, 17).tolist()
    elif name == "reliability_per":
        values = np.geomspace(1e-9, 1e-1, 17).tolist()
    elif name == "device_density_per_km2":
        values = np.geomspace(1, 1e6, 17).tolist()
    elif name == "throughput_guaranteed":
        values = [False, True]
    elif name == "mobility":
        values = ["stationary", "pedestrian", "vehicular", "high_speed"]
    elif name == "arp_level":
        values = list(range(1, 16))
    elif name == "criticality":
        values = ["routine", "important", "life_safety"]
    else:
        raise ValueError(f"No counterfactual grid for {name}")
    values.append(value)
    return list(dict.fromkeys(values))


def _distance(name: str, old: Any, new: Any) -> float:
    """Measure change size in log ratio for positive numeric fields."""
    if old == new:
        return 0.0
    if name in {"latency_ms", "throughput_mbps", "reliability_per", "device_density_per_km2"}:
        return abs(log(float(new) / float(old)))
    if name == "arp_level":
        return abs(int(new) - int(old)) / 14
    return 1.0


def search_counterfactuals(
    requirements: NormalizedRequirements,
    profiles: list[SliceProfile],
    weights: ScoringWeights,
    max_evaluations: int = 12000,
    limit: int = 3,
) -> list[Counterfactual]:
    """Find the smallest deterministic flips using at most two changed fields."""
    current = _raw_values(requirements)
    winner = score_requirements(requirements, profiles, weights).winner
    names = list(current)
    grids = {name: [item for item in _grid(name, current[name]) if item != current[name]] for name in names}
    candidates: list[Counterfactual] = []
    evaluations = 0

    def evaluate(changes: dict[str, Any]) -> None:
        nonlocal evaluations
        if evaluations >= max_evaluations:
            return
        evaluations += 1
        try:
            proposed = RequirementsInput.model_validate({**current, **changes})
        except Exception:
            return
        normalized = NormalizedRequirements.from_input(proposed)
        result = score_requirements(normalized, profiles, weights)
        if result.winner != winner:
            candidates.append(Counterfactual(
                changes=changes,
                from_category=winner,
                to_category=result.winner,
                distance=sum(_distance(name, current[name], value) for name, value in changes.items()),
                verified=True,
            ))

    for name in names:
        for value in grids[name]:
            evaluate({name: value})
    if evaluations < max_evaluations:
        for left, right in combinations(names, 2):
            pairs = product(grids[left], grids[right])
            for left_value, right_value in pairs:
                evaluate({left: left_value, right: right_value})
                if evaluations >= max_evaluations:
                    break
            if evaluations >= max_evaluations:
                break
    candidates.sort(key=lambda candidate: (candidate.distance, tuple(candidate.changes)))
    unique: dict[str, Counterfactual] = {}
    for candidate in candidates:
        unique.setdefault(candidate.to_category, candidate)
        if len(unique) >= limit:
            break
    return list(unique.values())
