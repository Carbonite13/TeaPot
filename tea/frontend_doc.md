# Frontend quick context

- Stack: Vite 8 + React 19; the application entry point is `src/main.jsx` and the current page is `src/App.jsx`.
- Global visual tokens and page shell live in `src/index.css`; page-specific rules live in `src/App.css`.
- `src/components/GradientASCII.jsx` renders the animated canvas background (`z-index: -1`, respects `prefers-reduced-motion`).
- Recommender platform lives in `src/components/NetworkSliceRecommender.jsx` and `src/components/NetworkSliceRecommender.css`.
- Backend Integration (`pot` combining):
  - Service layer in `src/services/slicerApi.js` interfaces with the FastAPI backend in `pot/src/SlicerAPI`.
  - Backend endpoint: `/v1/generate/` conforming to `GenerateResponse` schema (`natural_query`, `parameteric_query`, `sst`, `sd`, `justification`, `counter_factuals`, `deployment_architecture`).
  - `vite.config.js` sets up a development and preview proxy forwarding `/v1` requests to `http://localhost:8000` (or `VITE_BACKEND_URL`), translating the upstream method to GET for the backend's `@router.get("/", content: GenerateResponse = Body())` endpoint while forwarding the JSON body.
  - The UI displays backend live connection status (`backend-status-pill`), 3GPP SST/SD badges, 5QI QoS parameters, explainable telecom justification, counterfactual sensitivity analysis, and an expandable SlicerAPI contract trace viewer.
  - Automatic fallback: If the backend server is offline or unreachable, the frontend gracefully falls back to the embedded 3GPP Rel-18 expert recommendation engine without disruption.
- Verify frontend changes with `npm run lint` and `npm run build` from `tea/`.
