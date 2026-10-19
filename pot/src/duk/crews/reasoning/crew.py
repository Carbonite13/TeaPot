"""CrewAI crew for trace-bound explanation and numeric consistency review."""

from pathlib import Path
from typing import Any

from crewai import Agent, Crew, Process, Task
from crewai.agents.agent_builder.base_agent import BaseAgent
from crewai.project import CrewBase, agent, crew, task
from pydantic import BaseModel, ConfigDict

from duk.crews.configuration import load_yaml
from duk.crews.runtime import configure_runtime_storage
from duk.llm import build_llm, model_config


class Explanation(BaseModel):
    """Reasoning prose returned from the explanation task."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    text: str


class ReviewResult(BaseModel):
    """Independent model review result for a proposed explanation."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    valid: bool
    issues: list[str]


@CrewBase
class ReasoningCrew:
    """Sequential explanation/review crew with role-specific configured models."""

    agents: list[BaseAgent]
    tasks: list[Task]
    root = Path(__file__).parent
    agents_config = str(root / "config" / "agents.yaml")
    tasks_config = str(root / "config" / "tasks.yaml")
    agent_definitions = load_yaml(root / "config" / "agents.yaml")

    @agent
    def reasoning_agent(self) -> Agent:
        """Build the Llama 70B explainer, falling back to configured 8B model."""
        return Agent(
            config=self.agents_config["reasoning_agent"],  # type: ignore[index]
            llm=build_llm("reasoner"),
            allow_delegation=False,
            verbose=False,
        )

    @agent
    def consistency_reviewer(self) -> Agent:
        """Build the independent Llama 8B numeric reviewer."""
        return Agent(
            config=self.agents_config["consistency_reviewer"],  # type: ignore[index]
            llm=build_llm("consistency_reviewer"),
            allow_delegation=False,
            verbose=False,
        )

    @task
    def explain_decision(self) -> Task:
        """Write prose based only on the supplied deterministic trace."""
        return Task(
            config=self.tasks_config["explain_decision"],  # type: ignore[index]
            output_pydantic=Explanation,
        )

    @task
    def verify_explanation(self) -> Task:
        """Review the explanation against the same trace and return a verdict."""
        return Task(
            config=self.tasks_config["verify_explanation"],  # type: ignore[index]
            output_pydantic=ReviewResult,
        )

    @crew
    def crew(self) -> Crew:
        """Return the ordered explainer and reviewer tasks."""
        configure_runtime_storage()
        return Crew(agents=self.agents, tasks=self.tasks, process=Process.sequential, verbose=False)

    async def run(self, inputs: dict[str, Any]) -> tuple[Explanation, ReviewResult]:
        """Run the configured reasoner and retry once with its configured fallback."""
        crew = self.crew()
        try:
            result = await crew.akickoff(inputs=inputs)
        except Exception:
            fallback = model_config()["roles"]["reasoner"].get("fallback", [])
            if not fallback:
                raise
            self.agents[0].llm = build_llm("reasoner", fallback[0])
            result = await Crew(
                agents=self.agents,
                tasks=self.tasks,
                process=Process.sequential,
                verbose=False,
            ).akickoff(
                inputs=inputs,
            )
        explanation = result.tasks_output[0].pydantic
        review = result.tasks_output[1].pydantic
        if not isinstance(explanation, Explanation) or not isinstance(review, ReviewResult):
            raise ValueError("CrewAI did not return the expected typed explanation and review outputs")
        return explanation, review
