/**
 * slicerApi.js
 * 
 * Frontend communication service connecting the Tea (React/Vite frontend)
 * with the Pot (FastAPI / CrewAI DUK Multi-Agent backend).
 * 
 * Architecture:
 * - POST /api/v1/generate: Submits GenerateRequest payload (preset_name, requirements, description).
 * - GET  /api/v1/generate/:jobId: Polls asynchronous job progress and retrieves final DecisionResult.
 * - GET  /api/v1/generate/:jobId/events: Server-Sent Events (SSE) stream for real-time progress.
 * - GET  /api/v1/presets: Discovers validated 3GPP workload profiles.
 * - Offline Fallback: Embedded deterministic 3GPP Release-18 slice mapping when server is unreachable.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

export const SST_INFO = {
  1: {
    sliceName: 'eMBB',
    fullName: 'Enhanced Mobile Broadband',
    fiveQi: 9,
    defaultSd: '0x000001',
    per: '10⁻³',
    defaultDelay: '20 ms',
    headline: 'Enhanced Mobile Broadband (eMBB)',
    defaultEdgeStrategy: 'Regional Distributed UPF with Content Delivery Network (CDN) edge peering',
    defaultCounterFactual: 'If latency ceiling is tightened to <10ms and reliability SLA rises to 99.999%, workload escalates to URLLC (SST-2) requiring pre-emptive radio reservation.',
  },
  2: {
    sliceName: 'URLLC',
    fullName: 'Ultra-Reliable Low-Latency Communication',
    fiveQi: 82,
    defaultSd: '0x000002',
    per: '10⁻⁶',
    defaultDelay: '5 ms',
    headline: 'Ultra-Reliable Low-Latency Communication (URLLC)',
    defaultEdgeStrategy: 'On-Premise / Campus MEC UPF with Direct Hardware Bypass',
    defaultCounterFactual: 'If reliability guarantee is relaxed from 99.999% to 99.9% and latency tolerance exceeds 20ms, carrier duplication can be disabled, saving power under standard eMBB (SST-1).',
  },
  3: {
    sliceName: 'mMTC',
    fullName: 'Massive Machine-Type Communications',
    fiveQi: 79,
    defaultSd: '0x000003',
    per: '10⁻³',
    defaultDelay: '100 ms',
    headline: 'Massive Machine-Type Communications (mMTC)',
    defaultEdgeStrategy: 'Centralized Regional UPF with High-Density Signaling Concentrator',
    defaultCounterFactual: 'If device density drops below 10,000 devices/km² and individual throughput exceeds 25 Mbps, slice transitions from mMTC (SST-3) to eMBB (SST-1) with active scheduled grant carriers.',
  },
  4: {
    sliceName: 'V2X',
    fullName: 'Vehicle-to-Everything',
    fiveQi: 83,
    defaultSd: '0x000004',
    per: '10⁻⁶',
    defaultDelay: '8 ms',
    headline: 'Vehicle-to-Everything (V2X) Dedicated Slice',
    defaultEdgeStrategy: 'Roadside Unit (RSU) / Regional MEC UPF with Multi-access PDU sessions',
    defaultCounterFactual: 'If mobility profile drops to pedestrian/stationary (<10 km/h) and latency allows >20ms, workload shifts from V2X (SST-4) to standard enterprise eMBB (SST-1), saving sidelink PC5 pre-allocation overhead.',
  },
};

/**
 * Validated presets present in the backend catalog (pot/data/presets/).
 */
export const KNOWN_BACKEND_PRESETS = new Set([
  'ambulance_telemetry',
  'campus_vr',
  'smart_parking',
]);

/**
 * Normalizes SST identifier into a numeric SST
 */
export function normalizeSst(sstInput) {
  if (!sstInput) return 1;
  const str = String(sstInput).trim().toLowerCase();
  if (str === '4' || str.includes('v2x')) return 4;
  if (str === '3' || str.includes('mmtc')) return 3;
  if (str === '2' || str.includes('urllc')) return 2;
  return 1;
}

/**
 * Map category name to SST number
 */
export function categoryToSst(category) {
  if (!category) return 1;
  const cat = String(category).trim().toUpperCase();
  if (cat === 'URLLC') return 2;
  if (cat === 'MMTC') return 3;
  if (cat === 'V2X') return 4;
  return 1;
}

/**
 * Maps frontend mobility label to DUK schema mobility enum:
 * 'stationary' | 'pedestrian' | 'vehicular' | 'high_speed'
 */
export function mapMobilityToDuk(mobility) {
  if (!mobility) return 'stationary';
  const lower = String(mobility).toLowerCase();
  if (lower.includes('high') || lower.includes('>120') || lower.includes('>200')) return 'high_speed';
  if (lower.includes('vehic') || lower.includes('car') || lower.includes('uav') || lower.includes('drone')) return 'vehicular';
  if (lower.includes('pedestrian') || lower.includes('walk') || lower.includes('<10')) return 'pedestrian';
  return 'stationary';
}

/**
 * Maps frontend criticality & reliability to DUK criticality enum:
 * 'routine' | 'important' | 'life_safety'
 */
export function mapCriticalityToDuk(criticality, reliability) {
  if (criticality === 'life_safety') return 'life_safety';
  if (criticality === 'important') return 'important';
  if (criticality === 'routine') return 'routine';
  const rel = Number(reliability) || 99.0;
  if (rel >= 99.999) return 'life_safety';
  if (rel >= 99.0) return 'important';
  return 'routine';
}

/**
 * Constructs the canonical GenerateRequest payload conforming strictly
 * to the backend Pydantic schema (duk.schemas.api.GenerateRequest).
 */
export function buildGenerateRequest({
  mode,
  promptText = '',
  specs = {},
  presetName = null,
}) {
  const validPreset = presetName && KNOWN_BACKEND_PRESETS.has(presetName) ? presetName : undefined;
  const reliabilityNum = Number(specs.reliability) || 99.0;
  // Convert reliability percentage into Packet Error Rate (PER), bounded [1e-9, 1e-1]
  const reliabilityPer = Math.max(1e-9, Math.min(1e-1, (100 - reliabilityNum) / 100));

  const mobility = mapMobilityToDuk(specs.mobility);
  const criticality = mapCriticalityToDuk(specs.criticality, reliabilityNum);

  // Derive guaranteed bit rate requirement
  const throughputGuaranteed = Boolean(
    specs.guaranteedThroughput ?? (reliabilityNum > 99.0 || mobility === 'vehicular' || mobility === 'high_speed')
  );

  // Derive ARP level (1 = highest priority life-safety, 15 = lowest priority best-effort)
  const arpLevel = Math.max(
    1,
    Math.min(
      15,
      Number(specs.arpLevel) || (criticality === 'life_safety' ? 1 : (reliabilityNum > 99.9 ? 3 : 8))
    )
  );

  const requirements = {
    latency_ms: Math.max(0.1, Math.min(1000, Number(specs.latency) || 10)),
    throughput_mbps: Math.max(0.001, Math.min(10000, Number(specs.downlink) || 100)),
    throughput_guaranteed: throughputGuaranteed,
    reliability_per: reliabilityPer,
    mobility,
    device_density_per_km2: Math.max(1, Math.min(1e6, Number(specs.density) || 500)),
    arp_level: arpLevel,
    criticality,
  };

  const payload = {
    requirements,
  };

  if (validPreset) {
    payload.preset_name = validPreset;
  }

  if (mode === 'prompt' && promptText?.trim()) {
    payload.description = promptText.trim();
  }

  return payload;
}

/**
 * Checks if the backend DUK engine is reachable.
 */
export async function checkBackendStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_BASE}/api/v1/presets`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const presets = await res.json();
      return {
        online: true,
        type: 'duk',
        url: `${API_BASE}/api/v1`,
        presets: Array.isArray(presets) ? presets : [],
      };
    }
  } catch {
    // Offline
  }

  return { online: false, type: 'offline', url: `${API_BASE}/api/v1`, presets: [] };
}

/**
 * Fetches available presets from the DUK backend (/api/v1/presets).
 */
export async function fetchBackendPresets() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/presets`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('Failed to fetch backend presets:', err?.message || err);
  }
  return null;
}

/**
 * Polls DUK decision job status until completed or failed.
 */
async function pollDukJob(jobId, onProgress, maxAttempts = 120, intervalMs = 1000) {
  const statusUrl = `${API_BASE}/api/v1/generate/${jobId}`;
  let lastSequence = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    try {
      const res = await fetch(statusUrl, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) continue;

      const data = await res.json();

      // Emit new progress events to listener
      if (Array.isArray(data.progress)) {
        for (const evt of data.progress) {
          if (evt.sequence > lastSequence) {
            lastSequence = evt.sequence;
            if (typeof onProgress === 'function') {
              onProgress({
                sequence: evt.sequence,
                status: evt.status,
                message: evt.message,
                timestamp: evt.timestamp,
              });
            }
          }
        }
      }

      if (data.status === 'completed' && data.result) {
        return data.result;
      }

      if (data.status === 'failed') {
        throw new Error(data.error?.message || 'DUK decision job failed.');
      }
    } catch (err) {
      if (err.message?.includes('failed')) throw err;
      // Network blip, retry next iteration
    }
  }

  throw new Error('DUK decision job timed out waiting for completion.');
}

/**
 * Formats counterfactual objects returned by DUK into descriptive insights.
 */
function formatCounterfactuals(cfList, recommendedSlice) {
  if (!Array.isArray(cfList) || cfList.length === 0) return '';

  return cfList
    .map((cf) => {
      const changesText = Object.entries(cf.changes || {})
        .map(([k, v]) => `${k} -> ${typeof v === 'number' ? Number(v.toFixed(3)) : v}`)
        .join(', ');
      return `If ${changesText}, winning slice flips from ${cf.from_category || recommendedSlice} to ${cf.to_category}${cf.verified ? ' [verified]' : ''}.`;
    })
    .join(' ');
}

/**
 * Submits requirements to the DUK Multi-Agent Flow (/api/v1/generate),
 * monitors execution progress, and transforms the DecisionResult into the frontend model.
 * If the backend is offline, falls back seamlessly to the client-side 3GPP Rel-18 engine.
 */
export async function generateSliceRecommendation({
  mode,
  promptText,
  specs,
  candidateRecommendation,
  presetName,
  onProgress,
}) {
  const candidateSst = normalizeSst(candidateRecommendation?.sst || specs?.sst || 1);
  const info = SST_INFO[candidateSst] || SST_INFO[1];

  const payload = buildGenerateRequest({
    mode,
    promptText,
    specs,
    presetName,
  });

  // =========================================================================
  // 1. DUK MULTI-AGENT ASYNC FLOW (POST /api/v1/generate)
  // =========================================================================
  try {
    const res = await fetch(`${API_BASE}/api/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 202) {
      const accepted = await res.json();
      if (typeof onProgress === 'function') {
        onProgress({ status: 'queued', message: 'Job accepted by DUK engine...' });
      }

      // Poll until completion
      const result = await pollDukJob(accepted.job_id, onProgress);

      const resolvedSst = categoryToSst(result.recommended_slice);
      const resolvedInfo = SST_INFO[resolvedSst] || info;
      const probMap = result.probabilities || {};
      const winningProb = probMap[result.recommended_slice] || 0.95;
      const confidencePct = Math.round(winningProb * 100);

      const formattedCf = formatCounterfactuals(result.counterfactuals, result.recommended_slice) || resolvedInfo.defaultCounterFactual;

      const reasons = Object.entries(probMap).map(([category, prob]) => {
        const score = result.scores?.[category];
        const scoreText = typeof score === 'number' ? ` (fit score: ${score.toFixed(3)})` : '';
        return `${category}: ${(prob * 100).toFixed(1)}% probability${scoreText}`;
      });

      return {
        success: true,
        source: 'backend',
        backendType: 'duk',
        sourceBadge: result.reasoning_verified
          ? 'DUK Multi-Agent AI Core (Trace-Verified)'
          : 'DUK Decision Engine',
        sliceName: result.recommended_slice || resolvedInfo.sliceName,
        sst: resolvedSst,
        sd: resolvedInfo.defaultSd,
        confidence: confidencePct,
        fiveQi: resolvedInfo.fiveQi,
        delayBudget: `${result.normalized_requirements?.latency_ms?.value ?? specs.latency} ms`,
        per: result.normalized_requirements?.reliability_per?.value
          ? `10⁻${Math.round(-Math.log10(result.normalized_requirements.reliability_per.value))}`
          : resolvedInfo.per,
        headline: resolvedInfo.headline,
        summary: result.reasoning?.trim() || candidateRecommendation?.summary || resolvedInfo.headline,
        reasons: reasons.length > 0 ? reasons : candidateRecommendation?.reasons || [],
        edgeStrategy: resolvedInfo.defaultEdgeStrategy,
        counterFactuals: formattedCf,
        rawResponse: JSON.stringify(result, null, 2),
        decisionId: result.decision_id,
        weightsVersion: result.weights_version,
      };
    }
  } catch (err) {
    console.debug('DUK backend flow unavailable or offline:', err?.message || err);
  }

  // =========================================================================
  // 2. SEAMLESS FALLBACK: DETERMINISTIC CLIENT-SIDE 3GPP RELEASE-18 CALCULATION
  // =========================================================================
  return {
    success: false,
    source: 'local',
    backendType: 'offline',
    sourceBadge: 'Analysis Returned by Local 3GPP Matrix',
    sliceName: candidateRecommendation?.sliceName || info.sliceName,
    sst: candidateSst,
    sd: candidateRecommendation?.sd || info.defaultSd,
    confidence: candidateRecommendation?.confidence || 92,
    fiveQi: candidateRecommendation?.fiveQi || info.fiveQi,
    delayBudget: candidateRecommendation?.delayBudget || `${specs.latency} ms`,
    per: candidateRecommendation?.per || info.per,
    headline: candidateRecommendation?.headline || info.headline,
    summary: candidateRecommendation?.summary || '',
    reasons: candidateRecommendation?.reasons || [],
    edgeStrategy: candidateRecommendation?.edgeStrategy || info.defaultEdgeStrategy,
    counterFactuals: candidateRecommendation?.counterFactuals || info.defaultCounterFactual,
    rawResponse: JSON.stringify(
      {
        request: payload,
        status: 'offline_fallback',
        note: 'Backend service offline. Result calculated deterministically from 3GPP Release-18 specification matrix.',
      },
      null,
      2
    ),
  };
}
