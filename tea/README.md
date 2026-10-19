# TeaPot Frontend (`tea`)

An intelligent 5G network slice recommendation platform built with Vite 8 and React 19.

## Overview

`tea` provides a dual-input UI for application developers and network engineers:
1. **Prompting (Direct AI)**: Natural language requirements processing with live telemetry extraction.
2. **Key-Value Pairs (Step-by-Step)**: Guided 3-step SLA & QoS telemetry configuration.

## Backend Integration (`pot` DUK / FastAPI Multi-Agent Engine)

The frontend communicates with the backend in `pot/` using the canonical typed schema:
- **Asynchronous Flow Engine (`duk`)**:
  - `POST /api/v1/generate`: Submits typed `GenerateRequest` (validated `requirements`, optional `preset_name`, optional `description`). Returns `202 Accepted` with `job_id`.
  - `GET /api/v1/generate/:jobId`: Polls job execution progress and retrieves the final `DecisionResult`.
  - `GET /api/v1/generate/:jobId/events`: Streams Server-Sent Events (SSE) for stage updates (`intake` -> `analysis` -> `reasoning` -> `audit`).
  - `GET /api/v1/presets`: Exposes validated 3GPP workload presets (`ambulance_telemetry`, `campus_vr`, `smart_parking`).
- **Proxy Configuration**:
  - `vite.config.js` transparently proxies `/api` requests to `http://localhost:8000` (configurable via `VITE_BACKEND_URL`).
- **Offline Resilience**:
  - If the Python server is offline, the frontend seamlessly falls back to local deterministic 3GPP Release-18 calculation with zero downtime.

## Development

```bash
# 1. Start the Backend (from project root)
cd pot
poetry run uvicorn duk.main:app --port 8000 --reload

# 2. Start the Frontend (in a separate terminal)
cd tea
npm install
npm run dev

# 3. Verify Code Quality
npm run lint
npm run build
```
