"""Typed SlicerAPI request and response models shared with DUK workflows."""

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

from duk.schemas.api import (
    DecisionResult,
    GenerateRequest as DecisionRequest,
    JobAccepted,
    JobStatus,
    RequirementOverrides,
)


class GenerateRequest(BaseModel):
    """Accept legacy SlicerAPI fields and normalize them to the DUK request contract."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    natural_query: str | None = Field(default=None, max_length=4000)
    preset_name: str | None = None
    parametric_query: RequirementOverrides = Field(
        default_factory=RequirementOverrides,
        validation_alias=AliasChoices("parametric_query", "parameteric_query"),
    )
    requirements: RequirementOverrides | None = None

    @model_validator(mode="after")
    def reject_conflicting_requirement_sources(self) -> "GenerateRequest":
        """Prevent two input formats from silently overriding one another."""
        primary = self.parametric_query.model_dump(exclude_none=True)
        alternate = self.requirements.model_dump(exclude_none=True) if self.requirements else {}
        conflicts = [key for key in primary.keys() & alternate.keys() if primary[key] != alternate[key]]
        if conflicts:
            raise ValueError(f"Conflicting requirement values supplied in parametric_query and requirements: {', '.join(sorted(conflicts))}")
        return self

    def to_decision_request(self) -> DecisionRequest:
        """Translate the SlicerAPI payload into the canonical DUK schema."""
        supplied = self.parametric_query.model_dump(exclude_none=True)
        supplied.update(self.requirements.model_dump(exclude_none=True) if self.requirements else {})
        return DecisionRequest(
            preset_name=self.preset_name,
            requirements=RequirementOverrides.model_validate(supplied),
            description=self.natural_query,
        )


class GenerateResponse(JobStatus):
    """Expose the shared progress/result contract from a SlicerAPI status endpoint."""


class GenerateAccepted(JobAccepted):
    """Acknowledge a submitted SlicerAPI decision job."""


__all__ = [
    "DecisionResult",
    "GenerateAccepted",
    "GenerateRequest",
    "GenerateResponse",
]
