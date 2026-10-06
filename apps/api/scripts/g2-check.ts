/**
 * G2 end-to-end harness: SimSite -> ingest -> quality -> API.
 *
 * Starts the real Python SimSite, advances it, pulls its raw rows through the
 * same `SimHttpSource` the app uses, runs them through the ingest worker and
 * quality layer into the store, then asks the real Fastify API for a chiller's
 * latest value. Prints PASS/FAIL and exits non-zero on failure.
 *
 * Run: pnpm -C apps/api g2    (requires python + apps/sim requirements installed)
 *
 * This is the executable form of gate G2 ("a live chiller value from SimSite in
 * the browser"): the only missing hop for the browser is the React screen, which
 * consumes the same documented endpoint exercised here.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonOntologyDriver } from '@ontology';
import { loadConfig } from '../src/config.js';
import { loadPointRoles } from '../src/domain/classify.js';
import { buildEntityToAsset, materializeAssets } from '../src/domain/ontology.js';
import { MemoryStore } from '../src/store/memory.js';
import { SimHttpSource } from '../src/drivers/source.js';
import { ingestBatch } from '../src/ingest/worker.js';
import { buildServer, createServerDeps, seedDemoUsers } from '../src/server.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// scripts/ -> apps/api -> apps -> repo root
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const SIM_DIR = resolve(REPO_ROOT, 'apps', 'sim');
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;

const pythonExe = ((): string => {
  const byExecutable = '-c';
  const script = 'import sys; print(sys.executable)';
  const candidates: string[][] = [
    ...(process.env.PYTHON ? [[process.env.PYTHON]] : []),
    ['python'],
    ['python3'],
    ['py', '-3'],
  ];
  for (const [bin, ...args] of candidates) {
    const probe = spawnSync(bin, [...args, byExecutable, script], { encoding: 'utf-8' });
    const exe = (probe.stdout ?? '').trim();
    if (probe.status === 0 && exe) return exe;
  }
  return 'python';
})();

function killTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function waitForSim(timeoutMs = 40_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/sim/state`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error('SimSite did not become ready in time');
}

async function main(): Promise<void> {
  const sim = spawn(
    pythonExe,
    ['-m', 'uvicorn', 'sim.app:app', '--host', '127.0.0.1', '--port', String(PORT)],
    { cwd: SIM_DIR, stdio: 'ignore' },
  );

  try {
    console.log('G2: waiting for SimSite…');
    await waitForSim();

    // Advance the engine so it has emitted rows, then pull them like the app does.
    const run = await fetch(`${BASE}/sim/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: 30 }),
    });
    if (!run.ok) throw new Error(`/sim/run failed: ${run.status}`);
    const runBody = (await run.json()) as { emitted: number; total: number };
    console.log(`G2: SimSite emitted ${runBody.emitted} rows (total ${runBody.total})`);

    const config = await loadConfig();
    const store = new MemoryStore({ auditKey: 'g2-harness' });
    const ontology = await new JsonOntologyDriver(config.paths.ontology).load(config.siteId);
    const pointRoles = loadPointRoles(config.paths.pointRoles);
    await store.upsertAssets(config.siteId, materializeAssets(ontology, config.siteId));

    const source = new SimHttpSource({ baseUrl: BASE, path: '/sim/raw', defaultMeasurement: 'components' });
    let fetched = 0;
    const byQuality: Record<number, number> = {};
    for (let i = 0; i < 100; i++) {
      const stats = await ingestBatch(
        store,
        source,
        config,
        { ontology, pointRoles, entityToAsset: buildEntityToAsset(ontology) },
        5000,
      );
      fetched += stats.fetched;
      for (const [code, n] of Object.entries(stats.byQuality)) {
        byQuality[Number(code)] = (byQuality[Number(code)] ?? 0) + n;
      }
      if (stats.fetched === 0) break;
    }
    console.log(`G2: ingested ${fetched} rows; quality histogram ${JSON.stringify(byQuality)}`);
    if (fetched === 0) throw new Error('no rows ingested from SimSite');

    // Build the real API against the populated store and read a chiller value.
    const deps = await createServerDeps({ config, store, ontology, pointRoles });
    await seedDemoUsers(store, config);
    const app = await buildServer(deps, false);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'engineer@example.com', password: 'Engineer123!' },
    });
    const token = (login.json() as { accessToken?: string }).accessToken;
    if (!token) throw new Error(`login failed: ${login.statusCode} ${login.body}`);

    const chiller = ontology.assets.find((a) => a.type === 'chiller');
    if (!chiller) throw new Error('no chiller in ontology');

    const latest = await app.inject({
      method: 'GET',
      url: `/api/v1/sites/${config.siteId}/assets/${chiller.id}/latest`,
      headers: { authorization: `Bearer ${token}` },
    });
    if (latest.statusCode !== 200) throw new Error(`latest failed: ${latest.statusCode} ${latest.body}`);
    const body = latest.json() as {
      fields?: Record<string, { value: number | null; quality: number; at: string }>;
      quality?: { coveragePct: number };
    };

    const named = body.fields?.['CHWST'];
    const field = named ?? Object.values(body.fields ?? {})[0];
    if (!field) throw new Error('latest returned no fields');
    if (typeof field.value !== 'number') throw new Error(`expected a numeric chiller value, got ${JSON.stringify(field)}`);
    if (!body.quality || typeof body.quality.coveragePct !== 'number') throw new Error('missing quality block');

    console.log(
      `G2 PASS: ${chiller.id} live value = ${field.value.toFixed(2)} (quality ${field.quality}), ` +
        `coverage ${body.quality.coveragePct}%`,
    );
    await app.close();
  } finally {
    killTree(sim);
  }
}

main().catch((err) => {
  console.error(`G2 FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
