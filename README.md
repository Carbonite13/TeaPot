# TeaPot 🫖

> An intelligent, end-to-end 5G network slice recommendation and decision-support platform adhering to 3GPP Release-18 specifications.

TeaPot pairs a modern, responsive React frontend (**`tea`**) with a high-performance Python FastAPI multi-agent reasoning engine (**`pot` / DUK**). It evaluates complex application QoS/SLA constraints (latency, throughput, packet error rate, mobility, device density, ARP, and criticality) to recommend optimal 5G network slices (`eMBB`, `URLLC`, `mMTC`, or `V2X`), generate bounded counterfactuals, and provide trace-verified explanations.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                          TeaPot Frontend (`tea/`)                       │
│    React 19 • Vite 8 • Dual-Input UI (NLP Prompting / Telemetry Stepper)│
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTP / SSE (/api/v1/...)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        TeaPot Backend (`pot/` - DUK)                    │
│                FastAPI • Pydantic v2 • 3GPP Rel-18 Matrix              │
├────────────────────────────────────────────────────────────────────────┤
│  1. Intake Layer    : Validates 8 telemetry metrics & resolves presets  │
│  2. Analysis Layer  : Computes deterministic slice fits & probabilities │
│  3. Reasoning Layer : Multi-Agent LLM explanation with numeric review   │
│  4. Audit Layer     : Persists immutable JSONL decision records         │
└────────────────────────────────────────────────────────────────────────┘
```

### Supported 5G Network Slices (3GPP Rel-18)
- **eMBB (Enhanced Mobile Broadband - SST 1)**: High-bandwidth streaming, AR/VR, campus media workloads.
- **URLLC (Ultra-Reliable Low-Latency Communication - SST 2)**: Mission-critical, life-safety, sub-10ms robotics, industrial automation.
- **mMTC (Massive Machine-Type Communication - SST 3)**: Ultra-dense smart city sensor grids and IoT telemetry.
- **V2X (Vehicle-to-Everything - SST 4)**: High-mobility connected vehicular networks and autonomous drone fleets.

---

## Repository Structure

```text
TeaPot/
├── tea/                      # Frontend Application (React 19 + Vite 8)
│   ├── src/
│   │   ├── components/       # Stepper, NetworkSliceRecommender, Preset Cards
│   │   ├── services/         # slicerApi.js (Canonical schema, async polling & fallback)
│   │   └── ...
│   ├── package.json
│   └── vite.config.js        # Reverse proxy: /api -> http://localhost:8000
│
├── pot/                      # Backend Service (DUK - Decision & Utility Kernel)
│   ├── config/               # models.toml, scoring weights
│   ├── data/                 # presets/, audit logs, and runtime storage
│   ├── src/
│   │   └── duk/              # FastAPI app, CrewAI flows, scorers, schemas
│   ├── pyproject.toml        # Poetry configuration & dependencies
│   ├── run_backend.ps1       # One-click backend startup script (PowerShell)
│   └── run_backend.bat       # One-click backend startup script (CMD)
│
└── README.md                 # Project root documentation
```

---

## Key Features

1. **Dual Input Modalities**:
   - **Direct Natural Language Prompting**: Automatic heuristic extraction of latency, uplink/downlink throughput, reliability, and mobility profiles from free-form text.
   - **Structured SLA / QoS Stepper**: Fine-grained configuration across 3 guided telemetry steps.
2. **Deterministic 3GPP Rel-18 Decision Engine**:
   - Math-grounded multi-criteria scoring matrix evaluated against standard 3GPP specifications.
3. **Multi-Agent Explainability with Numeric Consistency Review**:
   - Multi-agent flow (Intake Normalizer, Reasoner, Consistency Reviewer).
   - Strict hallucination guard: Any numeric claim absent from the deterministic trace is rejected.
4. **Bounded Counterfactuals**:
   - Reveals the minimum operational adjustment needed to flip the winning slice (e.g., *"If guaranteed throughput is relaxed, recommended slice flips from URLLC to eMBB"*).
5. **Full-Stack Resilience & Offline Fallback**:
   - Seamless offline fallback: If the Python backend is unreachable, the frontend automatically computes recommendations using its built-in client-side 3GPP Rel-18 matrix with zero downtime.
6. **Immutable Audit Trail**:
   - Cryptographically hashed decision records persisted to append-only JSONL files (`pot/data/audit/decisions.jsonl`).

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or later
- **Python**: v3.12 (with Poetry installed: `pip install poetry`)

---

### 1. Launching the Backend (`pot`)

#### Quick Start (Windows PowerShell)
```powershell
cd pot
.\run_backend.ps1
```

#### Manual Start
```bash
cd pot
poetry install
cp .env.example .env
# Optionally configure CIRRASCALE_API_KEY in .env for LLM reasoning
poetry run uvicorn duk.main:app --host 0.0.0.0 --port 8000
```

- **Interactive API Documentation**: [`http://localhost:8000/docs`](http://localhost:8000/docs)
- **Presets Endpoint**: [`http://localhost:8000/api/v1/presets`](http://localhost:8000/api/v1/presets)

---

### 2. Launching the Frontend (`tea`)

In a new terminal:

```bash
cd tea
npm install
npm run dev
```

- **Web Application**: [`http://localhost:5173`](http://localhost:5173)

---

## API Quick Reference

### Submit Generation Request
`POST /api/v1/generate` (Returns `202 Accepted` with `job_id`)

```json
{
  "requirements": {
    "latency_ms": 10,
    "throughput_mbps": 50,
    "throughput_guaranteed": true,
    "reliability_per": 0.00001,
    "mobility": "vehicular",
    "device_density_per_km2": 25000,
    "arp_level": 1,
    "criticality": "life_safety"
  },
  "description": "Autonomous surveillance drones over logistics hubs."
}
```

### Poll Status
`GET /api/v1/generate/{job_id}`

### Stream Progress (SSE)
`GET /api/v1/generate/{job_id}/events`

---

## Testing & Code Quality

### Backend
```bash
cd pot
poetry run pytest
```

### Frontend
```bash
cd tea
npm run lint
npm run build
```
