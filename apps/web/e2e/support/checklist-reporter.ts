/**
 * Checklist reporter (PLAN §6.8, task T-042).
 *
 * A test joins the Test Checklist by putting `[<feature-id>]` in its title.
 * For every such test the reporter:
 *   1. starts the feature's seeded SimSite scenario (onTestBegin), then
 *   2. POSTs pass/fail/skipped + evidence to `POST /sim/checklist` (onTestEnd).
 *
 * SimSite being unreachable is a warning, not a test failure, so a pure UI run
 * still works without the simulator.
 */

import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { FEATURE_BY_ID, featureIdFromTitle, type ChecklistFeature } from './features';

const SIM_URL = process.env.E2E_SIM_URL ?? 'http://localhost:8000';
const RUN_ID = process.env.E2E_RUN_ID ?? `run-${new Date().toISOString().replace(/[:.]/g, '')}`;

let warnedUnreachable = false;

async function simPost(path: string, data: unknown): Promise<boolean> {
  try {
    const res = await fetch(SIM_URL.replace(/\/$/, '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      console.warn(`[checklist] POST ${path} -> ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    if (!warnedUnreachable) {
      warnedUnreachable = true;
      console.warn(`[checklist] SimSite unreachable at ${SIM_URL}; checklist not recorded (${String(err)})`);
    }
    return false;
  }
}

function statusFor(result: TestResult, feature: ChecklistFeature): string {
  switch (result.status) {
    case 'passed':
      return 'pass';
    case 'skipped':
      return feature.blockedBy ? 'skipped' : 'skipped';
    case 'failed':
    case 'timedOut':
    case 'interrupted':
      return 'fail';
    default:
      return 'unknown';
  }
}

function evidenceFor(result: TestResult, feature: ChecklistFeature): string {
  const trace = result.attachments.find((a) => a.name === 'trace');
  if (trace?.path) return trace.path;
  if (feature.blockedBy && (result.status === 'skipped' || result.status === 'failed')) {
    return `blocked: ${feature.blockedBy}`;
  }
  if (result.error?.message) return result.error.message.split('\n')[0].slice(0, 240);
  return `run ${RUN_ID}`;
}

export default class ChecklistReporter implements Reporter {
  private featureFor(test: TestCase): ChecklistFeature | undefined {
    const id = featureIdFromTitle(test.title);
    return id ? FEATURE_BY_ID.get(id) : undefined;
  }

  async onTestBegin(test: TestCase): Promise<void> {
    const feature = this.featureFor(test);
    if (!feature?.scenario) return;
    // Seeded deterministically by the scenario catalogue (no seed passed).
    await simPost(`/sim/scenarios/${feature.scenario}/start`, {});
  }

  async onTestEnd(test: TestCase, result: TestResult): Promise<void> {
    const feature = this.featureFor(test);
    if (!feature) return;
    if (feature.blockedBy && result.status === 'passed') {
      console.warn(`[checklist] ${feature.id} is marked blocked (${feature.blockedBy}) but passed`);
    }
    await simPost('/sim/checklist', {
      featureId: feature.id,
      status: statusFor(result, feature),
      runId: RUN_ID,
      evidence: evidenceFor(result, feature),
    });
  }
}
