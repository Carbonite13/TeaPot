# DUK Slice Advisor architecture

DUK recommends one of eMBB, URLLC, or mMTC from a validated application profile. The recommendation is decision support; catalogue profiles, scoring parameters, and provisioning are simulated. Nothing in this service contacts a mobile network provider.

## Runtime layers

1. Intake validates the six declared requirements, applies an optional versioned preset, and reserves a measured-profile importer interface. Every normalized value retains its `declared`, `preset`, or `measured` provenance.
2. Analysis is deterministic Python: load simulated catalogue profiles through `SliceProvider`, calculate per-field fit, apply versioned weights and softmax, then search bounded one- and two-field counterfactuals. No model is called for these calculations.
3. Reasoning may explain the immutable analysis trace. A separate reviewer checks numeric claims; failed review triggers one retry and then a no-prose deterministic response.

`DecisionFlow` is the orchestration boundary and runs its typed async stage methods in intake, analysis, reasoning, and audit order. Deterministic work belongs in plain functions called by Flow methods. LLM-powered work belongs in small sequential crews loaded from YAML using `yaml.safe_load`; crews use CrewAI's async kickoff API from Flow methods.

The installed CrewAI 1.15.28 `Flow.kickoff()` stalled at its internal `asyncio.to_thread` completion future in this runtime, including with flow events suppressed. The API therefore calls `DecisionFlow.run_pipeline()` to execute those same Flow stage methods sequentially. This workaround avoids the stalled Flow runner while retaining Flow state, stage methods, and CrewAI crews; switching back to native `.kickoff()` requires verifying that runtime issue is resolved.

## Model provider

CrewAI's documented custom OpenAI-compatible endpoint configuration uses `LLM` with `base_url` and `api_key`. DUK configures the requested Cirrascale URL and reads `CIRRASCALE_API_KEY` from the environment. The endpoint URL and OpenAI-compatible transport are configured as requested; actual model IDs and endpoint behavior require credentials and an integration smoke test. Never commit the key.

The Qwen2.5 alternative in `config/models.toml` is marked unconfirmed. Confirm the exact checkpoint with the project owner before benchmarking it. A live SlicerAPI smoke request reached the configured Cirrascale endpoint, but the configured Llama models returned HTTP 429 with “model/rate limits not configured”; the deterministic response completed without prose. Configure those model/rate limits on the provider account before expecting model explanations.

## Standards references

The input-to-standard mappings in the product requirements are not validated by this scaffold. Clause references must be checked against the current releases before presenting a standards-compliance claim. Simulated catalogue targets and scoring weights are explicit application assumptions, not 3GPP or ITU thresholds. In particular, standards do not prescribe this application's category fit weights; the requirement that every model weight trace to a standards value needs a product decision or a revised criterion.
