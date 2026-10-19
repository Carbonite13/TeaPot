"""Validated application requirements and field-level provenance models."""

from enum import StrEnum
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat

T = TypeVar("T")


class Provenance(StrEnum):
    """Origin category attached to every normalized requirement."""

    DECLARED = "declared"
    PRESET = "preset"
    MEASURED = "measured"


class Criticality(StrEnum):
    """Application impact class, kept independent from its ARP level."""

    ROUTINE = "routine"
    IMPORTANT = "important"
    LIFE_SAFETY = "life_safety"


class Mobility(StrEnum):
    """Mobility class supplied for the application profile."""

    STATIONARY = "stationary"
    PEDESTRIAN = "pedestrian"
    VEHICULAR = "vehicular"
    HIGH_SPEED = "high_speed"


class SourcedValue(BaseModel, Generic[T]):
    """A normalized value with its source category and optional source label."""

    model_config = ConfigDict(frozen=True)

    value: T
    provenance: Provenance
    source: str | None = None


class RequirementsInput(BaseModel):
    """Raw user-supplied requirements validated before analysis begins."""

    model_config = ConfigDict(extra="forbid")

    latency_ms: FiniteFloat = Field(ge=0.1, le=1000, description="Packet delay budget in milliseconds")
    throughput_mbps: FiniteFloat = Field(ge=0.001, le=10000, description="Throughput in Mbps")
    throughput_guaranteed: bool
    reliability_per: FiniteFloat = Field(ge=1e-9, le=1e-1, description="Packet error rate")
    mobility: Mobility
    device_density_per_km2: FiniteFloat = Field(ge=1, le=1e6, description="Devices per square kilometre")
    arp_level: int = Field(ge=1, le=15, description="Allocation and Retention Priority level")
    criticality: Criticality


class NormalizedRequirements(BaseModel):
    """Validated values with independent provenance tags on every field."""

    model_config = ConfigDict(frozen=True)

    latency_ms: SourcedValue[FiniteFloat]
    throughput_mbps: SourcedValue[FiniteFloat]
    throughput_guaranteed: SourcedValue[bool]
    reliability_per: SourcedValue[FiniteFloat]
    mobility: SourcedValue[Mobility]
    device_density_per_km2: SourcedValue[FiniteFloat]
    arp_level: SourcedValue[int]
    criticality: SourcedValue[Criticality]

    @classmethod
    def from_input(
        cls,
        requirements: RequirementsInput,
        provenance: Provenance = Provenance.DECLARED,
        source: str | None = None,
    ) -> "NormalizedRequirements":
        """Attach one source tag to each field from a validated raw model."""
        return cls.model_validate({
            name: {"value": getattr(requirements, name), "provenance": provenance, "source": source}
            for name in RequirementsInput.model_fields
        })


InputPath = Literal["declared", "preset", "measured"]
