"""Versioned preset loading and validation."""

import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict

from duk.schemas.requirements import RequirementsInput


class Preset(BaseModel):
    """Named profile whose values satisfy the same schema as declared input."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str
    version: str
    description: str
    values: RequirementsInput


class PresetLoader:
    """Load named presets from validated JSON files."""

    def __init__(self, directory: Path | None = None) -> None:
        """Initialize the loader with a preset directory."""
        self.directory = directory or Path("data/presets")

    def load(self, name: str) -> Preset:
        """Return a preset by its safe filename or raise a clear lookup error."""
        if not name or Path(name).name != name:
            raise ValueError("Preset name must be a simple filename stem")
        path = self.directory / f"{name}.json"
        if not path.is_file():
            raise FileNotFoundError(f"Unknown preset: {name}")
        preset = Preset.model_validate_json(path.read_text(encoding="utf-8"))
        if preset.name != name:
            raise ValueError(f"Preset file name does not match embedded name: {name}")
        return preset


class MeasuredProfileImporter:
    """Future packet-capture or metrics-file feature boundary.

    TODO: implement deterministic feature extraction from approved packet capture
    or metrics formats. Fuzzing, network sandboxing, and target-app orchestration
    are explicitly outside this tool's scope.
    """

    def extract(self, file_path: Path) -> RequirementsInput:
        """Raise until measured-profile extraction is implemented."""
        raise NotImplementedError(f"Measured profile import is not implemented: {file_path.name}")
