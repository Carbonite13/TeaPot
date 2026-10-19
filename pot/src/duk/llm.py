"""Role-configured CrewAI LLM construction for Cirrascale's compatible API."""

import os
import tomllib
from functools import lru_cache
from pathlib import Path
from typing import Any

from crewai import LLM


@lru_cache(maxsize=1)
def model_config(path: Path | None = None) -> dict[str, Any]:
    """Load the role model table and provider options from TOML."""
    config_path = path or Path("config/models.toml")
    with config_path.open("rb") as stream:
        return tomllib.load(stream)


def build_llm(role: str, model_override: str | None = None) -> LLM:
    """Create a CrewAI LLM configured for the selected Cirrascale model role."""
    config = model_config()
    provider = config["provider"]
    role_config = config["roles"][role]
    model = model_override or role_config["model"]
    api_key = os.environ.get(provider["api_key_env"])
    if not api_key:
        raise RuntimeError(f"{provider['api_key_env']} must be set to call the Cirrascale model API")
    return LLM(
        model=f"openai/{model}",
        base_url=provider["base_url"],
        api_key=api_key,
        temperature=role_config["temperature"],
        timeout=provider["timeout_seconds"],
        additional_params=role_config.get("additional_params", {}),
    )
