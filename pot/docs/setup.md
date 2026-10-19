# Setup and development

## Requirements

- Python 3.11 or newer and Poetry.
- A Cirrascale API key with access to the configured model IDs for live LLM calls.
- Node.js only when working on the React frontend.

## Install

```bash
poetry lock
poetry install --with dev
cp .env.example .env
# Edit .env and set CIRRASCALE_API_KEY to your secret.
```

Do not commit `.env`. Model selection and generation settings live in `config/models.toml` and can be changed without editing Python code.

## Current project status

The repository is being built in stages. `docs/architecture.md` records the intended boundaries. Run the implemented tests with `poetry run pytest`.

## Standards use

This is simulated decision support, not network provisioning or a standards conformance tool. Verify each cited specification clause against its current release before relying on it operationally.
