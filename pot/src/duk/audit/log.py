"""Append-only, idempotent JSONL persistence for completed decisions."""

try:
    import fcntl
except ImportError:
    fcntl = None  # type: ignore

try:
    import portalocker
except ImportError:
    portalocker = None  # type: ignore

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict

from duk.schemas.requirements import NormalizedRequirements
from duk.tools.counterfactuals import Counterfactual


class AuditRecord(BaseModel):
    """Complete decision record, including the trace and model-produced prose."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    timestamp: datetime
    decision_id: str
    raw_input: dict[str, Any]
    normalized_requirements: NormalizedRequirements
    preset_name: str | None
    preset_version: str | None
    scoring_weights_version: str
    probabilities: dict[str, float]
    counterfactuals: list[Counterfactual]
    reasoning_text: str
    model_names: dict[str, str]
    layer_snapshots: dict[str, dict[str, Any]]


def decision_id_for(raw_input: dict[str, Any], preset_version: str | None, weights_version: str) -> str:
    """Create a stable idempotency key from the full decision inputs and versions."""
    identity = json.dumps(
        {"raw_input": raw_input, "preset_version": preset_version, "weights_version": weights_version},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    ).encode("utf-8")
    return hashlib.sha256(identity).hexdigest()


class JsonlAuditWriter:
    """Persist at most one immutable record per decision id."""

    def __init__(self, path: Path | None = None) -> None:
        """Initialize the writer with an append-only audit path."""
        self.path = path or Path("data/audit/decisions.jsonl")

    def append_once(self, record: AuditRecord) -> AuditRecord:
        """Append the record atomically, or return the existing identical decision."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a+", encoding="utf-8") as stream:
            if fcntl is not None:
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
            elif portalocker is not None:
                portalocker.lock(stream, portalocker.LOCK_EX)

            stream.seek(0)
            for line in stream:
                existing = json.loads(line)
                if existing.get("decision_id") == record.decision_id:
                    return AuditRecord.model_validate(existing)
            stream.seek(0, 2)
            stream.write(record.model_dump_json() + "\n")
            stream.flush()
            return record


def new_record(
    *,
    raw_input: dict[str, Any],
    normalized_requirements: NormalizedRequirements,
    preset_name: str | None,
    preset_version: str | None,
    scoring_weights_version: str,
    probabilities: dict[str, float],
    counterfactuals: list[Counterfactual],
    reasoning_text: str,
    model_names: dict[str, str],
    layer_snapshots: dict[str, dict[str, Any]],
) -> AuditRecord:
    """Build a complete record with a UTC timestamp and stable decision id."""
    return AuditRecord(
        timestamp=datetime.now(UTC),
        decision_id=decision_id_for(raw_input, preset_version, scoring_weights_version),
        raw_input=raw_input,
        normalized_requirements=normalized_requirements,
        preset_name=preset_name,
        preset_version=preset_version,
        scoring_weights_version=scoring_weights_version,
        probabilities=probabilities,
        counterfactuals=counterfactuals,
        reasoning_text=reasoning_text,
        model_names=model_names,
        layer_snapshots=layer_snapshots,
    )
