"""Automated tests verifying CrewAI framework and cloud LLM connectivity."""

import os
from pathlib import Path
from typing import Any

import httpx
import pytest
from crewai import Agent, Crew, LLM, Process, Task
from crewai.tools import tool
from dotenv import load_dotenv

import duk.llm as llm_module
from duk.crews.intake.crew import IntakeNormalizationCrew, QualitativeHints
from duk.crews.runtime import configure_runtime_storage

# Load .env if present
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def get_cirrascale_key() -> str | None:
    """Return the configured Cirrascale API key or None."""
    return os.environ.get("CIRRASCALE_API_KEY")


@pytest.fixture(autouse=True)
def setup_runtime():
    """Ensure runtime directory is configured before CrewAI imports and runs."""
    configure_runtime_storage()


def test_cirrascale_cloud_endpoint_reachability() -> None:
    """Verify that Cirrascale API endpoint is reachable and returns the model catalogue."""
    api_key = get_cirrascale_key()
    if not api_key:
        pytest.skip("CIRRASCALE_API_KEY not configured in environment")

    config = llm_module.model_config()
    base_url = config["provider"]["base_url"]
    models_url = f"{base_url}/models"

    with httpx.Client(timeout=15.0) as client:
        response = client.get(models_url, headers={"Authorization": f"Bearer {api_key}"})

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    catalogue = response.json()
    assert "llm" in catalogue, "Catalogue JSON should contain 'llm' model list"
    assert "Llama-3.1-8B" in catalogue["llm"], "Llama-3.1-8B should be in active catalogue"
    assert "Llama-3.3-70B" in catalogue["llm"], "Llama-3.3-70B should be in active catalogue"


def test_cirrascale_cloud_auth_rejection_on_invalid_key() -> None:
    """Verify that Cirrascale properly rejects requests with an invalid authorization key."""
    config = llm_module.model_config()
    base_url = config["provider"]["base_url"]
    models_url = f"{base_url}/models"

    with httpx.Client(timeout=15.0) as client:
        response = client.get(models_url, headers={"Authorization": "Bearer invalid_secret_key_123"})

    assert response.status_code in {401, 403, 500}, f"Expected auth rejection, got {response.status_code}"


def test_cirrascale_cloud_chat_completion() -> None:
    """Verify that direct OpenAI-compatible chat completion succeeds on Cirrascale cloud."""
    api_key = get_cirrascale_key()
    if not api_key:
        pytest.skip("CIRRASCALE_API_KEY not configured in environment")

    config = llm_module.model_config()
    chat_url = f"{config['provider']['base_url']}/chat/completions"

    payload: dict[str, Any] = {
        "model": "Llama-3.1-8B",
        "messages": [
            {"role": "system", "content": "You are a test assistant. Answer in one word."},
            {"role": "user", "content": "Ping"},
        ],
        "temperature": 0.0,
        "max_tokens": 10,
    }

    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            chat_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    assert response.status_code == 200, f"Chat completion failed: {response.text}"
    data = response.json()
    assert "choices" in data and len(data["choices"]) > 0
    content = data["choices"][0]["message"]["content"]
    assert len(content.strip()) > 0


def test_crewai_llm_cloud_connectivity() -> None:
    """Verify that CrewAI's LLM wrapper connects to Cirrascale and completes a call."""
    api_key = get_cirrascale_key()
    if not api_key:
        pytest.skip("CIRRASCALE_API_KEY not configured in environment")

    config = llm_module.model_config()
    provider = config["provider"]

    llm = LLM(
        model="openai/Llama-3.1-8B",
        base_url=provider["base_url"],
        api_key=api_key,
        temperature=0.0,
        timeout=30,
    )

    response = llm.call(messages=[{"role": "user", "content": "Respond with the single word: VERIFIED"}])
    assert isinstance(response, str)
    assert len(response.strip()) > 0


def test_crewai_crew_cloud_pipeline() -> None:
    """Verify full end-to-end execution of a CrewAI sequential Crew backed by cloud LLM."""
    api_key = get_cirrascale_key()
    if not api_key:
        pytest.skip("CIRRASCALE_API_KEY not configured in environment")

    config = llm_module.model_config()
    provider = config["provider"]

    llm = LLM(
        model="openai/Llama-3.1-8B",
        base_url=provider["base_url"],
        api_key=api_key,
        temperature=0.0,
        timeout=30,
    )

    agent = Agent(
        role="Cloud Connectivity Auditor",
        goal="Confirm cloud model pipeline execution",
        backstory="A specialized diagnostics agent verifying cloud LLM inference.",
        llm=llm,
        verbose=False,
    )

    task = Task(
        description="Return the exact phrase 'CREW_CLOUD_OK' and nothing else.",
        expected_output="The verification token CREW_CLOUD_OK.",
        agent=agent,
    )

    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=False,
    )

    result = crew.kickoff()
    assert result is not None
    assert "CREW_CLOUD_OK" in result.raw or len(result.raw.strip()) > 0
    assert result.tasks_output[0].raw is not None


def test_crewai_direct_agent_kickoff() -> None:
    """Verify modern CrewAI direct agent kickoff without creating a crew wrapper."""
    api_key = get_cirrascale_key()
    if not api_key:
        pytest.skip("CIRRASCALE_API_KEY not configured in environment")

    config = llm_module.model_config()
    provider = config["provider"]

    llm = LLM(
        model="openai/Llama-3.1-8B",
        base_url=provider["base_url"],
        api_key=api_key,
        temperature=0.0,
        timeout=30,
    )

    agent = Agent(
        role="Direct Agent Tester",
        goal="Demonstrate modern CrewAI direct kickoff capability",
        backstory="A test agent directly invoked via agent.kickoff().",
        llm=llm,
        verbose=False,
    )

    result = agent.kickoff("Respond with the word: STANDALONE")
    assert result is not None
    assert len(result.raw.strip()) > 0
    assert result.agent_role == "Direct Agent Tester"


def test_crewai_agent_tool_calling_cloud_pipeline() -> None:
    """Verify that a CrewAI agent successfully invokes a custom tool with structured arguments via Cirrascale cloud LLM."""
    api_key = get_cirrascale_key()
    if not api_key:
        pytest.skip("CIRRASCALE_API_KEY not configured in environment")

    config = llm_module.model_config()
    provider = config["provider"]

    llm = LLM(
        model="openai/Llama-3.1-8B",
        base_url=provider["base_url"],
        api_key=api_key,
        temperature=0.0,
        timeout=30,
    )

    recorded: dict[str, str] = {}

    @tool("record_qualitative_hints")
    def record_qualitative_hints(
        latency_intent: str,
        throughput_intent: str,
        reliability_intent: str,
        density_intent: str,
        evidence: str,
    ) -> str:
        """Record qualitative hints extracted from the requirements text.
        latency_intent: one of low, moderate, relaxed, unspecified.
        throughput_intent: one of low, moderate, high, unspecified.
        reliability_intent: one of very_high, high, normal, unspecified.
        density_intent: one of few, many, massive, unspecified.
        evidence: exact phrase from text.
        """
        recorded["latency_intent"] = latency_intent
        recorded["throughput_intent"] = throughput_intent
        recorded["reliability_intent"] = reliability_intent
        recorded["density_intent"] = density_intent
        recorded["evidence"] = evidence
        return f"Successfully recorded hints: {recorded}"

    agent = Agent(
        role="Requirements Intake Specialist",
        goal="Extract qualitative hints and invoke the record_qualitative_hints tool",
        backstory="An AI agent specializing in telecommunications requirement extraction.",
        tools=[record_qualitative_hints],
        llm=llm,
        verbose=False,
    )

    task = Task(
        description=(
            "Extract qualitative requirement hints for: 'Ultra reliable low latency communication "
            "for autonomous emergency vehicles'. Invoke the record_qualitative_hints tool with the "
            "extracted parameters, then return 'DONE'."
        ),
        expected_output="Confirmation that hints were recorded.",
        agent=agent,
    )

    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=False,
    )

    result = crew.kickoff()
    assert result is not None
    assert "DONE" in result.raw or len(recorded) > 0
    assert recorded.get("reliability_intent") in {"very_high", "high", "normal", "unspecified"}
    assert recorded.get("latency_intent") in {"low", "moderate", "relaxed", "unspecified"}


