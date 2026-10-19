"""Offline construction and provider configuration tests for CrewAI crews."""

from typing import Any

import pytest
from crewai import BaseLLM

import duk.crews.intake.crew as intake_module
import duk.crews.reasoning.crew as reasoning_module
import duk.llm as llm_module
from duk.crews.intake.crew import IntakeNormalizationCrew
from duk.crews.reasoning.crew import ReasoningCrew


class StubLLM(BaseLLM):
    """Minimal offline LLM used to validate CrewAI wiring without network calls."""

    def call(
        self,
        messages: Any,
        tools: Any = None,
        callbacks: Any = None,
        available_functions: Any = None,
        from_task: Any = None,
        from_agent: Any = None,
        response_model: Any = None,
        **kwargs: Any,
    ) -> str:
        """Return a deterministic response if a test exercises this adapter."""
        return "stub"


def test_llm_factory_uses_cirrascale_and_role_model(monkeypatch: pytest.MonkeyPatch) -> None:
    """Configure the endpoint, secret, selected model, and Qwen thinking mode."""
    captured: dict[str, Any] = {}

    def fake_llm(**kwargs: Any) -> dict[str, Any]:
        captured.update(kwargs)
        return kwargs

    monkeypatch.setattr(llm_module, "LLM", fake_llm)
    monkeypatch.setenv("CIRRASCALE_API_KEY", "test-key")
    llm_module.model_config.cache_clear()
    llm_module.build_llm("intake_normaliser")
    assert captured["model"] == "openai/Llama-3.1-8B"
    assert captured["base_url"] == "https://aisuite.cirrascale.com/apis/v2"
    assert captured["api_key"] == "test-key"
    assert captured["additional_params"] == {}


def test_model_factory_requires_provider_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail before kickoff when the configured provider secret is missing."""
    monkeypatch.delenv("CIRRASCALE_API_KEY", raising=False)
    llm_module.model_config.cache_clear()
    with pytest.raises(RuntimeError, match="CIRRASCALE_API_KEY"):
        llm_module.build_llm("reasoner")


def test_intake_and_reasoning_crews_construct_offline(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    """Build crews with a stub LLM and assert their sequential task wiring."""
    stub = StubLLM(model="mock")
    monkeypatch.setattr(intake_module, "build_llm", lambda role: stub)
    monkeypatch.setattr(reasoning_module, "build_llm", lambda role: stub)
    monkeypatch.setenv("CREWAI_STORAGE_DIR", str(tmp_path / "crewai"))
    intake = IntakeNormalizationCrew().crew()
    reasoning = ReasoningCrew().crew()
    assert len(intake.agents) == len(intake.tasks) == 1
    assert len(reasoning.agents) == len(reasoning.tasks) == 2
