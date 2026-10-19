"""Tests for requirement range checks and provenance propagation."""

import pytest
from pydantic import ValidationError

from duk.schemas.requirements import (
    Criticality,
    Mobility,
    NormalizedRequirements,
    Provenance,
    RequirementsInput,
)


@pytest.fixture
def valid_input() -> dict[str, object]:
    """Provide a valid declared profile for focused validation cases."""
    return {
        "latency_ms": 20,
        "throughput_mbps": 80,
        "throughput_guaranteed": False,
        "reliability_per": 1e-5,
        "mobility": "pedestrian",
        "device_density_per_km2": 2000,
        "arp_level": 5,
        "criticality": "important",
    }


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("latency_ms", 0),
        ("throughput_mbps", 10001),
        ("reliability_per", 0.2),
        ("device_density_per_km2", 0),
        ("arp_level", 16),
    ],
)
def test_out_of_range_error_names_field(valid_input: dict[str, object], field: str, value: object) -> None:
    """Reject out-of-range values and retain the field name in the error."""
    with pytest.raises(ValidationError) as error:
        RequirementsInput.model_validate({**valid_input, field: value})
    assert error.value.errors()[0]["loc"] == (field,)


def test_normalized_fields_each_retain_provenance(valid_input: dict[str, object]) -> None:
    """Copy all validated fields with a source tag on every value."""
    normalized = NormalizedRequirements.from_input(
        RequirementsInput.model_validate(valid_input), Provenance.PRESET, "campus_vr@1.0.0"
    )
    assert normalized.latency_ms.value == 20
    assert normalized.mobility.value is Mobility.PEDESTRIAN
    assert normalized.criticality.value is Criticality.IMPORTANT
    assert all(
        getattr(normalized, name).provenance is Provenance.PRESET
        for name in NormalizedRequirements.model_fields
    )
