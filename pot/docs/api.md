# HTTP API

The service exposes a versioned API at `/api/v1`. `POST /generate` queues the CrewAI Flow and returns immediately. The response includes a status URL and a server-sent events (SSE) URL. The analysis emits progress events for intake, deterministic analysis, reasoning/review, and audit. The SSE stream sends `progress` events until a terminal `done` event. Clients can also poll the status URL for the accumulated progress and final result.

## Start a decision

```bash
curl -X POST http://localhost:8000/api/v1/generate \
  -H 'Content-Type: application/json' \
  -d '{"preset_name":"campus_vr"}'
```

To supply all values directly, use `requirements` with `latency_ms`, `throughput_mbps`, `throughput_guaranteed`, `reliability_per`, `mobility`, `device_density_per_km2`, `arp_level`, and `criticality`. A preset can also be combined with any subset of these validated overrides. Out-of-range overrides fail request validation with a field-specific 422 detail.

```json
{
  "preset_name": "campus_vr",
  "requirements": {"throughput_mbps": 250},
  "description": "High bandwidth for pedestrian virtual reality"
}
```

When a description is supplied, the intake model classifies qualitative phrases only. Numeric parsing and conversion remain deterministic. This model-backed step requires `CIRRASCALE_API_KEY`.

## Watch progress

```bash
curl -N http://localhost:8000/api/v1/generate/JOB_ID/events
curl http://localhost:8000/api/v1/generate/JOB_ID
```

The final status contains the recommendation, probabilities, fit scores, reviewed explanation, counterfactuals, and field-level provenance. If numeric review fails twice, `reasoning` is an empty string and the deterministic result remains available.

## Other routes

- `GET /api/v1/presets` returns available preset names and versions.
- OpenAPI documentation is available at `/docs` and `/redoc`.

This API simulates a slice catalogue and never provisions a network slice.
