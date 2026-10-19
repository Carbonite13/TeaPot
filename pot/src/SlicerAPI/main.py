"""Backward-compatible SlicerAPI entry point backed by the DUK CrewAI service."""

from fastapi import FastAPI
from pydantic import Field
from pydantic_settings import BaseSettings

from duk.main import create_app


class Config(BaseSettings):
    """Runtime settings retained for existing SlicerAPI deployments."""

    profile: str = Field(default="dev")


def main(config: Config | None = None) -> FastAPI:
    """Build the shared app exposing both DUK and SlicerAPI decision routes."""
    runtime = config or Config()
    return create_app(title="SlicerAPI / DUK Slice Advisor", debug=runtime.profile == "dev")


app = main()
