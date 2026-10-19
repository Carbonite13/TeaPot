"""CrewAI crew for qualitative-only natural-language requirement hints."""

from pathlib import Path
from typing import Literal

from crewai import Agent, Crew, Process, Task
from crewai.agents.agent_builder.base_agent import BaseAgent
from crewai.project import CrewBase, agent, crew, task
from pydantic import BaseModel, ConfigDict

from duk.crews.configuration import load_yaml
from duk.crews.runtime import configure_runtime_storage
from duk.llm import build_llm


class QualitativeHints(BaseModel):
    """Bounded qualitative classes extracted from free text without numbers."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    latency_intent: Literal["low", "moderate", "relaxed", "unspecified"]
    throughput_intent: Literal["low", "moderate", "high", "unspecified"]
    reliability_intent: Literal["very_high", "high", "normal", "unspecified"]
    density_intent: Literal["few", "many", "massive", "unspecified"]
    evidence: str


@CrewBase
class IntakeNormalizationCrew:
    """Single-agent crew that never parses numeric units or values."""

    agents: list[BaseAgent]
    tasks: list[Task]
    root = Path(__file__).parent
    agents_config = str(root / "config" / "agents.yaml")
    tasks_config = str(root / "config" / "tasks.yaml")
    agent_definitions = load_yaml(root / "config" / "agents.yaml")

    @agent
    def requirement_normaliser(self) -> Agent:
        """Build the configured Qwen normalization agent."""
        return Agent(
            config=self.agents_config["requirement_normaliser"],  # type: ignore[index]
            llm=build_llm("intake_normaliser"),
            allow_delegation=False,
            verbose=False,
        )

    @task
    def apply_preset_and_normalise(self) -> Task:
        """Classify only the free-text qualitative language."""
        return Task(
            config=self.tasks_config["apply_preset_and_normalise"],  # type: ignore[index]
            output_pydantic=QualitativeHints,
        )

    @crew
    def crew(self) -> Crew:
        """Return a sequential crew with a single model-backed task."""
        configure_runtime_storage()
        return Crew(agents=self.agents, tasks=self.tasks, process=Process.sequential, verbose=False)
