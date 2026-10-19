"""Validated simulated slice profiles and a replaceable provider interface."""

import json
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field

from duk.schemas.requirements import Criticality, Mobility


class SliceTargets(BaseModel):
    """Engineering target values used by the simulated scoring catalogue."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    latency_ms: float = Field(gt=0)
    throughput_mbps: float = Field(gt=0)
    reliability_per: float = Field(gt=0, le=1)
    mobility: list[Mobility]
    device_density_per_km2: int = Field(ge=1)
    guaranteed_throughput: bool
    criticality: list[Criticality]


class SliceProfile(BaseModel):
    """One simulated profile, with its category and provenance metadata."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    category: str
    display_name: str
    profile_version: str
    targets: SliceTargets
    source: str


class SliceProvider(Protocol):
    """Contract implemented by simulated or future live catalogue providers."""

    def get_profiles(self) -> list[SliceProfile]:
        """Return the currently available category profiles."""


class SimulatedSliceProvider:
    """Load and validate local simulated slice profiles from JSON files."""

    def __init__(self, directory: Path | None = None) -> None:
        """Initialize the provider with a data directory."""
        self.directory = directory or Path("data/slices")

    def get_profiles(self) -> list[SliceProfile]:
        """Return the three validated local slice profiles in stable order."""
        profiles = [
            SliceProfile.model_validate_json(path.read_text(encoding="utf-8"))
            for path in sorted(self.directory.glob("*.json"))
        ]
        if len(profiles) != 3 or {profile.category for profile in profiles} != {"eMBB", "URLLC", "mMTC"}:
            raise ValueError("Simulated catalogue must define eMBB, URLLC, and mMTC exactly once")
        return profiles


def load_json_model(path: Path, model: type[BaseModel]) -> BaseModel:
    """Read JSON and validate it against the requested Pydantic model."""
    return model.model_validate(json.loads(path.read_text(encoding="utf-8")))
