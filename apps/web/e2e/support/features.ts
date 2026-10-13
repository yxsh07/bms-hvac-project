/**
 * Test Checklist catalogue for the Playwright suite (PLAN §6.8, §13.2).
 *
 * Keep in step with `data/scenarios/features.yaml` (the Sim Console reads that
 * file; the reporter reads this one so it needs no YAML parser). A test opts in
 * to scenario setup + checklist reporting by putting `[<feature-id>]` at the
 * start of its title.
 */

export interface ChecklistFeature {
  id: string;
  title: string;
  /** SimSite scenario to start before the test, or null for pure-unit checks. */
  scenario: string | null;
  docRef: string;
  /** Part of the PR smoke subset (see the `@smoke` tag). */
  smoke?: boolean;
  /** Set when the feature cannot pass yet; the reporter records it as skipped. */
  blockedBy?: string;
}

export const FEATURES: ChecklistFeature[] = [
  { id: 'live-value', title: 'A live plant value appears through ingest + quality', scenario: 'normal-day', docRef: 'S7', smoke: true },
  { id: 'heatwave-staging', title: 'Heatwave stages the lag chiller and widens tower approach', scenario: 'heatwave', docRef: 'D-06' },
  { id: 'lead-trip-failover', title: 'Lead chiller trip raises an alarm and fails over to standby', scenario: 'lead-chiller-trip', docRef: 'D-02' },
  { id: 'controller-outage-coverage', title: 'Controller outage drives coverage CRITICAL and shows blast radius', scenario: 'controller-outage', docRef: 'D-02' },
  { id: 'sensor-garbage-quality', title: 'Sentinels and impossible values are flagged, never averaged away', scenario: 'sensor-garbage', docRef: 'D-04' },
  { id: 'stopped-equipment-zeros', title: 'Stopped-equipment zeros are suppressed from plant averages', scenario: 'stopped-equipment-zeros', docRef: 'D-05' },
  { id: 'critical-ahu-excursions', title: 'Critical AHU shows valve saturation and RH excursions', scenario: 'critical-ahu-drift', docRef: 'O-02' },
  { id: 'low-delta-t-advice', title: 'Low delta-T fires an optimiser recommendation', scenario: 'low-delta-t', docRef: 'O-03', blockedBy: 'Optimiser (T-051) not implemented' },
  { id: 'setpoint-ok', title: 'Set-point request applies, reads back, and is audited (gateway ok)', scenario: 'normal-day', docRef: 'S8', smoke: true },
  { id: 'setpoint-reject', title: 'Gateway rejection fails the request and audits the transition', scenario: 'normal-day', docRef: 'S8', smoke: true },
  { id: 'setpoint-ignore', title: 'Gateway ignore fails read-back and raises the request FAILED', scenario: 'normal-day', docRef: 'S8' },
  { id: 'setpoint-apply-then-alarm', title: 'Alarm inside the watch window reverts the set point', scenario: 'normal-day', docRef: 'S8', blockedBy: 'Alarm ingestion/watch wiring not implemented' },
  { id: 'setpoint-guards', title: 'Workflow guards block self-approval, a second live request and out-of-range values', scenario: 'normal-day', docRef: 'S8', smoke: true },
  { id: 'rbac-matrix', title: 'Each of the five roles is allowed or denied correctly, and denials are audited', scenario: null, docRef: 'S5', smoke: true },
  { id: 'audit-tamper', title: 'Audit verification fails at the modified row', scenario: null, docRef: 'S9', smoke: true },
  { id: 'whatif-overlay', title: 'What-if overlay is labelled indicative and leaves live state unchanged', scenario: 'normal-day', docRef: 'WIF1', smoke: true },
  { id: 'load-curve-shape', title: 'Hourly kW follows the calibrated load curve within tolerance', scenario: 'normal-day', docRef: '—', blockedBy: '24 h run + report pipeline (T-050) not implemented' },
  { id: 'reports-five', title: 'Reports 1–5 match their golden files', scenario: null, docRef: 'S10', blockedBy: 'Reports (T-050) not implemented' },
  { id: 'late-data', title: 'Regenerated report differs and the late count is shown', scenario: 'late-data-backfill', docRef: '—', blockedBy: 'Reports (T-050) not implemented' },
  { id: 'orphan-entities', title: 'Ingest report lists unknown IDs', scenario: 'orphan-entities', docRef: 'D-01', blockedBy: 'Ingest report endpoint/report (T-050) not exposed' },
  { id: 'contradictory-unit', title: 'Consistency rule marks the dependent field quality 4', scenario: 'contradictory-fcu', docRef: 'D-07' },
  { id: 'counter-reset', title: 'Energy is not over-counted across a counter reset', scenario: 'counter-reset', docRef: '—', blockedBy: 'Energy report (T-050) not implemented' },
  { id: 'site-agnostic', title: 'A second site renders a different plant with no code change', scenario: null, docRef: 'S6', blockedBy: 'Second synthetic site (T-058) not implemented' },
  { id: 'manifest-reconciliation', title: 'Parser counts equal manifest.json (local only)', scenario: null, docRef: 'S1', blockedBy: 'Requires data/raw; never runs in CI' },
];

export const FEATURE_BY_ID: ReadonlyMap<string, ChecklistFeature> = new Map(
  FEATURES.map((f) => [f.id, f]),
);

/** Extract `[feature-id]` from a test title, if present. */
export function featureIdFromTitle(title: string): string | null {
  const match = /\[([a-z0-9-]+)\]/.exec(title);
  return match ? match[1] : null;
}
