"""Acceptance tests for deterministic category scoring and counterfactuals."""

from duk.schemas.requirements import NormalizedRequirements, Provenance
from duk.tools.catalogue import SimulatedSliceProvider
from duk.tools.counterfactuals import search_counterfactuals
from duk.tools.presets import PresetLoader
from duk.tools.scoring import load_scoring_weights, score_requirements


def _decision(name: str):
    """Score one validated acceptance preset against the simulated catalogue."""
    preset = PresetLoader().load(name)
    requirements = NormalizedRequirements.from_input(preset.values, Provenance.PRESET, name)
    profiles = SimulatedSliceProvider().get_profiles()
    weights = load_scoring_weights()
    return requirements, profiles, weights, score_requirements(requirements, profiles, weights)


def test_acceptance_presets_choose_expected_slice() -> None:
    """Return each representative application in its expected category."""
    assert _decision("ambulance_telemetry")[3].winner == "URLLC"
    assert _decision("smart_parking")[3].winner == "mMTC"
    assert _decision("campus_vr")[3].winner == "eMBB"


def test_same_input_has_identical_probabilities_and_counterfactuals() -> None:
    """Keep deterministic analysis stable across identical invocations."""
    args = _decision("campus_vr")
    first = search_counterfactuals(*args[:3])
    second = search_counterfactuals(*args[:3])
    assert args[3].probabilities == _decision("campus_vr")[3].probabilities
    assert first == second


def test_counterfactual_is_verified_by_the_same_scorer() -> None:
    """Ensure every reported candidate flips the winner when re-scored."""
    requirements, profiles, weights, trace = _decision("campus_vr")
    candidates = search_counterfactuals(requirements, profiles, weights)
    assert candidates
    assert all(len(item.changes) <= 2 and item.verified for item in candidates)
    original = {
        name: getattr(requirements, name).value
        for name in NormalizedRequirements.model_fields
    }
    from duk.schemas.requirements import RequirementsInput

    for candidate in candidates:
        changed = RequirementsInput.model_validate({**original, **candidate.changes})
        rescored = score_requirements(NormalizedRequirements.from_input(changed), profiles, weights)
        assert rescored.winner == candidate.to_category
        assert rescored.winner != trace.winner
    assert candidates == sorted(candidates, key=lambda item: (item.distance, tuple(item.changes)))
