# DUK Slice Advisor

DUK Slice Advisor is a decision-support API and browser interface that recommends eMBB, URLLC, or mMTC from six application connectivity requirements. It returns deterministic category probabilities, input provenance, bounded counterfactuals, and a reviewed natural-language explanation. Provisioning is simulated; no live network provider is contacted.

## Quick start

```bash
poetry install --with dev
cp .env.example .env
# Set CIRRASCALE_API_KEY in .env for description normalisation and explanations.
poetry run uvicorn duk.main:app --reload --env-file .env
```

The API reference is at `http://localhost:8000/docs`. To start the React client, use another terminal:

```bash
cd frontend
npm install
npm run dev
```

Run automated checks with `poetry run pytest`.

## API workflow

`POST /api/v1/generate` returns `202 Accepted` and a job ID. Poll the returned `status_url` or subscribe to its `events_url` using server-sent events. `GET /api/v1/presets` lists the bundled profiles. See [docs/api.md](docs/api.md) for request examples and response models.

## Model configuration

The role-to-model mapping and Cirrascale-compatible API endpoint are configured in `config/models.toml`. Set `CIRRASCALE_API_KEY` in the environment; secrets are never placed in TOML or source. Model tags in the default config must be confirmed against the account’s Cirrascale model catalogue. The Qwen2.5 32B optional checkpoint remains explicitly unconfirmed.

## Project guidance

- [Setup and development](docs/setup.md)
- [HTTP API](docs/api.md)
- [Architecture and decision boundaries](docs/architecture.md)

Specification clause references in the scoring metadata are marked “to verify” where they have not been checked against the current published releases. Scoring weights and profile targets are application policy values, not 3GPP or ITU mandated category scores.
