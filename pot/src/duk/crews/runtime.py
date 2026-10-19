"""Writable local storage configuration for CrewAI's execution metadata."""

import os
from pathlib import Path


def configure_runtime_storage() -> Path:
    """Set a project-local CrewAI storage directory unless an operator chose one."""
    path = Path(os.environ.get("CREWAI_STORAGE_DIR", "data/runtime/crewai")).resolve()
    path.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("CREWAI_STORAGE_DIR", str(path))
    return path
