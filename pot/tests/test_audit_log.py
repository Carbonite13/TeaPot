"""Tests for complete, idempotent JSONL audit records."""

import json

from duk.audit.log import JsonlAuditWriter, new_record
from duk.schemas.requirements import NormalizedRequirements, Provenance
from duk.tools.catalogue import SimulatedSliceProvider
from duk.tools.counterfactuals import search_counterfactuals
from duk.tools.presets import PresetLoader
from duk.tools.scoring import load_scoring_weights, score_requirements


def test_one_complete_record_is_written_per_decision(tmp_path) -> None:
    """Preserve the first full record and provenance without duplicate lines."""
    preset = PresetLoader().load("campus_vr")
    normalized = NormalizedRequirements.from_input(preset.values, Provenance.PRESET, preset.name)
    profiles = SimulatedSliceProvider().get_profiles()
    weights = load_scoring_weights()
    trace = score_requirements(normalized, profiles, weights)
    raw = preset.values.model_dump(mode="json")
    writer = JsonlAuditWriter(tmp_path / "decisions.jsonl")
    record = new_record(
        raw_input=raw,
        normalized_requirements=normalized,
        preset_name=preset.name,
        preset_version=preset.version,
        scoring_weights_version=weights.version,
        probabilities=trace.probabilities,
        counterfactuals=search_counterfactuals(normalized, profiles, weights),
        reasoning_text="Campus VR needs substantial throughput, so eMBB fits.",
        model_names={"reasoner": "test-model"},
        layer_snapshots={"intake": {"complete": True}, "analysis": {"complete": True}},
    )
    first = writer.append_once(record)
    duplicate = writer.append_once(record.model_copy(update={"reasoning_text": "different prose"}))
    lines = (tmp_path / "decisions.jsonl").read_text(encoding="utf-8").splitlines()
    stored = json.loads(lines[0])
    assert first == duplicate
    assert len(lines) == 1
    assert stored["reasoning_text"] == record.reasoning_text
    assert all(
        field["provenance"] == "preset"
        for field in stored["normalized_requirements"].values()
    )
