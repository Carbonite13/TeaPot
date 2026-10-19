"""Command-line entry point for running the DUK Slice Advisor API."""

import argparse

import uvicorn


def main() -> None:
    """Start the API server with configurable bind address and port."""
    parser = argparse.ArgumentParser(description="Run the DUK Slice Advisor API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    uvicorn.run("duk.main:app", host=args.host, port=args.port, env_file=".env")
