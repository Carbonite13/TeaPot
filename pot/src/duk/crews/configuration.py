"""Safe YAML loading for CrewAI crew configuration files."""

from pathlib import Path
from typing import Any

import yaml


def load_yaml(path: Path) -> dict[str, Any]:
    """Read one UTF-8 YAML mapping with the safe PyYAML loader."""
    value = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Crew configuration must be a YAML mapping: {path}")
    return value
