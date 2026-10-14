import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { SimClient, type GatewayPreset, type SimState, type ScenarioInfo, type ChecklistFeature } from './api';
import { formatScale, formatSimClock, ingestHealth, nextScale } from './lib/format';

const BASE_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_SIM_URL ?? 'http://localhost:8000';
const client = new SimClient(BASE_URL);
const PRESETS: GatewayPreset[] = ['ok', 'reject', 'ignore', 'apply-then-alarm', 'drift', 'local-mode'];

const card: CSSProperties = {
  border: '1px solid #2a3441',
  borderRadius: 10,
  padding: 14,
  background: '#111820',
  minWidth: 0,
};
const btn: CSSProperties = {
  border: '1px solid #3a4a5c',
  background: '#1b2530',
  color: '#e6edf3',
  borderRadius: 6,
  padding: '5px 10px',
  cursor: 'pointer',
  fontSize: 13,
};

export default function App() {
  const [state, setState] = useState<SimState | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [features, setFeatures] = useState<ChecklistFeature[]>([]);
  const [seed, setSeed] = useState(1001);
  const [error, setError] = useState<string | null>(null);
  const [env, setEnv] = useState({ dbt: 32, rh: 55, occ: 1 });
  const [gateway, setGateway] = useState<{ preset: GatewayPreset; latencyMs: number; failureRate: number }>({
    preset: 'ok',
    latencyMs: 250,
    failureRate: 0,
  });

  const refresh = useCallback(async () => {
    try {
      const [s, sc, cl] = await Promise.all([
        client.state(),
        client.listScenarios(),
        client.checklist(),
      ]);
      setState(s);
      setScenarios(sc.scenarios);
      setFeatures(cl.features);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 2000);
    return () => clearInterval(id);
  }, [refresh]);

  const health = useMemo(() => ingestHealth(state?.ingestLagSeconds), [state?.ingestLagSeconds]);

  const setClock = (body: { scale?: number; paused?: boolean; seek?: string }) => {
    void client.setClock(body).then(refresh).catch((e) => setError(String(e)));
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#0b1015', color: '#e6edf3', minHeight: '100vh', padding: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Sim Console <span style={{ color: '#7d8ea3', fontSize: 13 }}>(schematic simulator control room)</span></h1>
        <div style={{ fontSize: 13, color: '#7d8ea3' }}>SimSite · {BASE_URL}</div>
      </header>

      {error && (
        <div style={{ ...card, borderColor: '#7f2d2d', color: '#ffb4b4', marginBottom: 12 }}>
          SimSite unreachable: {error}. Start it with <code>pnpm -C apps/sim dev</code>.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {/* Clock */}
        <section style={card}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>Clock</h2>
          <div style={{ fontSize: 28, fontVariantNumeric: 'tabular-nums' }}>{formatSimClock(state?.simTime)}</div>
          <div style={{ color: health === 'throttle' ? '#ffb454' : '#7d8ea3', fontSize: 13, margin: '4px 0 10px' }}>
            scale {formatScale(state?.scale ?? 0)} · ingest lag {state?.ingestLagSeconds ?? '—'}s ·{' '}
            {health === 'throttle' ? 'THROTTLE recommended' : health}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={btn} onClick={() => setClock({ paused: !state?.paused })}>
              {state?.paused ? 'Resume' : 'Pause'}
            </button>
            <button style={btn} onClick={() => setClock({ scale: nextScale(state?.scale ?? 1) })}>
              Speed →
            </button>
            <button style={btn} onClick={() => setClock({ scale: 1 })}>1×</button>
            <button style={btn} onClick={() => setClock({ scale: 60 })}>60×</button>
            <button style={btn} onClick={() => setClock({ scale: 600 })}>600×</button>
          </div>
        </section>

        {/* Weather & occupancy */}
        <section style={card}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>Weather & occupancy</h2>
          <Slider label={`Outdoor DBT ${env.dbt.toFixed(1)} °C`} min={15} max={48} step={0.5} value={env.dbt}
            onChange={(dbt) => setEnv((e) => ({ ...e, dbt }))} />
          <Slider label={`RH ${env.rh.toFixed(0)} %`} min={10} max={100} step={1} value={env.rh}
            onChange={(rh) => setEnv((e) => ({ ...e, rh }))} />
          <Slider label={`Occupancy ×${env.occ.toFixed(2)}`} min={0} max={2} step={0.05} value={env.occ}
            onChange={(occ) => setEnv((e) => ({ ...e, occ }))} />
          <button style={btn} onClick={() => void client.setEnv({ outdoor_dbt: env.dbt, rh: env.rh, occupancy_mult: env.occ }).then(refresh).catch((e) => setError(String(e)))}>
            Apply environment
          </button>
        </section>

        {/* Gateway */}
        <section style={card}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>Gateway</h2>
          <select
            value={gateway.preset}
            onChange={(e) => setGateway((g) => ({ ...g, preset: e.target.value as GatewayPreset }))}
            style={{ ...btn, width: '100%', marginBottom: 8 }}
          >
            {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <Slider label={`Latency ${gateway.latencyMs} ms`} min={0} max={3000} step={50} value={gateway.latencyMs}
            onChange={(latencyMs) => setGateway((g) => ({ ...g, latencyMs }))} />
          <Slider label={`Failure rate ${(gateway.failureRate * 100).toFixed(0)} %`} min={0} max={1} step={0.05} value={gateway.failureRate}
            onChange={(failureRate) => setGateway((g) => ({ ...g, failureRate }))} />
          <button style={btn} onClick={() => void client.setGateway(gateway)}>Apply gateway preset</button>
        </section>

        {/* Scenarios */}
        <section style={card}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>Scenarios</h2>
          <label style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
            seed <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))}
              style={{ ...btn, width: 100, marginLeft: 6 }} />
          </label>
          <div style={{ maxHeight: 180, overflow: 'auto', display: 'grid', gap: 4 }}>
            {scenarios.map((s) => (
              <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span title={s.description}>{s.name} <span style={{ color: '#7d8ea3' }}>({s.tier})</span></span>
                <span>
                  <button style={{ ...btn, padding: '2px 8px' }} onClick={() => void client.startScenario(s.name, seed)}>start</button>{' '}
                  <button style={{ ...btn, padding: '2px 8px' }} onClick={() => void client.stopScenario(s.name)}>stop</button>
                </span>
              </div>
            ))}
            {scenarios.length === 0 && <span style={{ color: '#7d8ea3', fontSize: 13 }}>No scenarios loaded.</span>}
          </div>
        </section>

        {/* Checklist */}
        <section style={{ ...card, gridColumn: '1 / -1' }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>Test Checklist (§6.8)</h2>
          <div style={{ display: 'grid', gap: 4 }}>
            {features.map((f) => (
              <div key={f.featureId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #1b2530', padding: '4px 0' }}>
                <span>{f.title} <span style={{ color: '#7d8ea3' }}>· {f.scenario} · {f.docRef ?? ''}</span></span>
                <StatusPill status={f.status ?? 'pending'} />
              </div>
            ))}
            {features.length === 0 && <span style={{ color: '#7d8ea3', fontSize: 13 }}>No features loaded.</span>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Slider(props: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
      {props.label}
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </label>
  );
}

function StatusPill({ status }: { status: 'pass' | 'fail' | 'skipped' | 'pending' }) {
  const colour = status === 'pass' ? '#2ea043' : status === 'fail' ? '#d1242f' : '#7d8ea3';
  return (
    <span style={{ color: colour, border: `1px solid ${colour}`, borderRadius: 999, padding: '1px 10px', fontSize: 12 }}>
      {status}
    </span>
  );
}
