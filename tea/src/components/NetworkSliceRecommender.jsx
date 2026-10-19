import { useState, useMemo, useCallback } from 'react';
import Stepper, { Step } from './Stepper';
import AnalyseButton from './AnalyseButton';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon, AiSparklesIcon, SlidersHorizontalIcon } from '@hugeicons/core-free-icons';
import { generateSliceRecommendation, buildGenerateRequest } from '../services/slicerApi';
import './NetworkSliceRecommender.css';

function extractSpecsFromPrompt(text) {
  const lower = text.toLowerCase();

  // Latency (ms)
  let detectedLatency = null;
  const latMatch = lower.match(/(?:sub-?|<|<=|around|~)?\s*(\d+(?:\.\d+)?)\s*(?:ms|milliseconds?)/);
  if (latMatch) {
    detectedLatency = Math.max(1, Math.round(parseFloat(latMatch[1])));
  }

  // Downlink Throughput (Mbps)
  let detectedDownlink = null;
  const dlMatch =
    lower.match(/(?:downlink|download|dl|bandwidth|throughput|stream)[^\d]*(\d+(?:\.\d+)?)\s*(?:mbps|gbps|kbps)/) ||
    lower.match(/(\d+(?:\.\d+)?)\s*(?:mbps|gbps|kbps)\s*(?:downlink|download|dl)/) ||
    lower.match(/(\d+(?:\.\d+)?)\s*(?:mbps|gbps|kbps)/);
  if (dlMatch) {
    let val = parseFloat(dlMatch[1]);
    if (dlMatch[0].includes('gbps')) val *= 1000;
    else if (dlMatch[0].includes('kbps')) val /= 1000;
    detectedDownlink = val >= 1 ? Math.round(val) : parseFloat(val.toFixed(3));
  }

  // Uplink Throughput (Mbps)
  let detectedUplink = null;
  const ulMatch =
    lower.match(/(?:uplink|upload|ul)[^\d]*(\d+(?:\.\d+)?)\s*(?:mbps|gbps|kbps)/) ||
    lower.match(/(\d+(?:\.\d+)?)\s*(?:mbps|gbps|kbps)\s*(?:uplink|upload|ul)/);
  if (ulMatch) {
    let val = parseFloat(ulMatch[1]);
    if (ulMatch[0].includes('gbps')) val *= 1000;
    else if (ulMatch[0].includes('kbps')) val /= 1000;
    detectedUplink = val >= 1 ? Math.round(val) : parseFloat(val.toFixed(3));
  }

  // Reliability (%)
  let detectedReliability = null;
  const relMatch = lower.match(/(?:reliability|sla|guarantee|uptime)[^\d]*(\d{2}(?:\.\d+)?)\s*%/);
  if (relMatch) {
    detectedReliability = parseFloat(relMatch[1]);
  } else if (lower.includes('five 9s') || lower.includes('99.999')) {
    detectedReliability = 99.999;
  } else if (lower.includes('four 9s') || lower.includes('99.99')) {
    detectedReliability = 99.99;
  } else if (lower.includes('three 9s') || lower.includes('99.9')) {
    detectedReliability = 99.9;
  }

  // Mobility
  let detectedMobility = 'Stationary';
  if (
    lower.includes('high-speed') ||
    lower.includes('high speed') ||
    lower.includes('train') ||
    lower.includes('rail') ||
    lower.includes('>200')
  ) {
    detectedMobility = 'High-Speed (>200 km/h)';
  } else if (
    lower.includes('vehicle') ||
    lower.includes('vehicular') ||
    lower.includes('drone') ||
    lower.includes('uav') ||
    lower.includes('car') ||
    lower.includes('transit') ||
    lower.includes('platoon') ||
    lower.includes('automotive') ||
    lower.includes('v2x') ||
    lower.includes('120 km/h')
  ) {
    detectedMobility = 'Vehicular (<120 km/h)';
  } else if (
    lower.includes('pedestrian') ||
    lower.includes('wearable') ||
    lower.includes('handheld') ||
    lower.includes('walking') ||
    lower.includes('phone') ||
    lower.includes('mobile user')
  ) {
    detectedMobility = 'Pedestrian (<10 km/h)';
  } else if (
    lower.includes('stationary') ||
    lower.includes('sensor') ||
    lower.includes('meter') ||
    lower.includes('smart grid') ||
    lower.includes('fixed') ||
    lower.includes('static')
  ) {
    detectedMobility = 'Stationary';
  }

  // Density (devices/km²)
  let detectedDensity = null;
  const densityMatch = lower.match(/(\d[\d,]*)\s*(?:devices|sensors|nodes|meters|connections)/);
  if (densityMatch) {
    detectedDensity = parseInt(densityMatch[1].replace(/,/g, ''), 10);
  }

  // Domain categorization heuristics
  const isV2XDomain =
    lower.includes('v2x') ||
    lower.includes('drone') ||
    lower.includes('uav') ||
    lower.includes('vehicle') ||
    lower.includes('platoon') ||
    lower.includes('traffic') ||
    lower.includes('automotive') ||
    lower.includes('highway') ||
    lower.includes('roadside');
  const isURLLCDomain =
    lower.includes('surgery') ||
    lower.includes('surgical') ||
    lower.includes('robot') ||
    lower.includes('haptic') ||
    lower.includes('mission critical') ||
    lower.includes('life') ||
    lower.includes('safety') ||
    lower.includes('deterministic') ||
    lower.includes('tsn') ||
    lower.includes('automation') ||
    lower.includes('teleoperation') ||
    lower.includes('factory');
  const isMMTCDomain =
    lower.includes('sensor') ||
    lower.includes('meter') ||
    lower.includes('smart grid') ||
    lower.includes('iot') ||
    lower.includes('massive') ||
    lower.includes('agriculture') ||
    lower.includes('telemetry') ||
    lower.includes('environmental') ||
    lower.includes('utility');
  const isEMBBDomain =
    lower.includes('video') ||
    lower.includes('stream') ||
    lower.includes('xr') ||
    lower.includes('vr') ||
    lower.includes('ar') ||
    lower.includes('gaming') ||
    lower.includes('broadband') ||
    lower.includes('4k') ||
    lower.includes('8k') ||
    lower.includes('multimedia') ||
    lower.includes('metaverse');

  if (detectedLatency === null) {
    if (isURLLCDomain) detectedLatency = 5;
    else if (isV2XDomain) detectedLatency = 8;
    else if (isEMBBDomain) detectedLatency = 18;
    else if (isMMTCDomain) detectedLatency = 120;
    else detectedLatency = 20;
  }

  if (detectedDownlink === null) {
    if (isEMBBDomain) detectedDownlink = 350;
    else if (isV2XDomain) detectedDownlink = 80;
    else if (isURLLCDomain) detectedDownlink = 120;
    else if (isMMTCDomain) detectedDownlink = 0.5;
    else detectedDownlink = 50;
  }

  if (detectedUplink === null) {
    if (isV2XDomain) detectedUplink = 45;
    else if (isURLLCDomain) detectedUplink = 45;
    else if (isEMBBDomain) detectedUplink = 30;
    else if (isMMTCDomain) detectedUplink = 1.2;
    else detectedUplink = 15;
  }

  if (detectedReliability === null) {
    if (isURLLCDomain || isV2XDomain) detectedReliability = 99.999;
    else detectedReliability = 99.9;
  }

  if (detectedDensity === null) {
    if (isMMTCDomain) detectedDensity = 450000;
    else if (isV2XDomain) detectedDensity = 25000;
    else if (isEMBBDomain) detectedDensity = 12000;
    else detectedDensity = 1500;
  }

  return {
    latency: detectedLatency,
    downlink: detectedDownlink,
    uplink: detectedUplink,
    reliability: detectedReliability,
    mobility: detectedMobility,
    density: detectedDensity,
    domains: { isV2XDomain, isURLLCDomain, isMMTCDomain, isEMBBDomain },
  };
}

function generatePromptRecommendation(specs) {
  const { latency, downlink, uplink, reliability, mobility, density, domains } = specs;
  const delayBudget = `${latency} ms`;
  const per = reliability >= 99.999 ? '10⁻⁶' : '10⁻³';

  // 1. V2X
  if (domains.isV2XDomain || ((mobility.includes('Vehicular') || mobility.includes('High-Speed')) && latency <= 15)) {
    return {
      sliceName: 'V2X',
      sst: 4,
      sd: '0x000004',
      confidence: 98,
      fiveQi: 83,
      delayBudget,
      per,
      headline: 'Vehicle-to-Everything (V2X) Dedicated Slice',
      summary: `Analyzed from your prompt: High mobility (${mobility}) with strict latency (${latency} ms) and ${reliability}% reliability. Standard cellular routing incurs handover latency; a 3GPP SST-4 slice provides direct sidelink PC5 connectivity and dedicated pre-emptive radio scheduling.`,
      reasons: [
        `Natural language prompt highlights vehicular/mobile dynamics (${mobility}), requiring predictive beam tracking.`,
        `Extracted latency threshold (${latency} ms) demands direct Vehicle-to-Infrastructure (V2I) QoS bearer mapping.`,
        `Mission-critical safety profile prioritizes Guaranteed Bit Rate (GBR) with preemption flags enabled.`,
      ],
      edgeStrategy: 'Roadside Unit (RSU) / Regional MEC UPF with Multi-access PDU sessions',
      counterFactuals: 'If mobility drops to stationary/pedestrian (<10 km/h) and latency is relaxed to >20ms, recommendation transitions to standard eMBB (SST-1), reducing sidelink PC5 overhead by ~45%.',
    };
  }

  // 2. mMTC
  if (domains.isMMTCDomain || density >= 100000 || (latency > 60 && downlink < 10)) {
    return {
      sliceName: 'mMTC',
      sst: 3,
      sd: '0x000003',
      confidence: 96,
      fiveQi: 79,
      delayBudget,
      per,
      headline: 'Massive Machine-Type Communications (mMTC)',
      summary: `Analyzed from your prompt: High connection density (${density.toLocaleString()} devices/km²) with lightweight telemetry (${downlink} Mbps DL) and tolerant delay (${latency} ms). mMTC leverages narrowband IoT (NB-IoT/eMTC) signaling to optimize energy and spectrum across dense sensor deployments.`,
      reasons: [
        `Prompt emphasizes sensor/metering scale (${density.toLocaleString()} devices/km²), triggering lightweight connectionless core signaling.`,
        `Low throughput profile (${downlink} Mbps DL) allows extended discontinuous reception (eDRX) power optimization.`,
        `Tolerant latency budget allows flexible radio subframe multiplexing without dedicated high-frequency carriers.`,
      ],
      edgeStrategy: 'Centralized Regional UPF with High-Density Signaling Concentrator',
      counterFactuals: 'If device density drops below 10,000 devices/km² and individual throughput exceeds 25 Mbps, slice transitions to eMBB (SST-1) with active scheduled grant carriers.',
    };
  }

  // 3. URLLC
  if (domains.isURLLCDomain || latency <= 10 || (reliability >= 99.999 && latency < 25)) {
    return {
      sliceName: 'URLLC',
      sst: 2,
      sd: '0x000002',
      confidence: 97,
      fiveQi: 82,
      delayBudget,
      per,
      headline: 'Ultra-Reliable Low-Latency Communication (URLLC)',
      summary: `Analyzed from your prompt: Strict ${latency} ms latency ceiling and ${reliability}% packet reliability. URLLC guarantees sub-slot grant-free transmission and dual-connectivity packet duplication to eliminate packet drop vulnerabilities.`,
      reasons: [
        `Extracted latency constraint (${latency} ms) requires 3GPP mini-slot puncturing over best-effort traffic.`,
        `Ultra-high reliability SLA (${reliability}%) requires Packet Data Convergence Protocol (PDCP) duplication over dual carriers.`,
        `Safety-critical demands dictate deterministic time-sensitive networking (TSN) profile mapping.`,
      ],
      edgeStrategy: 'On-Premise / Campus MEC UPF with Direct Hardware Bypass',
      counterFactuals: 'If reliability SLA is relaxed from 99.999% to 99.9% and latency tolerance exceeds 20ms, carrier duplication can be disabled, saving power under standard eMBB (SST-1).',
    };
  }

  // 4. eMBB
  return {
    sliceName: 'eMBB',
    sst: 1,
    sd: '0x000001',
    confidence: 94,
    fiveQi: 9,
    delayBudget,
    per,
    headline: 'Enhanced Mobile Broadband (eMBB)',
    summary: `Analyzed from your prompt: Sustained high throughput (${downlink} Mbps DL / ${uplink} Mbps UL) with manageable latency (${latency} ms). An eMBB slice allocates carrier aggregation and high-order 256-QAM modulation for maximum spectral efficiency.`,
    reasons: [
      `Throughput requirements (${downlink} Mbps DL) utilize Multi-User MIMO (MU-MIMO) and wideband sub-6GHz spectrum.`,
      `Latency requirement (${latency} ms) fits comfortably within standard 3GPP 1ms slot timing without radio puncturing.`,
      `Commercial public 5G macro slice economics deliver the most cost-effective scalability.`,
    ],
    edgeStrategy: 'Regional Distributed UPF with Content Delivery Network (CDN) edge peering',
    counterFactuals: 'If latency ceiling is tightened to <10ms and reliability SLA rises to 99.999%, workload escalates to URLLC (SST-2) requiring pre-emptive radio reservation.',
  };
}

const toMbps = (val, unit) => {
  const num = Number(val) || 0;
  if (unit === 'Gbps') return num * 1000;
  if (unit === 'Kbps') return num / 1000;
  return num;
};

const fromMbps = (mbpsVal, targetUnit) => {
  const num = Number(mbpsVal) || 0;
  if (targetUnit === 'Gbps') return num / 1000;
  if (targetUnit === 'Kbps') return num * 1000;
  return num;
};

const WORKLOAD_PRESETS = [
  {
    id: 'ambulance_telemetry',
    label: 'Ambulance Telemetry',
    category: 'URLLC',
    description: 'Emergency vehicle telemetry with safety-critical communications.',
    prompt: 'Emergency ambulance telemetry streaming real-time patient vitals, telemetry, and critical diagnostics requiring ultra-reliable 99.9999% SLA and 5ms latency with vehicular mobility.',
    specs: { latency: 5, downlink: 5, downlinkUnit: 'Mbps', uplink: 5, uplinkUnit: 'Mbps', reliability: 99.9999, mobility: 'Vehicular (<120 km/h)', density: 20, jitter: 'Ultra-Low (<1ms)', criticality: 'life_safety' },
  },
  {
    id: 'campus_vr',
    label: 'Campus VR',
    category: 'eMBB',
    description: 'High bandwidth for pedestrian virtual reality.',
    prompt: 'High bandwidth for pedestrian virtual reality campus training with 250 Mbps downlink streaming, 10ms latency, and pedestrian mobility.',
    specs: { latency: 10, downlink: 250, downlinkUnit: 'Mbps', uplink: 25, uplinkUnit: 'Mbps', reliability: 99.9, mobility: 'Pedestrian (<10 km/h)', density: 500, jitter: 'Low (<5ms)', criticality: 'routine' },
  },
  {
    id: 'smart_parking',
    label: 'Smart Parking',
    category: 'mMTC',
    description: 'Massive IoT smart parking sensor density.',
    prompt: 'Massive IoT smart parking sensor network connecting 50,000 devices/km² with periodic 0.1 Mbps telemetry and tolerant 100ms latency.',
    specs: { latency: 100, downlink: 100, downlinkUnit: 'Kbps', uplink: 50, uplinkUnit: 'Kbps', reliability: 99.0, mobility: 'Stationary', density: 50000, jitter: 'Standard (<20ms)', criticality: 'routine' },
  },
  {
    id: 'drone_surveillance',
    label: 'Drone Surveillance',
    category: 'V2X',
    description: 'Autonomous UAV surveillance with 4K video uplink.',
    prompt: 'Deploying autonomous surveillance drones over city logistics hubs requiring sub-10ms latency, 50 Mbps 4K video uplink, and 99.999% ultra-reliable connectivity with vehicular mobility.',
    specs: { latency: 8, downlink: 120, downlinkUnit: 'Mbps', uplink: 45, uplinkUnit: 'Mbps', reliability: 99.999, mobility: 'Vehicular (<120 km/h)', density: 1500, jitter: 'Ultra-Low (<1ms)', criticality: 'life_safety' },
  },
];

export default function NetworkSliceRecommender() {
  // Input Mode: 'prompt' (direct natural language) vs 'key-value' (step-by-step form)
  const [inputMode, setInputMode] = useState('prompt');
  const [selectedPreset, setSelectedPreset] = useState('drone_surveillance');

  // Prompt Text & Extracted Specs
  const [promptText, setPromptText] = useState(
    'Deploying autonomous surveillance drones over city logistics hubs requiring sub-10ms latency, 50 Mbps 4K video uplink, and 99.999% ultra-reliable connectivity with vehicular mobility.'
  );
  const [extractedSpecs, setExtractedSpecs] = useState(null);

  // Key-Value Stepper States
  const [currentStep, setCurrentStep] = useState(1);

  const [latency, setLatency] = useState(8); // ms
  const [downlink, setDownlink] = useState(120);
  const [downlinkUnit, setDownlinkUnit] = useState('Mbps');
  const [uplink, setUplink] = useState(45);
  const [uplinkUnit, setUplinkUnit] = useState('Mbps');
  const [jitter, setJitter] = useState('Ultra-Low (<1ms)');

  const [reliability, setReliability] = useState(99.999);
  const [mobility, setMobility] = useState('Vehicular (<120 km/h)');
  const [density, setDensity] = useState(1500);

  const downlinkMbps = useMemo(() => toMbps(downlink, downlinkUnit), [downlink, downlinkUnit]);
  const uplinkMbps = useMemo(() => toMbps(uplink, uplinkUnit), [uplink, uplinkUnit]);

  // Unified AI Backend Analysis States: 'idle' | 'analyzing' | 'done'
  const [analysisState, setAnalysisState] = useState('idle');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisPhase, setAnalysisPhase] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);

  const [copied, setCopied] = useState(false);

  const invalidateAnalysis = useCallback(() => {
    setAnalysisState('idle');
    setAnalysisResult(null);
  }, []);

  const applyPreset = useCallback((preset) => {
    setSelectedPreset(preset.id);
    setPromptText(preset.prompt);
    setLatency(preset.specs.latency);
    setDownlink(preset.specs.downlink);
    setDownlinkUnit(preset.specs.downlinkUnit);
    setUplink(preset.specs.uplink);
    setUplinkUnit(preset.specs.uplinkUnit);
    setReliability(preset.specs.reliability);
    setMobility(preset.specs.mobility);
    setDensity(preset.specs.density);
    setJitter(preset.specs.jitter);
    invalidateAnalysis();
  }, [invalidateAnalysis]);

  const handleDownlinkUnitChange = useCallback((newUnit) => {
    if (downlink !== '' && !isNaN(Number(downlink))) {
      const currentMbps = toMbps(downlink, downlinkUnit);
      const converted = fromMbps(currentMbps, newUnit);
      const rounded = Math.round(converted * 10000) / 10000;
      setDownlink(rounded);
    }
    setDownlinkUnit(newUnit);
    invalidateAnalysis();
  }, [downlink, downlinkUnit, invalidateAnalysis]);

  const handleUplinkUnitChange = useCallback((newUnit) => {
    if (uplink !== '' && !isNaN(Number(uplink))) {
      const currentMbps = toMbps(uplink, uplinkUnit);
      const converted = fromMbps(currentMbps, newUnit);
      const rounded = Math.round(converted * 10000) / 10000;
      setUplink(rounded);
    }
    setUplinkUnit(newUnit);
    invalidateAnalysis();
  }, [uplink, uplinkUnit, invalidateAnalysis]);

  const computedRecommendation = useMemo(() => {
    const latNum = Number(latency) || 0;
    const dlNum = downlinkMbps;
    const ulNum = uplinkMbps;
    const denNum = Number(density) || 0;
    const relNum = Number(reliability) || 0;

    const isUltraLowLatency = latNum <= 10;
    const isUltraReliable = relNum >= 99.999;
    const isHighBandwidth = dlNum >= 150 || ulNum >= 50;
    const isMassiveDensity = denNum >= 100000;
    const isHighMobility = mobility.includes('High-Speed') || mobility.includes('Vehicular');

    const delayBudget = `${latNum} ms`;
    const per = '10⁻⁶';

    if (isHighMobility && latNum <= 15) {
      return {
        sliceName: 'V2X',
        sst: 4,
        sd: '0x000004',
        confidence: 97,
        fiveQi: 83,
        delayBudget,
        per,
        headline: 'Vehicle-to-Everything (V2X) Dedicated Slice',
        summary: `Your service requires high mobility (${mobility}) coupled with low latency (${latNum} ms) and ${relNum}% reliability. Standard cellular routing incurs handover latency; a 3GPP SST-4 slice guarantees sidelink PC5 support and pre-allocated radio resources.`,
        reasons: [
          `High velocity (${mobility}) triggers rapid gNodeB handovers, requiring V2X predictive beam management.`,
          `End-to-end latency constraint (${latNum} ms) necessitates direct vehicle-to-infrastructure (V2I) QoS mapping.`,
          `Mission-critical priority requires Guaranteed Bit Rate (GBR) and preemption vulnerability flags enabled.`,
        ],
        edgeStrategy: 'Roadside Unit (RSU) / Regional MEC UPF with Multi-access PDU sessions',
        counterFactuals: 'If mobility profile drops to pedestrian/stationary (<10 km/h) and latency allows >20ms, workload shifts from V2X (SST-4) to standard enterprise eMBB (SST-1), saving sidelink PC5 pre-allocation overhead.',
      };
    }

    if (isMassiveDensity || (latNum > 60 && dlNum < 10 && denNum > 50000)) {
      return {
        sliceName: 'mMTC',
        sst: 3,
        sd: '0x000003',
        confidence: 94,
        fiveQi: 79,
        delayBudget,
        per,
        headline: 'Massive Machine-Type Communications (mMTC)',
        summary: `Your application connects ${denNum.toLocaleString()} devices/km² with low throughput (${dlNum} Mbps DL) and tolerant latency (${latNum} ms). Traditional mobile broadband would exhaust cellular signaling resources; mMTC optimizes power and spectrum over high device counts.`,
        reasons: [
          `Extremely high connection density (${denNum.toLocaleString()} devices/km²) requires lightweight connectionless transmission (NB-IoT/eMTC).`,
          `Low throughput (${dlNum} Mbps) allows aggressive narrow-band resource multiplexing and extended DRX power saving.`,
          `Tolerant latency budget allows flexible radio scheduling without reserving dedicated high-frequency carriers.`,
        ],
        edgeStrategy: 'Centralized Regional UPF with High-Density Signaling Concentrator',
        counterFactuals: 'If device density drops below 10,000 devices/km² and throughput exceeds 25 Mbps, slice transitions to eMBB (SST-1) with active scheduled grant carriers.',
      };
    }

    if (isUltraLowLatency || (isUltraReliable && latNum < 25)) {
      return {
        sliceName: 'URLLC',
        sst: 2,
        sd: '0x000002',
        confidence: 96,
        fiveQi: 82,
        delayBudget,
        per,
        headline: 'Ultra-Reliable Low-Latency Communication (URLLC)',
        summary: `Your application demands a strict ${latNum} ms latency ceiling and ${relNum}% packet reliability. eMBB cannot guarantee this jitter boundary; URLLC provides sub-slot grant-free transmission and dual-connectivity packet duplication.`,
        reasons: [
          `Low latency requirement (${latNum} ms) rules out standard best-effort eMBB scheduling, requiring mini-slot puncturing.`,
          `Extreme reliability (${relNum}%) requires 3GPP Packet Data Convergence Protocol (PDCP) duplication over dual 5G carriers.`,
          `Strict jitter requirement (${jitter}) necessitates deterministic time-sensitive networking (TSN) profile mapping.`,
        ],
        edgeStrategy: 'On-Premise / Campus MEC UPF with Direct Hardware Bypass',
        counterFactuals: 'If reliability guarantee is relaxed from 99.999% to 99.9% and latency tolerance exceeds 20ms, carrier duplication can be disabled, saving power under standard eMBB (SST-1).',
      };
    }

    if (isHighBandwidth || dlNum >= 50) {
      return {
        sliceName: 'eMBB',
        sst: 1,
        sd: '0x000001',
        confidence: 92,
        fiveQi: 9,
        delayBudget,
        per,
        headline: 'Enhanced Mobile Broadband (eMBB)',
        summary: `Your workload centers on sustained data throughput (${dlNum} Mbps DL / ${ulNum} Mbps UL) with manageable latency (${latNum} ms). An eMBB slice allocates carrier aggregation and high-order 256-QAM modulation for maximum spectral efficiency.`,
        reasons: [
          `High data demand (${dlNum} Mbps downlink) requires Multi-User MIMO (MU-MIMO) and wideband sub-6GHz/mmWave spectrum.`,
          `Moderate latency (${latNum} ms) fits comfortably within standard 3GPP slot timing (1ms subframes) without costly radio puncturing.`,
          `Standard 99.9% reliability SLA aligns with commercial public 5G macro slice economics.`,
        ],
        edgeStrategy: 'Regional Distributed UPF with Content Delivery Network (CDN) edge peering',
        counterFactuals: 'If latency ceiling is tightened to <10ms and reliability SLA rises to 99.999%, workload escalates to URLLC (SST-2) requiring pre-emptive radio reservation.',
      };
    }

    return {
      sliceName: 'eMBB',
      sst: 1,
      sd: '0x000001',
      confidence: 88,
      fiveQi: 8,
      delayBudget,
      per,
      headline: 'Enhanced Mobile Broadband (Standard Enterprise)',
      summary: `Balanced requirements across speed (${dlNum} Mbps), latency (${latNum} ms), and density. A standard eMBB slice provides cost-effective connectivity without requiring expensive dedicated URLLC reservation.`,
      reasons: [
        `Standard throughput and latency fall within default 3GPP 5QI 8/9 non-GBR operational boundaries.`,
        `Stationary to moderate mobility is seamlessly handled by public carrier macro cells.`,
        `Lowest deployment and subscription overhead with zero custom private core requirements.`,
      ],
      edgeStrategy: 'Standard Core Network Gateway UPF',
      counterFactuals: 'If latency requirement tightens below 10ms or throughput exceeds 1 Gbps, slice escalates to premium high-density private core allocation.',
    };
  }, [latency, reliability, downlinkMbps, uplinkMbps, density, mobility, jitter]);

  // Unified Trigger Analysis Function calling Pot backend (/api/v1/generate or /v1/generate/)
  const triggerAnalysis = useCallback(async () => {
    setAnalysisState('analyzing');
    setAnalysisProgress(15);
    setAnalysisPhase('Initiating analysis flow...');

    const isPrompt = inputMode === 'prompt';
    const specs = isPrompt
      ? extractSpecsFromPrompt(promptText)
      : {
          latency: Number(latency) || 0,
          downlink: downlinkMbps,
          uplink: uplinkMbps,
          downlinkFormatted: `${downlink} ${downlinkUnit}`,
          uplinkFormatted: `${uplink} ${uplinkUnit}`,
          jitter,
          reliability: Number(reliability) || 0,
          mobility,
          density: Number(density) || 0,
        };

    if (isPrompt) {
      if (!promptText.trim()) return;
      setExtractedSpecs(specs);
    }

    const candidate = isPrompt
      ? generatePromptRecommendation(specs)
      : computedRecommendation;

    try {
      const resolvedResult = await generateSliceRecommendation({
        mode: inputMode,
        promptText: isPrompt ? promptText : '',
        specs,
        candidateRecommendation: candidate,
        presetName: selectedPreset,
        onProgress: (evt) => {
          if (evt.message) setAnalysisPhase(evt.message);
          if (evt.status === 'started' || evt.status === 'queued') setAnalysisProgress(20);
          else if (evt.status === 'intake') setAnalysisProgress(40);
          else if (evt.status === 'analysis') setAnalysisProgress(65);
          else if (evt.status === 'reasoning') setAnalysisProgress(85);
          else if (evt.status === 'audit') setAnalysisProgress(95);
          else if (evt.status === 'completed') setAnalysisProgress(100);
        },
      });

      setAnalysisProgress(100);
      setAnalysisPhase('Optimization complete.');
      setAnalysisResult(resolvedResult);
      setAnalysisState('done');
    } catch {
      setAnalysisProgress(100);
      setAnalysisResult(candidate);
      setAnalysisState('done');
    }
  }, [inputMode, promptText, latency, downlink, downlinkUnit, downlinkMbps, uplink, uplinkUnit, uplinkMbps, jitter, reliability, mobility, density, computedRecommendation, selectedPreset]);

  const activeResult = analysisResult || computedRecommendation;

  // Unified Export Configuration (JSON specification)
  const exportConfig = useCallback(() => {
    const isPrompt = inputMode === 'prompt';
    const specs = isPrompt
      ? (extractedSpecs || extractSpecsFromPrompt(promptText))
      : {
          latency: Number(latency) || 0,
          downlink: downlinkMbps,
          uplink: uplinkMbps,
          downlinkFormatted: `${downlink} ${downlinkUnit}`,
          uplinkFormatted: `${uplink} ${uplinkUnit}`,
          jitter,
          reliability: Number(reliability) || 0,
          mobility,
          density: Number(density) || 0,
        };

    const requestPayload = buildGenerateRequest({
      mode: inputMode,
      promptText: isPrompt ? promptText : '',
      specs,
      presetName: selectedPreset,
    });

    const config = {
      timestamp: new Date().toISOString(),
      mode: isPrompt ? 'prompt-specification' : 'key-value-specification',
      inputSummary: isPrompt
        ? {
            prompt: promptText,
            extractedRequirements: {
              latencyMs: specs.latency,
              downlinkMbps: specs.downlink,
              uplinkMbps: specs.uplink,
              reliabilityPercentage: specs.reliability,
              mobilityTier: specs.mobility,
              deviceDensityPerKm2: specs.density,
            },
          }
        : {
            requirements: {
              latencyMs: Number(latency) || 0,
              downlinkMbps,
              uplinkMbps,
              downlinkFormatted: `${downlink} ${downlinkUnit}`,
              uplinkFormatted: `${uplink} ${uplinkUnit}`,
              jitterTolerance: jitter,
              reliabilityPercentage: Number(reliability) || 0,
              mobilityTier: mobility,
              deviceDensityPerKm2: Number(density) || 0,
            },
          },
      backendContract: {
        endpoint: activeResult?.source === 'backend' ? '/api/v1/generate' : null,
        source: activeResult?.source || 'local',
        decisionId: activeResult?.decisionId || null,
        weightsVersion: activeResult?.weightsVersion || null,
        generateRequest: requestPayload,
      },
      aiRecommendation: {
        sliceCategory: activeResult?.sliceName,
        sst: activeResult?.sst,
        sd: activeResult?.sd || '0x000001',
        confidencePercentage: activeResult?.confidence,
        qosParameters: {
          fiveQi: activeResult?.fiveQi,
          packetDelayBudget: activeResult?.delayBudget,
          packetErrorRate: activeResult?.per,
        },
        edgeDeploymentStrategy: activeResult?.edgeStrategy,
        justification: activeResult?.summary,
        keyDrivers: activeResult?.reasons,
        counterFactuals: activeResult?.counterFactuals,
        analysisSource: activeResult?.sourceBadge || 'AI Decision Engine',
      },
    };

    navigator.clipboard?.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [inputMode, promptText, extractedSpecs, latency, downlink, downlinkUnit, downlinkMbps, uplink, uplinkUnit, uplinkMbps, jitter, reliability, mobility, density, activeResult, selectedPreset]);

  // Populate Key-Value Stepper from Prompt Specs
  const applyPromptToKeyValue = useCallback(() => {
    const specs = extractedSpecs || extractSpecsFromPrompt(promptText);
    setLatency(specs.latency);
    if (specs.downlink >= 1000) {
      setDownlink(specs.downlink / 1000);
      setDownlinkUnit('Gbps');
    } else if (specs.downlink < 1) {
      setDownlink(Math.round(specs.downlink * 1000));
      setDownlinkUnit('Kbps');
    } else {
      setDownlink(specs.downlink);
      setDownlinkUnit('Mbps');
    }

    if (specs.uplink >= 1000) {
      setUplink(specs.uplink / 1000);
      setUplinkUnit('Gbps');
    } else if (specs.uplink < 1) {
      setUplink(Math.round(specs.uplink * 1000));
      setUplinkUnit('Kbps');
    } else {
      setUplink(specs.uplink);
      setUplinkUnit('Mbps');
    }

    setReliability(specs.reliability);
    setMobility(specs.mobility);
    setDensity(specs.density);
    setInputMode('key-value');
    setCurrentStep(1);
    invalidateAnalysis();
  }, [extractedSpecs, promptText, invalidateAnalysis]);

  // Footer next button label for navigation steps
  const nextButtonText = currentStep < 2 ? 'Next Step' : 'Review & Analyse';

  return (
    <div className="recommender-container">
      {/* MODE SELECTOR */}
      <div className="input-mode-selector-wrapper">
        <div className="input-mode-selector" role="tablist" aria-label="Input Method">
          <button
            type="button"
            role="tab"
            aria-selected={inputMode === 'prompt'}
            className={`mode-tab ${inputMode === 'prompt' ? 'mode-tab--active' : ''}`}
            onClick={() => setInputMode('prompt')}
          >
            <HugeiconsIcon icon={AiSparklesIcon} size={16} strokeWidth={2.2} />
            <span className="mode-tab-title">Prompting</span>
            <span className="mode-tab-badge">Direct AI</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={inputMode === 'key-value'}
            className={`mode-tab ${inputMode === 'key-value' ? 'mode-tab--active' : ''}`}
            onClick={() => setInputMode('key-value')}
          >
            <HugeiconsIcon icon={SlidersHorizontalIcon} size={16} strokeWidth={2.2} />
            <span className="mode-tab-title">Key-Value Pairs</span>
            <span className="mode-tab-badge">Step-by-Step</span>
          </button>
        </div>
      </div>

      {inputMode === 'prompt' ? (
        <div className="prompt-mode-wrapper">
          {/* STATE 1: IDLE / PROMPT ENTRY */}
          {analysisState === 'idle' && (
            <div className="prompt-card">
              <h3 className="prompt-card-title">Describe Your Network Workload</h3>
              <p className="prompt-card-desc">
                The AI engine evaluates your prompt directly, extracts 3GPP QoS parameters, and allocates the optimal slice.
              </p>

              <div className="preset-selector-strip">
                <span className="preset-strip-label">3GPP Workload Presets:</span>
                <div className="preset-chip-list">
                  {WORKLOAD_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-chip-btn ${selectedPreset === preset.id ? 'preset-chip-btn--active' : ''}`}
                      onClick={() => applyPreset(preset)}
                      title={preset.description}
                    >
                      <span className="preset-category-tag">{preset.category}</span>
                      <span className="preset-label-text">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <div className="prompt-label-row">
                  <label className="input-label" htmlFor="user-prompt">Application & Connectivity Prompt</label>
                  {promptText && (
                    <button
                      type="button"
                      className="clear-prompt-btn"
                      onClick={() => {
                        setPromptText('');
                        invalidateAnalysis();
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  id="user-prompt"
                  className="prompt-textarea"
                  rows={4}
                  value={promptText}
                  onChange={(e) => {
                    setPromptText(e.target.value);
                    invalidateAnalysis();
                  }}
                  placeholder="e.g. Deploying autonomous surveillance drones over city logistics hubs requiring sub-10ms latency, 50 Mbps 4K video uplink, and 99.999% ultra-reliable connectivity with vehicular mobility."
                />
                <div className="textarea-footer">
                  <span className="char-count">{promptText.length} characters</span>
                  <span className="hint-text">Mention latency (ms), bandwidth (Mbps), reliability (%), mobility or density</span>
                </div>
              </div>

              <div className="prompt-actions">
                <AnalyseButton
                  disabled={!promptText.trim()}
                  onCommit={triggerAnalysis}
                />
              </div>
            </div>
          )}

          {/* STATE 2: ANALYZING RADAR */}
          {analysisState === 'analyzing' && (
            <div className="analyzing-card prompt-analyzing-card">
              <div className="radar-spinner-wrap">
                <div className="radar-ripple"></div>
                <div className="radar-core">
                  <span className="core-icon">5G</span>
                </div>
              </div>

              <h3 className="analyzing-title">Evaluating 5G Core Network Slices</h3>
              <p className="analyzing-phase">{analysisPhase}</p>

              <div className="analysis-progress-bar">
                <div className="analysis-progress-fill" style={{ width: `${analysisProgress}%` }}></div>
              </div>

              <div className="telecom-telemetry-feed">
                <div className={`feed-item ${analysisProgress >= 20 ? 'feed-item--active' : ''}`}>
                  <span className="feed-dot"></span> NLP Intent & Telemetry Parser
                </div>
                <div className={`feed-item ${analysisProgress >= 55 ? 'feed-item--active' : ''}`}>
                  <span className="feed-dot"></span> 3GPP Rel-18 QoS Classifier & 5QI Calculation
                </div>
                <div className={`feed-item ${analysisProgress >= 85 ? 'feed-item--active' : ''}`}>
                  <span className="feed-dot"></span> Slicing Decision & Explainability Synthesis
                </div>
              </div>
            </div>
          )}

          {/* STATE 3: DONE / RESULT DISPLAY */}
          {analysisState === 'done' && activeResult && (
            <div className="recommendation-card prompt-result-card">
              <div className="rec-top-actions">
                <div className="ai-verified-tag">
                  <HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={2.4} />
                  <span>{activeResult.sourceBadge || 'Analysis Returned by AI Engine'}</span>
                </div>
                {activeResult.decisionId && (
                  <div className="audit-provenance-bar">
                    <span className="audit-provenance-tag">Audit ID: {activeResult.decisionId.slice(0, 10)}...</span>
                    {activeResult.weightsVersion && (
                      <span className="audit-weights-tag">Weights: v{activeResult.weightsVersion}</span>
                    )}
                  </div>
                )}
                <div className="rec-action-buttons">
                  <button
                    type="button"
                    className="re-analyze-btn"
                    onClick={invalidateAnalysis}
                  >
                    ✎ Edit Prompt
                  </button>
                  <button
                    type="button"
                    className="re-analyze-btn"
                    onClick={triggerAnalysis}
                  >
                    ↻ Re-analyse
                  </button>
                </div>
              </div>

              <div className="prompt-quote-box">
                <span className="prompt-quote-label">Evaluated Prompt:</span>
                <p className="prompt-quote-text">"{promptText}"</p>
              </div>

              {extractedSpecs && (
                <div className="extracted-specs-strip">
                  <div className="strip-title">Extracted QoS Telemetry:</div>
                  <div className="strip-chips">
                    <span className="strip-chip">Latency: <strong>{extractedSpecs.latency} ms</strong></span>
                    <span className="strip-chip">DL: <strong>{extractedSpecs.downlink} Mbps</strong></span>
                    <span className="strip-chip">UL: <strong>{extractedSpecs.uplink} Mbps</strong></span>
                    <span className="strip-chip">Reliability: <strong>{extractedSpecs.reliability}%</strong></span>
                    <span className="strip-chip">Mobility: <strong>{extractedSpecs.mobility}</strong></span>
                    <span className="strip-chip">Density: <strong>{extractedSpecs.density.toLocaleString()} / km²</strong></span>
                  </div>
                </div>
              )}

              <div className="rec-header">
                <div className="rec-slice-badge">
                  <span className="rec-sst">3GPP SST-{activeResult.sst}</span>
                  <span className="rec-sd">SD: {activeResult.sd || '0x000001'}</span>
                  <span className="rec-tag">{activeResult.sliceName}</span>
                </div>
                <div className="rec-score">
                  <span className="score-num">{activeResult.confidence}%</span>
                  <span className="score-label">Match Confidence</span>
                </div>
              </div>

              <h3 className="rec-title">{activeResult.headline}</h3>
              <p className="rec-summary">{activeResult.summary}</p>

              <div className="specs-grid">
                <div className="spec-card">
                  <span className="spec-label">Recommended 5QI</span>
                  <span className="spec-val">{activeResult.fiveQi}</span>
                </div>
                <div className="spec-card">
                  <span className="spec-label">Packet Delay Budget</span>
                  <span className="spec-val">{activeResult.delayBudget}</span>
                </div>
                <div className="spec-card">
                  <span className="spec-label">Error Rate Target</span>
                  <span className="spec-val">{activeResult.per}</span>
                </div>
                <div className="spec-card">
                  <span className="spec-label">Slice Service Type</span>
                  <span className="spec-val">SST-{activeResult.sst}</span>
                </div>
              </div>

              <div className="reasons-block">
                <h4>Explainable Telecom Justification</h4>
                <ul className="reasons-list">
                  {activeResult.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>

              {activeResult.counterFactuals && (
                <div className="counterfactual-block">
                  <div className="counterfactual-header">
                    <span className="cf-badge">3GPP Sensitivity</span>
                    <h4>Counterfactual Analysis</h4>
                  </div>
                  <p className="counterfactual-text">{activeResult.counterFactuals}</p>
                </div>
              )}

              <div className="edge-guideline">
                <div className="edge-title">Core & Edge Deployment Architecture</div>
                <div className="edge-desc">{activeResult.edgeStrategy}</div>
              </div>

              {activeResult.rawResponse && (
                <details className="backend-trace-details">
                  <summary className="backend-trace-summary">
                    Inspect Backend AI Engine Trace & Decision Provenance ({activeResult.source === 'backend' ? 'pot: /api/v1/generate' : 'Local Deterministic Matrix'})
                  </summary>
                  <pre className="backend-trace-json">{activeResult.rawResponse}</pre>
                </details>
              )}

              <div className="export-row-dual">
                <button type="button" className="export-btn" onClick={exportConfig}>
                  {copied ? '✓ Copied JSON Specification to Clipboard' : 'Export 5G Slice Provisioning Config'}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={applyPromptToKeyValue}
                >
                  Fine-tune in Key-Value Mode →
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="recommender-stepper-wrapper">
        <Stepper
          step={currentStep}
          initialStep={1}
          onStepChange={setCurrentStep}
          theme="dark"
          accentColor="#f3903f"
          radius={20}
          width={720}
          backButtonText="Back"
          nextButtonText={nextButtonText}
          completeButtonText={nextButtonText}
          showNextButton={currentStep < 3}
          className="slice-stepper"
        >
          {/* STEP 1: Performance & QoS */}
          <Step title="QoS & Speed" description="Latency & Bandwidth">
            <div className="step-content">
              <div className="step-heading">
                <span className="step-badge">Step 1</span>
                <h3>Latency & Throughput Requirements</h3>
                <p>Define the strict end-to-end timing and bandwidth demands of your data flows.</p>
              </div>

              <div className="preset-selector-strip">
                <span className="preset-strip-label">3GPP Workload Presets:</span>
                <div className="preset-chip-list">
                  {WORKLOAD_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-chip-btn ${selectedPreset === preset.id ? 'preset-chip-btn--active' : ''}`}
                      onClick={() => applyPreset(preset)}
                      title={preset.description}
                    >
                      <span className="preset-category-tag">{preset.category}</span>
                      <span className="preset-label-text">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="latency-input">Target E2E Latency</label>
                <div className="input-with-unit">
                  <input
                    id="latency-input"
                    type="number"
                    min="1"
                    max="500"
                    step="1"
                    className="text-input"
                    value={latency}
                    onChange={(e) => {
                      setLatency(e.target.value === '' ? '' : Number(e.target.value));
                      invalidateAnalysis();
                    }}
                    placeholder="e.g. 8"
                  />
                  <span className="input-unit">ms</span>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="input-label" htmlFor="downlink-input">Downlink Throughput</label>
                  <div className="input-with-unit">
                    <input
                      id="downlink-input"
                      type="number"
                      min="0.001"
                      step="any"
                      className="text-input"
                      value={downlink}
                      onChange={(e) => {
                        setDownlink(e.target.value === '' ? '' : Number(e.target.value));
                        invalidateAnalysis();
                      }}
                      placeholder="e.g. 120"
                    />
                    <select
                      id="downlink-unit"
                      className="unit-select"
                      aria-label="Downlink unit"
                      value={downlinkUnit}
                      onChange={(e) => handleDownlinkUnitChange(e.target.value)}
                    >
                      <option value="Kbps">Kbps</option>
                      <option value="Mbps">Mbps</option>
                      <option value="Gbps">Gbps</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="uplink-input">Uplink Throughput</label>
                  <div className="input-with-unit">
                    <input
                      id="uplink-input"
                      type="number"
                      min="0.001"
                      step="any"
                      className="text-input"
                      value={uplink}
                      onChange={(e) => {
                        setUplink(e.target.value === '' ? '' : Number(e.target.value));
                        invalidateAnalysis();
                      }}
                      placeholder="e.g. 45"
                    />
                    <select
                      id="uplink-unit"
                      className="unit-select"
                      aria-label="Uplink unit"
                      value={uplinkUnit}
                      onChange={(e) => handleUplinkUnitChange(e.target.value)}
                    >
                      <option value="Kbps">Kbps</option>
                      <option value="Mbps">Mbps</option>
                      <option value="Gbps">Gbps</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="jitter-select">Jitter / Packet Delay Variation</label>
                <select
                  id="jitter-select"
                  className="select-input"
                  value={jitter}
                  onChange={(e) => {
                    setJitter(e.target.value);
                    invalidateAnalysis();
                  }}
                >
                  <option>Ultra-Low (&lt;1ms) - TSN Deterministic</option>
                  <option>Low (&lt;2ms) - Interactive Media</option>
                  <option>Tolerant (&gt;10ms) - Standard IP</option>
                </select>
              </div>
            </div>
          </Step>

          {/* STEP 2: Reliability & Mobility */}
          <Step title="Environment" description="Reliability & Density">
            <div className="step-content">
              <div className="step-heading">
                <span className="step-badge">Step 2</span>
                <h3>Operating Environment & SLA</h3>
                <p>Configure device density, movement speed, and packet delivery guarantee.</p>
              </div>

              <div className="metric-box">
                <div className="metric-header">
                  <span className="input-label">Reliability SLA Guarantee</span>
                  <span className="metric-value-tag highlight-gold">{reliability}%</span>
                </div>
                <div className="radio-pill-group">
                  {[99.0, 99.9, 99.99, 99.999].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`radio-pill ${reliability === val ? 'radio-pill--active' : ''}`}
                      onClick={() => {
                        setReliability(val);
                        invalidateAnalysis();
                      }}
                    >
                      {val}% {val === 99.999 ? '(Five 9s)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="mobility-select">Device Mobility Profile</label>
                <select
                  id="mobility-select"
                  className="select-input"
                  value={mobility}
                  onChange={(e) => {
                    setMobility(e.target.value);
                    invalidateAnalysis();
                  }}
                >
                  <option>Stationary (Fixed Sensors, Smart Meters, Static Machines)</option>
                  <option>Pedestrian (&lt;10 km/h - Wearables, Handhelds)</option>
                  <option>Vehicular (&lt;120 km/h - Drones, City Buses, Delivery Vans)</option>
                  <option>High-Speed (&gt;200 km/h - High-Speed Rail, Highway Automated Driving)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="density-input">Connection Density</label>
                <div className="input-with-unit">
                  <input
                    id="density-input"
                    type="number"
                    min="1"
                    step="100"
                    className="text-input"
                    value={density}
                    onChange={(e) => {
                      setDensity(e.target.value === '' ? '' : Number(e.target.value));
                      invalidateAnalysis();
                    }}
                    placeholder="e.g. 1500"
                  />
                  <span className="input-unit">devices / km²</span>
                </div>
              </div>
            </div>
          </Step>

          {/* STEP 3: AI Recommendation & Justification */}
          <Step title="AI Recommendation" description="Slice Category & QoS">
            <div className="step-content">
              {/* STATE 1: IDLE / READY TO ANALYZE */}
              {analysisState === 'idle' && (
                <div className="ready-to-analyze-card">
                  <div className="ready-header">
                    <div className="ready-badge">
                      <span className="pulse-dot"></span>
                      Inputs Ready for Evaluation
                    </div>
                    <span className="ready-step-indicator">Step 3 of 3</span>
                  </div>

                  <h3 className="ready-title">Ready to Analyse 5G Slice Requirements</h3>
                  <p className="ready-desc">
                    Click <strong>Analyse</strong> below to submit your telemetry profile to the AI model. The engine
                    will match constraints against 3GPP Release-18 slice templates and return an explainable telecom justification.
                  </p>

                  <div className="ready-spec-chips">
                    <div className="spec-chip">
                      <span className="chip-label">Target Latency</span>
                      <span className="chip-val highlight-orange">{latency} ms</span>
                    </div>
                    <div className="spec-chip">
                      <span className="chip-label">Downlink / Uplink</span>
                      <span className="chip-val">{downlink} {downlinkUnit} / {uplink} {uplinkUnit}</span>
                    </div>
                    <div className="spec-chip">
                      <span className="chip-label">Jitter / Variation</span>
                      <span className="chip-val">{jitter.split(' - ')[0]}</span>
                    </div>
                    <div className="spec-chip">
                      <span className="chip-label">Reliability</span>
                      <span className="chip-val highlight-gold">{reliability}%</span>
                    </div>
                    <div className="spec-chip">
                      <span className="chip-label">Mobility Tier</span>
                      <span className="chip-val">{mobility}</span>
                    </div>
                    <div className="spec-chip">
                      <span className="chip-label">Density</span>
                      <span className="chip-val">{(Number(density) || 0).toLocaleString()} / km²</span>
                    </div>
                  </div>

                  <AnalyseButton
                    disabled={false}
                    onCommit={triggerAnalysis}
                  />
                </div>
              )}

              {/* STATE 2: ANALYZING / BACKEND PROCESSING */}
              {analysisState === 'analyzing' && (
                <div className="analyzing-card">
                  <div className="radar-spinner-wrap">
                    <div className="radar-ripple"></div>
                    <div className="radar-core">
                      <span className="core-icon">5G</span>
                    </div>
                  </div>

                  <h3 className="analyzing-title">Evaluating 5G Core Network Slices</h3>
                  <p className="analyzing-phase">{analysisPhase}</p>

                  <div className="analysis-progress-bar">
                    <div className="analysis-progress-fill" style={{ width: `${analysisProgress}%` }}></div>
                  </div>

                  <div className="telecom-telemetry-feed">
                    <div className={`feed-item ${analysisProgress >= 20 ? 'feed-item--active' : ''}`}>
                      <span className="feed-dot"></span> 3GPP Rel-18 QoS Classifier
                    </div>
                    <div className={`feed-item ${analysisProgress >= 55 ? 'feed-item--active' : ''}`}>
                      <span className="feed-dot"></span> Delay-Critical GBR & 5QI Calculation
                    </div>
                    <div className={`feed-item ${analysisProgress >= 85 ? 'feed-item--active' : ''}`}>
                      <span className="feed-dot"></span> Slicing Decision & Explainability Synthesis
                    </div>
                  </div>
                </div>
              )}

              {/* STATE 3: DONE / RESULT DISPLAY */}
              {analysisState === 'done' && (
                <div className="recommendation-card">
                  <div className="rec-top-actions">
                    <div className="ai-verified-tag">
                      <HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={2.4} />
                      <span>{activeResult.sourceBadge || 'Analysis Returned by AI Engine'}</span>
                    </div>
                    {activeResult.decisionId && (
                      <div className="audit-provenance-bar">
                        <span className="audit-provenance-tag">Audit ID: {activeResult.decisionId.slice(0, 10)}...</span>
                        {activeResult.weightsVersion && (
                          <span className="audit-weights-tag">Weights: v{activeResult.weightsVersion}</span>
                        )}
                      </div>
                    )}
                    <button type="button" className="re-analyze-btn" onClick={triggerAnalysis}>
                      ↻ Re-run Analysis
                    </button>
                  </div>

                  <div className="rec-header">
                    <div className="rec-slice-badge">
                      <span className="rec-sst">3GPP SST-{activeResult.sst}</span>
                      <span className="rec-sd">SD: {activeResult.sd || '0x000001'}</span>
                      <span className="rec-tag">{activeResult.sliceName}</span>
                    </div>
                    <div className="rec-score">
                      <span className="score-num">{activeResult.confidence}%</span>
                      <span className="score-label">Match Confidence</span>
                    </div>
                  </div>

                  <h3 className="rec-title">{activeResult.headline}</h3>
                  <p className="rec-summary">{activeResult.summary}</p>

                  <div className="specs-grid">
                    <div className="spec-card">
                      <span className="spec-label">Recommended 5QI</span>
                      <span className="spec-val">{activeResult.fiveQi}</span>
                    </div>
                    <div className="spec-card">
                      <span className="spec-label">Packet Delay Budget</span>
                      <span className="spec-val">{activeResult.delayBudget}</span>
                    </div>
                    <div className="spec-card">
                      <span className="spec-label">Error Rate Target</span>
                      <span className="spec-val">{activeResult.per}</span>
                    </div>
                    <div className="spec-card">
                      <span className="spec-label">Slice Service Type</span>
                      <span className="spec-val">SST-{activeResult.sst}</span>
                    </div>
                  </div>

                  <div className="reasons-block">
                    <h4>Explainable Telecom Justification</h4>
                    <ul className="reasons-list">
                      {activeResult.reasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>

                  {activeResult.counterFactuals && (
                    <div className="counterfactual-block">
                      <div className="counterfactual-header">
                        <span className="cf-badge">3GPP Sensitivity</span>
                        <h4>Counterfactual Analysis</h4>
                      </div>
                      <p className="counterfactual-text">{activeResult.counterFactuals}</p>
                    </div>
                  )}

                  <div className="edge-guideline">
                    <div className="edge-title">Core & Edge Deployment Architecture</div>
                    <div className="edge-desc">{activeResult.edgeStrategy}</div>
                  </div>

                  {activeResult.rawResponse && (
                    <details className="backend-trace-details">
                      <summary className="backend-trace-summary">
                        Inspect Backend AI Engine Trace & Decision Provenance ({activeResult.source === 'backend' ? 'pot: /api/v1/generate' : 'Local Deterministic Matrix'})
                      </summary>
                      <pre className="backend-trace-json">{activeResult.rawResponse}</pre>
                    </details>
                  )}

                  <div className="export-row">
                    <button type="button" className="export-btn" onClick={exportConfig}>
                      {copied ? '✓ Copied JSON Specification to Clipboard' : 'Export 5G Slice Provisioning Config'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Step>
        </Stepper>
      </div>
      )}
    </div>
  );
}
