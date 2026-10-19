import { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const fieldLabels = {
  latency_ms: ['Latency budget', 'ms'], throughput_mbps: ['Throughput', 'Mbps'],
  reliability_per: ['Packet error rate', 'PER'], mobility: ['Mobility', ''],
  device_density_per_km2: ['Device density', 'devices / km²'], arp_level: ['ARP level', ''],
  criticality: ['Criticality', ''], throughput_guaranteed: ['Throughput mode', ''],
};

export default function App() {
  const [presets, setPresets] = useState([]);
  const [preset, setPreset] = useState('ambulance_telemetry');
  const [description, setDescription] = useState('');
  const [values, setValues] = useState({});
  const [job, setJob] = useState(null);
  const [progress, setProgress] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API}/presets`).then(async response => {
      if (!response.ok) throw new Error('Could not load preset profiles.');
      setPresets(await response.json());
    }).catch(reason => setError(reason.message));
  }, []);

  useEffect(() => {
    if (!job?.events_url || !busy) return undefined;
    const events = new EventSource(new URL(job.events_url, API).toString());
    events.addEventListener('progress', event => {
      const update = JSON.parse(event.data);
      setProgress(current => [...current.filter(item => item.sequence !== update.sequence), update]);
    });
    events.addEventListener('done', async () => {
      events.close();
      const status = await fetch(new URL(job.status_url, API));
      const body = await status.json();
      if (body.status === 'completed') setResult(body.result);
      else setError(body.error?.message || 'Decision generation failed.');
      setBusy(false);
    });
    events.onerror = () => {
      events.close();
      if (busy) setError('Progress stream disconnected. You can submit a new request.');
      setBusy(false);
    };
    return () => events.close();
  }, [job, busy]);

  const sourceRows = useMemo(() => Object.entries(result?.normalized_requirements || {}), [result]);
  async function generate(event) {
    event.preventDefault();
    setBusy(true); setResult(null); setProgress([]); setError('');
    const requirements = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && value !== undefined));
    for (const key of ['latency_ms', 'throughput_mbps', 'reliability_per', 'device_density_per_km2', 'arp_level']) {
      if (requirements[key] !== undefined) requirements[key] = Number(requirements[key]);
    }
    if (requirements.throughput_guaranteed !== undefined) requirements.throughput_guaranteed = requirements.throughput_guaranteed === 'true';
    try {
      const response = await fetch(`${API}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset_name: preset || undefined, requirements, description: description || undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail?.map?.(item => `${item.loc?.at(-1)}: ${item.msg}`).join('; ') || 'Request was rejected.');
      setJob(body);
    } catch (reason) { setError(reason.message); setBusy(false); }
  }

  return <main className="shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">D</span> DUK <span className="brand-muted">/ SLICE ADVISOR</span></a><span className="sim-tag"><i /> SIMULATED CATALOGUE</span></header>
    <section className="intro" id="top"><div className="eyebrow">5G APPLICATION PLANNING</div><h1>Find the slice that<br /><em>fits your application.</em></h1><p>Describe the connectivity your workload needs. Get a traceable recommendation across eMBB, URLLC, and mMTC.</p></section>
    <div className="content-grid">
      <section className="panel form-panel"><div className="panel-heading"><span className="step">01</span><div><h2>Application requirements</h2><p>Choose a profile, then tune any inputs.</p></div></div>
        <form onSubmit={generate}>
          <label className="full">Starting profile<select value={preset} onChange={event => setPreset(event.target.value)}><option value="">Enter requirements manually</option>{presets.map(item => <option key={item.name} value={item.name}>{item.name.replaceAll('_', ' ')} · {item.description}</option>)}</select></label>
          <div className="fields">
            <label>Latency <small>ms</small><input type="number" min="0.1" max="1000" step="any" placeholder="Preset value" value={values.latency_ms ?? ''} onChange={e => setValues({ ...values, latency_ms: e.target.value })} /></label>
            <label>Throughput <small>Mbps</small><input type="number" min="0.001" max="10000" step="any" placeholder="Preset value" value={values.throughput_mbps ?? ''} onChange={e => setValues({ ...values, throughput_mbps: e.target.value })} /></label>
            <label>Reliability <small>packet error rate</small><input type="number" min="0.000000001" max="0.1" step="any" placeholder="Preset value" value={values.reliability_per ?? ''} onChange={e => setValues({ ...values, reliability_per: e.target.value })} /></label>
            <label>Mobility<select value={values.mobility ?? ''} onChange={e => setValues({ ...values, mobility: e.target.value })}><option value="">Preset value</option>{['stationary', 'pedestrian', 'vehicular', 'high_speed'].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Device density <small>devices / km²</small><input type="number" min="1" max="1000000" step="1" placeholder="Preset value" value={values.device_density_per_km2 ?? ''} onChange={e => setValues({ ...values, device_density_per_km2: e.target.value })} /></label>
            <label>Priority · ARP <small>1–15</small><input type="number" min="1" max="15" step="1" placeholder="Preset value" value={values.arp_level ?? ''} onChange={e => setValues({ ...values, arp_level: e.target.value })} /></label>
            <label>Criticality<select value={values.criticality ?? ''} onChange={e => setValues({ ...values, criticality: e.target.value })}><option value="">Preset value</option>{['routine', 'important', 'life_safety'].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Throughput service<select value={values.throughput_guaranteed ?? ''} onChange={e => setValues({ ...values, throughput_guaranteed: e.target.value })}><option value="">Preset value</option><option value="true">Guaranteed</option><option value="false">Best effort</option></select></label>
          </div>
          <label className="full description">Describe in plain language <span>OPTIONAL · MODEL NORMALISES QUALITATIVE TERMS ONLY</span><textarea rows="3" maxLength="4000" placeholder="For example: real-time control for fast moving emergency vehicles" value={description} onChange={event => setDescription(event.target.value)} /></label>
          <button className="submit" disabled={busy || (!preset && !Object.values(values).some(Boolean) && !description)}>{busy ? 'Analysis in progress…' : 'Generate recommendation'}<span>↗</span></button>
          <div className="scope-note">Decision support only. No network slice will be provisioned.</div>
        </form>
      </section>
      <section className="panel result-panel"><div className="panel-heading"><span className="step">02</span><div><h2>Decision report</h2><p>Scores and probabilities are computed deterministically.</p></div></div>
        {!result && !busy && <div className="empty"><div className="empty-icon">◌</div><h3>Your analysis will appear here</h3><p>Submit requirements to compare all three slice categories.</p></div>}
        {busy && <div className="progress"><div className="loader"/><h3>Analyzing requirements</h3>{progress.map(event => <div className="progress-line" key={event.sequence}><span className="check">✓</span><span>{event.message}</span></div>)}</div>}
        {result && <div className="report">
          <div className="recommendation"><div><span className="eyebrow">RECOMMENDED CATEGORY</span><h3>{result.recommended_slice}</h3></div><span className="verified">{result.reasoning_verified ? 'REVIEWED' : 'DETERMINISTIC'}</span></div>
          <div className="probabilities">{Object.entries(result.probabilities).map(([name, value]) => <div className="prob-row" key={name}><div className="prob-label"><span>{name}</span><b>{(value * 100).toFixed(1)}%</b></div><div className="track"><div className={`bar ${name === result.recommended_slice ? 'selected' : ''}`} style={{ width: `${value * 100}%` }} /></div></div>)}</div>
          <section className="report-section"><h4>WHY THIS FITS</h4><p className="reasoning">{result.reasoning || 'The deterministic recommendation is available; the explanation did not pass numeric consistency review.'}</p></section>
          <section className="report-section"><h4>SMALLEST DECISION CHANGES</h4>{result.counterfactuals.length ? result.counterfactuals.map((item, index) => <div className="counterfactual" key={index}><b>{item.to_category}</b><span>{Object.entries(item.changes).map(([key, value]) => `${fieldLabels[key]?.[0] || key}: ${value}`).join(' · ')}</span></div>) : <p className="muted">No category change was found within the configured search bounds.</p>}</section>
          <section className="report-section"><h4>INPUT PROVENANCE</h4><div className="provenance">{sourceRows.map(([key, field]) => <div key={key}><span>{fieldLabels[key]?.[0] || key}</span><b>{String(field.value)} {fieldLabels[key]?.[1]}</b><i className={`tag ${field.provenance}`}>{field.provenance}{field.source ? ` · ${field.source}` : ''}</i></div>)}</div></section>
          <div className="decision-id">DECISION ID <code>{result.decision_id}</code></div>
        </div>}
        {error && <div className="error" role="alert">{error}</div>}
      </section>
    </div>
    <footer><span>DUK SLICE ADVISOR</span><span>Probabilities are comparative fit estimates, not guaranteed service levels.</span></footer>
  </main>;
}
