"""Tests for JSON preset validation and the simulated slice provider."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from duk.schemas.requirements import Mobility
from duk.tools.catalogue import SimulatedSliceProvider
from duk.tools.presets import PresetLoader


def test_all_required_presets_load_with_validated_values() -> None:
    """Read each named acceptance profile through the same Pydantic schema."""
    loader = PresetLoader()
    assert loader.load("ambulance_telemetry").values.mobility is Mobility.VEHICULAR
    assert loader.load("smart_parking").values.device_density_per_km2 == 500000
    assert loader.load("campus_vr").values.throughput_mbps == 200


def test_unknown_preset_is_rejected() -> None:
    """Give callers a clear error when the requested preset is absent."""
    with pytest.raises(FileNotFoundError, match="Unknown preset"):
        PresetLoader().load("missing")


def test_catalogue_has_all_three_simulated_profiles() -> None:
    """Provide the three stable simulated profiles via the provider contract."""
    profiles = SimulatedSliceProvider().get_profiles()
    assert [profile.category for profile in profiles] == ["eMBB", "mMTC", "URLLC"]


def test_invalid_preset_fails_schema_validation(tmp_path: Path) -> None:
    """Prevent malformed preset values from entering the analysis layer."""
    (tmp_path / "broken.json").write_text(
        '{"name":"broken","version":"1","description":"bad","values":{}}',
        encoding="utf-8",
    )
    with pytest.raises(ValidationError):
        PresetLoader(tmp_path).load("broken")
