```mermaid
flowchart TB
  SYS["DUK Slice Advisor"]
  SYS --> C1
  SYS --> C2
  SYS --> C3
  SYS -.->|"after each crew, orchestrator writes"| AUD[("Audit log<br/>not an agent")]

  subgraph C1["Crew 1: Intake (sequential)"]
    direction TB
    A1["Agent: Input Validator<br/>LLM: none"]
    A2["Agent: Requirement Normaliser<br/>LLM: Qwen3 8B non-thinking"]
    A3["Agent: Profile Importer<br/>LLM: none"]
    T1["Task: validate_and_sanitise<br/>tool: schema validator"]
    T2["Task: apply_preset_and_normalise<br/>tool: preset loader"]
    T3["Task: extract_measured_features<br/>runs only if pcap or metrics given<br/>tool: pcap feature extractor"]
    T4["Task: emit_typed_requirements<br/>output: schema with provenance tags"]
    A1 --> T1
    A2 --> T2
    A3 --> T3
    T1 --> T2 --> T3 --> T4
  end

  subgraph C2["Crew 2: Analysis (sequential, T5 and T6 parallel)"]
    direction TB
    A4["Agent: Requirement Analyst<br/>LLM: none"]
    A5["Agent: Slice Catalogue Agent<br/>LLM: none"]
    A6["Agent: Decision Analyst<br/>LLM: none"]
    A7["Agent: Counterfactual Analyst<br/>LLM: none"]
    T5["Task: compute_fit_scores<br/>tool: per-requirement scorer"]
    T6["Task: fetch_slice_profiles<br/>tool: SliceProvider simulated"]
    T7["Task: determine_probabilities<br/>tool: softmax scorer, weights versioned"]
    T8["Task: search_counterfactuals<br/>tool: 1 to 2 parameter search"]
    A4 --> T5
    A5 --> T6
    A6 --> T7
    A7 --> T8
    T5 --> T7
    T6 --> T7
    T7 --> T8
  end

  subgraph C3["Crew 3: Reasoning (sequential)"]
    direction TB
    A8["Agent: Reasoning Agent<br/>LLM: Llama 70B, fallback Llama 8B"]
    A9["Agent: Consistency Reviewer<br/>LLM: Llama 8B"]
    T9["Task: explain_decision<br/>input: trace and counterfactuals"]
    T10["Task: verify_explanation<br/>checks every number against trace"]
    A8 --> T9
    A9 --> T10
    T9 --> T10
  end

  T4 -.->|"typed requirements"| T5
  T4 -.->|"typed requirements"| T6
  T8 -.->|"scores, trace, counterfactuals"| T9
  T10 --> OUT["Response to FastAPI, then React UI"]
```
Only two agents call an LLM for their main work: the Requirement Normaliser (Qwen3 8B) and the Reasoning Agent (Llama 70B). The Consistency Reviewer uses Llama 8B because it only compares text against numbers. Everything else is deterministic, which keeps the probabilities reproducible.
