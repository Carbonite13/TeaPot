"""Writable local storage configuration for CrewAI's execution metadata."""

import os
from pathlib import Path


def configure_runtime_storage() -> Path:
    """Set a project-local CrewAI storage directory and runtime path."""
    project_root = Path(__file__).resolve().parents[3]
    runtime_dir = Path(os.environ.get("DUK_RUNTIME_DIR", project_root / "data" / "runtime")).resolve()
    crewai_dir = Path(os.environ.get("CREWAI_STORAGE_DIR", runtime_dir / "crewai")).resolve()
    tmp_dir = runtime_dir / "tmp"

    runtime_dir.mkdir(parents=True, exist_ok=True)
    crewai_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    os.environ["CREWAI_STORAGE_DIR"] = str(crewai_dir)
    os.environ["LOCALAPPDATA"] = str(runtime_dir)
    os.environ["APPDATA"] = str(runtime_dir)
    os.environ["TEMP"] = str(tmp_dir)
    os.environ["TMP"] = str(tmp_dir)
    os.environ["CREWAI_DISABLE_TELEMETRY"] = "true"
    os.environ["CREWAI_DISABLE_TRACKING"] = "true"
    os.environ["OTEL_SDK_DISABLED"] = "true"
    os.environ["ANONYMIZED_TELEMETRY"] = "False"

    try:
        import crewai_core.settings as crewai_settings
        config_path = crewai_dir / "settings.json"
        crewai_settings.DEFAULT_CONFIG_PATH = config_path
        crewai_settings.get_writable_config_path = lambda: config_path
    except ImportError:
        pass

    return crewai_dir



