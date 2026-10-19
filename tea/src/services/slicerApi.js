/**
 * slicerApi.js
 * 
 * Integration layer connecting the Tea (React/Vite frontend) with the Pot (FastAPI backend).
 * 
 * Backend Contract:
 * - Router prefix: /v1/generate (pot/src/SlicerAPI/main.py)
 * - Route endpoint: /v1/generate/ (pot/src/SlicerAPI/api/v1/routes/generate.py)
 * - Schema: GenerateResponse (pot/src/SlicerAPI/models/generate.py)
 *   Fields:
 *     - natural_query: string
 *     - parameteric_query: object
 *     - raw_response: string
 *     - justification: string
 *     - counter_factuals: string
 *     - sst: string ("1" | "2" | "3" | "4")
 *     - sd: string ("0x000001", etc.)
 *     - deployment_architecture: string
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
 * Normalizes SST identifier into a numeric SST and metadata
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
 * Checks if the Pot SlicerAPI backend is reachable
 */
export async function checkBackendStatus() {
  const url = `${API_BASE}/v1/generate/`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return { online: true, url };
    }
    return { online: false, url, status: res.status };
  } catch {
    return { online: false, url };
  }
}

/**
 * Submits requirements to the Pot SlicerAPI backend (/v1/generate/)
 * and merges the result with the comprehensive 3GPP slice profile.
 */
export async function generateSliceRecommendation({
  mode,
  promptText,
  specs,
  candidateRecommendation,
}) {
  const candidateSst = normalizeSst(candidateRecommendation?.sst || specs?.sst || 1);
  const info = SST_INFO[candidateSst] || SST_INFO[1];

  // Prepare payload exactly matching pot/src/SlicerAPI/models/generate.py: GenerateResponse
  const payload = {
    natural_query: mode === 'prompt' ? promptText : `Requirements: Latency ${specs.latency}ms, DL ${specs.downlink}Mbps, UL ${specs.uplink}Mbps, Reliability ${specs.reliability}%, Mobility ${specs.mobility}, Density ${specs.density}/km²`,
    // Both spellings supplied for resilience:
    parameteric_query: {
      latency: specs.latency,
      downlink: specs.downlink,
      uplink: specs.uplink,
      reliability: specs.reliability,
      mobility: specs.mobility,
      density: specs.density,
      jitter: specs.jitter || 'Standard',
      mode,
    },
    parametric_query: {
      latency: specs.latency,
      downlink: specs.downlink,
      uplink: specs.uplink,
      reliability: specs.reliability,
      mobility: specs.mobility,
      density: specs.density,
      jitter: specs.jitter || 'Standard',
      mode,
    },
    sst: String(candidateSst),
    sd: candidateRecommendation?.sd || info.defaultSd,
    justification: candidateRecommendation?.summary || '',
    counter_factuals: candidateRecommendation?.counterFactuals || info.defaultCounterFactual,
    deployment_architecture: candidateRecommendation?.edgeStrategy || info.defaultEdgeStrategy,
    raw_response: '',
  };

  const endpoint = `${API_BASE}/v1/generate/`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      const resolvedSst = data.sst ? normalizeSst(data.sst) : candidateSst;
      const resolvedInfo = SST_INFO[resolvedSst] || info;

      return {
        success: true,
        source: 'backend',
        sourceBadge: 'Verified by SlicerAPI Backend (/v1/generate)',
        sliceName: resolvedInfo.sliceName,
        sst: resolvedSst,
        sd: data.sd || candidateRecommendation?.sd || resolvedInfo.defaultSd,
        confidence: candidateRecommendation?.confidence || 95,
        fiveQi: candidateRecommendation?.fiveQi || resolvedInfo.fiveQi,
        delayBudget: candidateRecommendation?.delayBudget || `${specs.latency} ms`,
        per: candidateRecommendation?.per || resolvedInfo.per,
        headline: resolvedInfo.headline,
        summary: data.justification?.trim() || candidateRecommendation?.summary || '',
        reasons: candidateRecommendation?.reasons || [],
        edgeStrategy: data.deployment_architecture?.trim() || candidateRecommendation?.edgeStrategy || resolvedInfo.defaultEdgeStrategy,
        counterFactuals: data.counter_factuals?.trim() || candidateRecommendation?.counterFactuals || resolvedInfo.defaultCounterFactual,
        rawResponse: data.raw_response || JSON.stringify(data, null, 2),
      };
    }
  } catch (err) {
    // If backend is not running or proxy not active, fallback seamlessly
    console.warn('SlicerAPI backend call fallback to local engine:', err?.message || err);
  }

  // Graceful fallback to local model simulation
  return {
    success: false,
    source: 'local',
    sourceBadge: 'Synthesized by SlicerAPI Local Engine',
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
    rawResponse: JSON.stringify(payload, null, 2),
  };
}
