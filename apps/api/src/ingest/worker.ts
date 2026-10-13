/**
 * Ingest worker (PLAN §7.5).
 *
 * One batch, one transaction: read the next source page, qualify every row
 * through the shared quality pipeline, upsert, record unknown entities in
 * `ingest_report`, then advance the cursor. A crash mid-batch leaves the cursor
 * untouched so the batch is retried.
 *
 * Quality values are kept but marked: a failed row stores `value = null`, the
 * original in `rawValue`, and its quality code — never deleted, never averaged.
 */

import type { Ontology } from '@ontology';
import { qualifyRow, type QualifiedRow, type RawRow as QualityRawRow } from '@quality';
import type { LoadedConfig } from '../config.js';
import { classifyPoint, resolveRoleAbbrev, type PointRolesData } from '../domain/classify.js';
import type { IngestReportRecord, Store, TelemetryRow } from '../store/types.js';
import type { SourceDriver, SourceRow } from '../drivers/source.js';
import { toUtcIso } from '../util/time.js';

export interface IngestDeps {
  ontology: Ontology;
  pointRoles: PointRolesData;
  /** Maps source entity IDs to ontology asset IDs (identity when omitted). */
  entityToAsset?: Record<string, string>;
}

export interface IngestStats {
  siteId: string;
  fetched: number;
  stored: number;
  unknownEntities: number;
  unknownFields: number;
  byQuality: Record<number, number>;
  rows: QualifiedRow[];
}

function measurementNames(config: LoadedConfig): { component: string; device: string } {
  return {
    component: config.telemetry.measurements?.component ?? 'components',
    device: config.telemetry.measurements?.device ?? 'device',
  };
}

/**
 * Process a single batch. Pure with respect to its inputs — all state lives in
 * `store` and `source`, so tests can drive it deterministically.
 */
export async function ingestBatch(
  store: Store,
  source: SourceDriver,
  config: LoadedConfig,
  deps: IngestDeps,
  limit = 500,
): Promise<IngestStats> {
  const { component } = measurementNames(config);
  const siteId = config.siteId;

  const cursor = await store.getIngestCursor(siteId);
  const batch = await source.next(cursor, limit);
  const cursorNow = batch.cursor;

  // Only the components measurement is ingested by default (D-10); device rows
  // are ignored, but unknown entities are still reported by the source driver.
  const rows = batch.rows.filter((r) => r.measurement === component);

  const assetById = new Map(deps.ontology.assets.map((a) => [a.id, a]));

  // Per-entity field values in this batch: run-status and consistency context.
  const entityFields = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const assetId = deps.entityToAsset?.[row.entityId] ?? row.entityId;
    let fields = entityFields.get(assetId);
    if (!fields) {
      fields = {};
      entityFields.set(assetId, fields);
    }
    fields[row.field] = row.value;
  }

  const telemetryRows: TelemetryRow[] = [];
  const qualifiedRows: QualifiedRow[] = [];
  const reports = new Map<string, IngestReportRecord>();
  const byQuality: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  let unknownEntities = 0;
  let unknownFields = 0;

  for (const row of rows) {
    const assetId = deps.entityToAsset?.[row.entityId] ?? row.entityId;
    const time = toUtcIso(row.time);
    const asset = assetById.get(assetId);
    const point = asset
      ? (deps.ontology.points[assetId] ?? []).find((p) => p.abbr === row.field)
      : undefined;

    // Unknown entity or point: keep the row, but record it (never drop silently).
    if (!asset || !point) {
      if (!asset) unknownEntities += 1;
      if (asset && !point) unknownFields += 1;
      addReport(reports, siteId, row, time, config);
      telemetryRows.push({
        siteId,
        entityId: row.entityId,
        entityKind: 'component',
        field: row.field,
        time,
        value: row.value,
        rawValue: null,
        quality: 0,
        isDelayed: row.isDelayed,
        seq: Number(row.seq),
      });
      byQuality[0] += 1;
      continue;
    }

    const classification = classifyPoint({ cls: point.cls, unit: point.unit });
    const runStatusField = resolveRoleAbbrev(deps.pointRoles, asset.type, 'run-status');
    const relatedValues = entityFields.get(assetId) ?? {};
    const runStatus =
      runStatusField !== null && relatedValues[runStatusField] !== undefined
        ? relatedValues[runStatusField]
        : null;

    const qualityRow: QualityRawRow = {
      seq: Number(row.seq),
      time,
      measurement: row.measurement,
      entityId: row.entityId,
      field: row.field,
      value: row.value,
      isDelayed: row.isDelayed,
    };

    const qualified = qualifyRow(qualityRow, config.quality, {
      classification,
      runStatus,
      relatedValues,
    });
    qualifiedRows.push(qualified);
    byQuality[qualified.quality] = (byQuality[qualified.quality] ?? 0) + 1;

    telemetryRows.push({
      siteId,
      entityId: row.entityId,
      entityKind: 'component',
      field: row.field,
      time,
      value: qualified.qualifiedValue,
      rawValue: qualified.quality !== 0 ? qualified.rawValue : null,
      quality: qualified.quality,
      isDelayed: row.isDelayed,
      seq: Number(row.seq),
    });
  }

  await store.withTransaction(async () => {
    if (telemetryRows.length) await store.upsertTelemetry(telemetryRows);
    if (reports.size) await store.recordIngestReport([...reports.values()]);
    await store.setIngestCursor(siteId, cursorNow);
  });

  return {
    siteId,
    fetched: batch.rows.length,
    stored: telemetryRows.length,
    unknownEntities,
    unknownFields,
    byQuality,
    rows: qualifiedRows,
  };
}

function addReport(
  reports: Map<string, IngestReportRecord>,
  siteId: string,
  row: SourceRow,
  time: string,
  config: LoadedConfig,
): void {
  const existing = reports.get(row.entityId);
  if (existing) {
    existing.lastSeen = time;
    existing.rowCount += 1;
    if (!existing.fields.includes(row.field)) existing.fields.push(row.field);
    return;
  }
  reports.set(row.entityId, {
    siteId,
    entityId: row.entityId,
    firstSeen: time,
    lastSeen: time,
    rowCount: 1,
    fields: [row.field],
  });
  void config;
}

export interface IngestWorkerHandle {
  stop(): void;
}

/** Poll the source on the configured cadence until stopped. */
export function startIngestWorker(
  store: Store,
  source: SourceDriver,
  config: LoadedConfig,
  deps: IngestDeps,
  onBatch?: (stats: IngestStats) => void,
  intervalMs?: number,
): IngestWorkerHandle {
  const interval = intervalMs && intervalMs > 0 ? intervalMs : config.telemetry.cadenceSeconds * 1000;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const stats = await ingestBatch(store, source, config, deps);
      onBatch?.(stats);
    } catch (err) {
      // Never let a failed batch kill the loop; the cursor did not advance.
      onBatch?.({
        siteId: config.siteId,
        fetched: 0,
        stored: 0,
        unknownEntities: 0,
        unknownFields: 0,
        byQuality: {},
        rows: [],
      });
      void err;
    }
    if (!stopped) {
      timer = setTimeout(tick, interval);
      if (typeof timer.unref === 'function') timer.unref();
    }
  };

  void tick();
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
