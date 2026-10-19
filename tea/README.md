# TeaPot Frontend (`tea`)

An intelligent 5G network slice recommendation platform built with Vite 8 and React 19.

## Overview

`tea` provides a dual-input UI for application developers and network engineers:
1. **Prompting (Direct AI)**: Natural language requirements processing.
2. **Key-Value Pairs (Step-by-Step)**: Guided 3-step SLA & QoS telemetry configuration.

## Backend Integration (`pot` FastAPI Server)

The frontend connects to the backend in `pot/` (`pot/src/SlicerAPI`):
- **API Endpoint**: `/v1/generate/`
- **Schema**: `GenerateResponse` (`natural_query`, `parameteric_query`, `sst`, `sd`, `justification`, `counter_factuals`, `deployment_architecture`, `raw_response`).
- **Proxy Configuration**: `vite.config.js` proxies `/v1` requests to `http://localhost:8000` (configurable via `VITE_BACKEND_URL`).
- **Resilience**: If the backend is running, the UI verifies against it. If offline, the frontend seamlessly operates in local simulation mode.

## Development

```bash
# Install dependencies
npm install

# Run frontend dev server (with /v1 proxy to backend)
npm run dev

# Run lint
npm run lint

# Build production bundle
npm run build
```
