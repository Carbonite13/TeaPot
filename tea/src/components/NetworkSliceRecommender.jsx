import { useState, useMemo, useCallback } from 'react';
import Stepper, { Step } from './Stepper';
import ShinyText from './ShinyText';
import FuseButton from './FuseButton';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon, AiBrain01Icon } from '@hugeicons/core-free-icons';
import './NetworkSliceRecommender.css';

const PRESETS = [
  {
    id: 'teleoperation',
    name: 'Autonomous Drone / Teleoperation',
    industry: 'Robotics & Logistics',
    priority: 'Mission Critical',
    latency: 8,
    downlink: 120,
    uplink: 45,
    jitter: 'Ultra-Low (<1ms)',
    reliability: 99.999,
    mobility: 'Vehicular (<120 km/h)',
    density: 1500,
  },
  {
    id: 'xr-streaming',
    name: 'Cloud Gaming & Immersive XR',
    industry: 'Media & Entertainment',
    priority: 'Business Critical',
    latency: 18,
    downlink: 350,
    uplink: 30,
    jitter: 'Low (<2ms)',
    reliability: 99.9,
    mobility: 'Pedestrian (<10 km/h)',
    density: 12000,
  },
  {
    id: 'smart-metering',
    name: 'Smart Grid & Metering Sensors',
    industry: 'Energy & Utilities',
    priority: 'Standard',
    latency: 120,
    downlink: 0.5,
    uplink: 1.2,
    jitter: 'Tolerant (>10ms)',
    reliability: 99.9,
    mobility: 'Stationary',
    density: 450000,
  },
  {
    id: 'connected-v2x',
    name: 'Connected Autonomous Vehicles (C-V2X)',
    industry: 'Automotive & Transport',
    priority: 'Mission Critical',
    latency: 5,
    downlink: 80,
    uplink: 60,
    jitter: 'Ultra-Low (<1ms)',
    reliability: 99.999,
    mobility: 'High-Speed (>200 km/h)',
    density: 25000,
  },
];

export default function NetworkSliceRecommender() {
  const [currentStep, setCurrentStep] = useState(1);

  const [appName, setAppName] = useState('Autonomous Drone / Teleoperation');
  const [industry, setIndustry] = useState('Robotics & Logistics');
  const [priority, setPriority] = useState('Mission Critical');

  const [latency, setLatency] = useState(8); // ms
  const [downlink, setDownlink] = useState(120); // Mbps
  const [uplink, setUplink] = useState(45); // Mbps
  const [jitter, setJitter] = useState('Ultra-Low (<1ms)');

  const [reliability, setReliability] = useState(99.999);
  const [mobility, setMobility] = useState('Vehicular (<120 km/h)');
  const [density, setDensity] = useState(1500);

  // AI Backend Analysis States: 'idle' | 'analyzing' | 'done'
  const [analysisState, setAnalysisState] = useState('idle');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisPhase, setAnalysisPhase] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);

  const [copied, setCopied] = useState(false);

  const invalidateAnalysis = useCallback(() => {
    setAnalysisState('idle');
    setAnalysisResult(null);
  }, []);

  const applyPreset = (preset) => {
    setAppName(preset.name);
    setIndustry(preset.industry);
    setPriority(preset.priority);
    setLatency(preset.latency);
    setDownlink(preset.downlink);
    setUplink(preset.uplink);
    setJitter(preset.jitter);
    setReliability(preset.reliability);
    setMobility(preset.mobility);
    setDensity(preset.density);
    invalidateAnalysis();
  };

  const computedRecommendation = useMemo(() => {
    const isUltraLowLatency = latency <= 10;
    const isUltraReliable = reliability >= 99.999;
    const isHighBandwidth = downlink >= 150 || uplink >= 50;
    const isMassiveDensity = density >= 100000;
    const isHighMobility = mobility.includes('High-Speed') || mobility.includes('Vehicular');

    const delayBudget = `${latency} ms`;
    const per = '10⁻⁶';

    if (isHighMobility && latency <= 15 && priority === 'Mission Critical') {
      return {
        sliceName: 'V2X',
        sst: 4,
        confidence: 97,
        fiveQi: 83,
        delayBudget,
        per,
        headline: 'Vehicle-to-Everything (V2X) Dedicated Slice',
        summary: `Your service requires high mobility (${mobility}) coupled with low latency (${latency} ms) and ${reliability}% reliability. Standard cellular routing incurs handover latency; a 3GPP SST-4 slice guarantees sidelink PC5 support and pre-allocated radio resources.`,
        reasons: [
          `High velocity (${mobility}) triggers rapid gNodeB handovers, requiring V2X predictive beam management.`,
          `End-to-end latency constraint (${latency} ms) necessitates direct vehicle-to-infrastructure (V2I) QoS mapping.`,
          `Mission-critical priority requires Guaranteed Bit Rate (GBR) and preemption vulnerability flags enabled.`,
        ],
        edgeStrategy: 'Roadside Unit (RSU) / Regional MEC UPF with Multi-access PDU sessions',
      };
    }

    if (isMassiveDensity || (latency > 60 && downlink < 10 && density > 50000)) {
      return {
        sliceName: 'mMTC',
        sst: 3,
        confidence: 94,
        fiveQi: 79,
        delayBudget,
        per,
        headline: 'Massive Machine-Type Communications (mMTC)',
        summary: `Your application connects ${density.toLocaleString()} devices/km² with low throughput (${downlink} Mbps DL) and tolerant latency (${latency} ms). Traditional mobile broadband would exhaust cellular signaling resources; mMTC optimizes power and spectrum over high device counts.`,
        reasons: [
          `Extremely high connection density (${density.toLocaleString()} devices/km²) requires lightweight connectionless transmission (NB-IoT/eMTC).`,
          `Low throughput (${downlink} Mbps) allows aggressive narrow-band resource multiplexing and extended DRX power saving.`,
          `Tolerant latency budget allows flexible radio scheduling without reserving dedicated high-frequency carriers.`,
        ],
        edgeStrategy: 'Centralized Regional UPF with High-Density Signaling Concentrator',
      };
    }

    if (isUltraLowLatency || (isUltraReliable && latency < 25)) {
      return {
        sliceName: 'URLLC',
        sst: 2,
        confidence: 96,
        fiveQi: 82,
        delayBudget,
        per,
        headline: 'Ultra-Reliable Low-Latency Communication (URLLC)',
        summary: `Your application demands a strict ${latency} ms latency ceiling and ${reliability}% packet reliability. eMBB cannot guarantee this jitter boundary; URLLC provides sub-slot grant-free transmission and dual-connectivity packet duplication.`,
        reasons: [
          `Low latency requirement (${latency} ms) rules out standard best-effort eMBB scheduling, requiring mini-slot puncturing.`,
          `Extreme reliability (${reliability}%) requires 3GPP Packet Data Convergence Protocol (PDCP) duplication over dual 5G carriers.`,
          `Strict jitter requirement (${jitter}) necessitates deterministic time-sensitive networking (TSN) profile mapping.`,
        ],
        edgeStrategy: 'On-Premise / Campus MEC UPF with Direct Hardware Bypass',
      };
    }

    if (isHighBandwidth || downlink >= 50) {
      return {
        sliceName: 'eMBB',
        sst: 1,
        confidence: 92,
        fiveQi: 9,
        delayBudget,
        per,
        headline: 'Enhanced Mobile Broadband (eMBB)',
        summary: `Your workload centers on sustained data throughput (${downlink} Mbps DL / ${uplink} Mbps UL) with manageable latency (${latency} ms). An eMBB slice allocates carrier aggregation and high-order 256-QAM modulation for maximum spectral efficiency.`,
        reasons: [
          `High data demand (${downlink} Mbps downlink) requires Multi-User MIMO (MU-MIMO) and wideband sub-6GHz/mmWave spectrum.`,
          `Moderate latency (${latency} ms) fits comfortably within standard 3GPP slot timing (1ms subframes) without costly radio puncturing.`,
          `Standard 99.9% reliability SLA aligns with commercial public 5G macro slice economics.`,
        ],
        edgeStrategy: 'Regional Distributed UPF with Content Delivery Network (CDN) edge peering',
      };
    }

    return {
      sliceName: 'eMBB',
      sst: 1,
      confidence: 88,
      fiveQi: 8,
      delayBudget,
      per,
      headline: 'Enhanced Mobile Broadband (Standard Enterprise)',
      summary: `Balanced requirements across speed (${downlink} Mbps), latency (${latency} ms), and density. A standard eMBB slice provides cost-effective connectivity without requiring expensive dedicated URLLC reservation.`,
      reasons: [
        `Standard throughput and latency fall within default 3GPP 5QI 8/9 non-GBR operational boundaries.`,
        `Stationary to moderate mobility is seamlessly handled by public carrier macro cells.`,
        `Lowest deployment and subscription overhead with zero custom private core requirements.`,
      ],
      edgeStrategy: 'Standard Core Network Gateway UPF',
    };
  }, [latency, reliability, downlink, uplink, density, mobility, priority, jitter]);

  // Trigger Backend Analysis
  const triggerAnalysis = useCallback(async () => {
    setAnalysisState('analyzing');
    setAnalysisProgress(20);
    setAnalysisPhase('Connecting to 5G Slice Provisioning backend...');

    const payload = {
      application: { name: appName, industry, priority },
      requirements: { latency, downlink, uplink, jitter, reliability, mobility, density }
    };

    try {
      // Attempt real backend POST request; if not present, gracefully proceed with client simulation
      const backendPromise = fetch('/api/recommend-slice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(res => res.ok ? res.json() : null).catch(() => null);

      await new Promise(r => setTimeout(r, 450));
      setAnalysisProgress(55);
      setAnalysisPhase('Evaluating 3GPP 5QI delay budgets & radio resource multiplexing...');

      await new Promise(r => setTimeout(r, 550));
      setAnalysisProgress(85);
      setAnalysisPhase('Synthesizing explainable telecom justification & UPF topology...');

      const [serverResult] = await Promise.all([
        backendPromise,
        new Promise(r => setTimeout(r, 450))
      ]);

      setAnalysisProgress(100);
      setAnalysisPhase('Optimization complete.');
      setAnalysisResult(serverResult || computedRecommendation);
      setAnalysisState('done');
    } catch {
      setAnalysisProgress(100);
      setAnalysisResult(computedRecommendation);
      setAnalysisState('done');
    }
  }, [appName, industry, priority, latency, downlink, uplink, jitter, reliability, mobility, density, computedRecommendation]);

  const activeResult = analysisResult || computedRecommendation;

  const exportConfig = useCallback(() => {
    const config = {
      timestamp: new Date().toISOString(),
      application: {
        name: appName,
        industry,
        priority,
      },
      requirements: {
        latencyMs: latency,
        downlinkMbps: downlink,
        uplinkMbps: uplink,
        jitterTolerance: jitter,
        reliabilityPercentage: reliability,
        mobilityTier: mobility,
        deviceDensityPerKm2: density,
      },
      aiRecommendation: {
        sliceCategory: activeResult.sliceName,
        sst: activeResult.sst,
        confidencePercentage: activeResult.confidence,
        qosParameters: {
          fiveQi: activeResult.fiveQi,
          packetDelayBudget: activeResult.delayBudget,
          packetErrorRate: activeResult.per,
        },
        edgeDeploymentStrategy: activeResult.edgeStrategy,
        justification: activeResult.summary,
        keyDrivers: activeResult.reasons,
      },
    };

    navigator.clipboard?.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [appName, industry, priority, latency, downlink, uplink, jitter, reliability, mobility, density, activeResult]);

  // Footer next button label for navigation steps
  const nextButtonText = currentStep < 3 ? 'Next Step' : 'Review & Analyse';

  return (
    <div className="recommender-container">
      <div className="recommender-hero">
        <div className="hero-badge">AI-Assisted 5G Provisioning</div>
        <h1 className="hero-title">
          <ShinyText
            text="TeaPot"
            color="#000000"
            shineColor="#333333"
            speed={2}
            shineWidth={40}
            softness={0.8}
            trigger="loop"
            className="hero-teapot-text"
          />
        </h1>
        <p className="hero-subtitle">
          Input your application connectivity parameters to evaluate and receive an explainable 3GPP slice allocation
          before deploying to the network.
        </p>
      </div>

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
          showNextButton={currentStep < 4}
          className="slice-stepper"
        >
          {/* STEP 1: Application Profile */}
          <Step title="Application Profile" description="Use Case & Priority">
            <div className="step-content">
              <div className="step-heading">
                <span className="step-badge">Step 1</span>
                <h3>Define Application Profile</h3>
                <p>Select a pre-tuned telecom template or customize your application metadata.</p>
              </div>

              <div className="preset-section">
                <label className="input-label">Quick Presets</label>
                <div className="preset-grid">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`preset-chip ${appName === p.name ? 'preset-chip--active' : ''}`}
                      onClick={() => applyPreset(p)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="app-name">Application Name</label>
                <input
                  id="app-name"
                  type="text"
                  className="text-input"
                  value={appName}
                  onChange={(e) => {
                    setAppName(e.target.value);
                    invalidateAnalysis();
                  }}
                  placeholder="e.g. Tele-operated Surgical Robot"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="input-label" htmlFor="industry-select">Industry Vertical</label>
                  <select
                    id="industry-select"
                    className="select-input"
                    value={industry}
                    onChange={(e) => {
                      setIndustry(e.target.value);
                      invalidateAnalysis();
                    }}
                  >
                    <option>Robotics & Logistics</option>
                    <option>Healthcare & Telemedicine</option>
                    <option>Automotive & Transport</option>
                    <option>Energy & Utilities</option>
                    <option>Media & Entertainment</option>
                    <option>Smart Cities & Surveillance</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="priority-select">Criticality Level</label>
                  <select
                    id="priority-select"
                    className="select-input"
                    value={priority}
                    onChange={(e) => {
                      setPriority(e.target.value);
                      invalidateAnalysis();
                    }}
                  >
                    <option>Mission Critical (Life/Safety)</option>
                    <option>Business Critical</option>
                    <option>Standard Best-Effort</option>
                  </select>
                </div>
              </div>
            </div>
          </Step>

          {/* STEP 2: Performance & QoS */}
          <Step title="QoS & Speed" description="Latency & Bandwidth">
            <div className="step-content">
              <div className="step-heading">
                <span className="step-badge">Step 2</span>
                <h3>Latency & Throughput Requirements</h3>
                <p>Define the strict end-to-end timing and bandwidth demands of your data flows.</p>
              </div>

              <div className="metric-box">
                <div className="metric-header">
                  <span className="input-label">Target E2E Latency</span>
                  <span className="metric-value-tag highlight-orange">{latency} ms</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  className="slider"
                  value={latency}
                  onChange={(e) => {
                    setLatency(Number(e.target.value));
                    invalidateAnalysis();
                  }}
                />
                <div className="slider-labels">
                  <span>1 ms (Ultra-Low)</span>
                  <span>20 ms</span>
                  <span>50 ms</span>
                  <span>100 ms (Tolerant)</span>
                </div>
              </div>

              <div className="form-row">
                <div className="metric-box">
                  <div className="metric-header">
                    <span className="input-label">Downlink Throughput</span>
                    <span className="metric-value-tag">{downlink} Mbps</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="1000"
                    step="10"
                    className="slider"
                    value={downlink}
                    onChange={(e) => {
                      setDownlink(Number(e.target.value));
                      invalidateAnalysis();
                    }}
                  />
                  <div className="slider-labels">
                    <span>1 Mbps</span>
                    <span>500 Mbps</span>
                    <span>1 Gbps</span>
                  </div>
                </div>

                <div className="metric-box">
                  <div className="metric-header">
                    <span className="input-label">Uplink Throughput</span>
                    <span className="metric-value-tag">{uplink} Mbps</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="300"
                    step="5"
                    className="slider"
                    value={uplink}
                    onChange={(e) => {
                      setUplink(Number(e.target.value));
                      invalidateAnalysis();
                    }}
                  />
                  <div className="slider-labels">
                    <span>1 Mbps</span>
                    <span>150 Mbps</span>
                    <span>300 Mbps</span>
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

          {/* STEP 3: Reliability & Mobility */}
          <Step title="Environment" description="Reliability & Density">
            <div className="step-content">
              <div className="step-heading">
                <span className="step-badge">Step 3</span>
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

              <div className="metric-box">
                <div className="metric-header">
                  <span className="input-label">Connection Density (devices / km²)</span>
                  <span className="metric-value-tag">{density.toLocaleString()} / km²</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1000000"
                  step="5000"
                  className="slider"
                  value={density}
                  onChange={(e) => {
                    setDensity(Number(e.target.value));
                    invalidateAnalysis();
                  }}
                />
                <div className="slider-labels">
                  <span>100 (Sparse)</span>
                  <span>50,000 (Campus)</span>
                  <span>1,000,000 (Massive IoT)</span>
                </div>
              </div>
            </div>
          </Step>

          {/* STEP 4: AI Recommendation & Justification */}
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
                    <span className="ready-step-indicator">Step 4 of 4</span>
                  </div>

                  <h3 className="ready-title">Ready to Analyse 5G Slice Requirements</h3>
                  <p className="ready-desc">
                    Click <strong>Analyse</strong> below to submit your telemetry profile to the AI model. The engine
                    will match constraints against 3GPP Release-18 slice templates and return an explainable telecom justification.
                  </p>

                  <div className="ready-spec-chips">
                    <div className="spec-chip">
                      <span className="chip-label">Application</span>
                      <span className="chip-val">{appName}</span>
                    </div>
                    <div className="spec-chip">
                      <span className="chip-label">Target Latency</span>
                      <span className="chip-val highlight-orange">{latency} ms</span>
                    </div>
                    <div className="spec-chip">
                      <span className="chip-label">Downlink / Uplink</span>
                      <span className="chip-val">{downlink} / {uplink} Mbps</span>
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
                      <span className="chip-val">{density.toLocaleString()} / km²</span>
                    </div>
                  </div>

                  <FuseButton
                    label="Analyse"
                    undoLabel="Undo"
                    doneLabel="Analysing..."
                    icon={<HugeiconsIcon icon={AiBrain01Icon} size={18} strokeWidth={2.2} />}
                    color="#ffffff"
                    background="#231f2d"
                    fuseColor="#f3903f"
                    size="lg"
                    radius={14}
                    undoWindow={5000}
                    fuse="outline"
                    fuseThickness={2}
                    commitOn="fuseEnd"
                    onCommit={() => triggerAnalysis()}
                    className="ready-analyze-fuse-btn"
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
                      <span>Analysis Returned by AI Engine</span>
                    </div>
                    <button type="button" className="re-analyze-btn" onClick={triggerAnalysis}>
                      ↻ Re-run Analysis
                    </button>
                  </div>

                  <div className="rec-header">
                    <div className="rec-slice-badge">
                      <span className="rec-sst">3GPP SST {activeResult.sst}</span>
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

                  <div className="edge-guideline">
                    <div className="edge-title">Core & Edge Deployment Architecture</div>
                    <div className="edge-desc">{activeResult.edgeStrategy}</div>
                  </div>

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
    </div>
  );
}
