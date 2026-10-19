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

The FastAPI service, asynchronous decision jobs, simulated provider, CrewAI flows, and React interface are implemented. Run the test suite with `poetry run pytest`.

## Run the service

```bash
poetry run uvicorn duk.main:app --reload --env-file .env
```

Open `http://localhost:8000/docs` for the generated API reference. Start the browser app in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The browser app uses `http://localhost:8000/api/v1` by default. Set `VITE_API_BASE_URL` to change it.

## Standards use

This is simulated decision support, not network provisioning or a standards conformance tool. Verify each cited specification clause against its current release before relying on it operationally.
