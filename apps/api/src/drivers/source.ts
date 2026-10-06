/**
 * Source drivers for the ingest worker (PLAN §2.4, §7.5).
 *
 * A source driver yields raw rows in cursor order. The cursor is a `seq` (not a
 * timestamp) because late backfill rows carry old event times (D-08).
 *
 * `CsvSource`, `TimescaleRawSource` and `SimHttpSource` are real adapters kept
 * behind site config; `InfluxSource` is the documented `NotImplemented` stub.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parseCsvExport, reconcileManifest, type Manifest, type FileParse } from './csv-parser.js';
import type { RawRow as ContractRawRow } from '@contracts';

/** A raw source row plus the cursor / measurement metadata ingest needs. */
export interface SourceRow {
  /** Monotonic cursor position (string for portability). */
  seq: string;
  /** ISO-8601 UTC event time. */
  time: string;
  /** Source measurement name (e.g. "components" | "device"). */
  measurement: string;
  entityId: string;
  field: string;
  value: number;
  isDelayed: boolean;
}

export interface SourceBatch {
  rows: SourceRow[];
  cursor: string;
}

export interface SourceDriver {
  next(cursor: string | null, limit: number): Promise<SourceBatch>;
}

/** Projection to the contracts `RawRow` shape (drops cursor/measurement). */
export function toContractRawRow(row: SourceRow): ContractRawRow {
  return {
    entityId: row.entityId,
    field: row.field,
    at: row.time,
    value: row.value,
    isDelayed: row.isDelayed,
  };
}

export class NotImplementedError extends Error {
  readonly code = 'NOT_IMPLEMENTED';
  constructor(what: string) {
    super(`${what} is not implemented`);
    this.name = 'NotImplementedError';
  }
}

// ── SimHttpSource ────────────────────────────────────────────────────────────

export interface SimHttpSourceOptions {
  baseUrl: string;
  /** Endpoint path; defaults to the SimSite points endpoint. */
  path?: string;
  fetchImpl?: typeof fetch;
  /** Default measurement tag when the sim does not provide one. */
  defaultMeasurement?: string;
}

interface SimPointDto {
  seq?: number | string;
  time?: string;
  at?: string;
  measurement?: string;
  entity_id?: string;
  entityId?: string;
  field: string;
  value: number | null;
  is_delayed?: boolean;
  isDelayed?: boolean;
}

/**
 * Pulls points from SimSite (`GET /sim/points?since=<cursor>&limit=<n>`) with a
 * cursor on the sim's monotonic sequence.
 */
export class SimHttpSource implements SourceDriver {
  private readonly fetchImpl: typeof fetch;
  private readonly path: string;
  private readonly defaultMeasurement: string;

  constructor(private readonly opts: SimHttpSourceOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.path = opts.path ?? '/sim/points';
    this.defaultMeasurement = opts.defaultMeasurement ?? 'components';
  }

  async next(cursor: string | null, limit: number): Promise<SourceBatch> {
    const url = new URL(this.path, this.opts.baseUrl);
    if (cursor) url.searchParams.set('since', cursor);
    url.searchParams.set('limit', String(limit));

    const res = await this.fetchImpl(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`SimHttpSource: HTTP ${res.status} for ${url.toString()}`);
    const body = (await res.json()) as SimPointDto[] | { points?: SimPointDto[]; cursor?: string };
    const points = Array.isArray(body) ? body : body.points ?? [];

    const rows: SourceRow[] = points
      .filter((p) => p.value !== null && p.value !== undefined)
      .map((p, i) => ({
        seq: String(p.seq ?? (cursor ? Number(cursor) + 1 + i : i + 1)),
        time: p.time ?? p.at ?? new Date().toISOString(),
        measurement: p.measurement ?? this.defaultMeasurement,
        entityId: p.entity_id ?? p.entityId ?? '',
        field: p.field,
        value: Number(p.value),
        isDelayed: Boolean(p.is_delayed ?? p.isDelayed),
      }));

    const nextCursor = rows.length
      ? rows[rows.length - 1].seq
      : cursor ?? '0';
    return { rows, cursor: nextCursor };
  }
}

// ── CsvSource ────────────────────────────────────────────────────────────────

export interface CsvSourceOptions {
  /** A single CSV file, or a directory of `*.csv` files. */
  path: string;
  measurement?: string;
  /** Optional manifest.json; when present a failed reconciliation throws (gate G1). */
  manifestPath?: string;
  /** Column order fallback when a block has no recognised header. */
  hasHeader?: boolean;
}

/** Prefix for the synthetic sequence; the CSV export has no cursor column. */
const CSV_SEQ_PREFIX = 'csv:';

/** Reads a CSV export (multi-block, annotated) once and pages it by `seq`. */
export class CsvSource implements SourceDriver {
  private rows: SourceRow[] | null = null;

  constructor(private readonly opts: CsvSourceOptions) {}

  private async readAll(): Promise<FileParse[]> {
    const info = await stat(this.opts.path);
    if (info.isDirectory()) {
      const names = (await readdir(this.opts.path)).filter((n) => n.toLowerCase().endsWith('.csv')).sort();
      return Promise.all(
        names.map(async (n) => ({
          name: n,
          result: parseCsvExport(await readFile(join(this.opts.path, n), 'utf-8')),
        })),
      );
    }
    const text = await readFile(this.opts.path, 'utf-8');
    return [{ name: basename(this.opts.path), result: parseCsvExport(text) }];
  }

  private async load(): Promise<SourceRow[]> {
    if (this.rows) return this.rows;
    const files = await this.readAll();

    if (this.opts.manifestPath) {
      const manifest = JSON.parse(await readFile(this.opts.manifestPath, 'utf-8')) as Manifest;
      const recon = reconcileManifest(files, manifest);
      if (!recon.ok) {
        const detail = [
          ...recon.mismatches.map((m) => `${m.name}: ${m.field} expected ${m.expected} got ${m.actual}`),
          ...recon.unexpected.map((n) => `${n}: present but not in manifest`),
        ].join('; ');
        throw new Error(`CsvSource: manifest reconciliation failed — ${detail}`);
      }
    }

    const measurement = this.opts.measurement ?? 'components';
    const out: SourceRow[] = [];
    let n = 0;
    for (const file of files) {
      for (const row of file.result.rows) {
        n++;
        out.push({
          seq: `${CSV_SEQ_PREFIX}${n}`,
          time: row.time,
          measurement,
          entityId: row.entityId,
          field: row.field,
          value: row.value ?? 0,
          isDelayed: row.isDelayed,
        });
      }
    }
    this.rows = out;
    return out;
  }

  async next(cursor: string | null, limit: number): Promise<SourceBatch> {
    const rows = await this.load();
    const from = cursor && cursor.startsWith(CSV_SEQ_PREFIX) ? Number(cursor.slice(CSV_SEQ_PREFIX.length)) : 0;
    const page = rows.slice(from, from + limit);
    const nextCursor = page.length ? `${CSV_SEQ_PREFIX}${from + page.length}` : cursor ?? `${CSV_SEQ_PREFIX}0`;
    return { rows: page, cursor: nextCursor };
  }
}

// ── TimescaleRawSource ───────────────────────────────────────────────────────

export interface TimescaleColumns {
  time: string;
  measurement: string;
  entity: string;
  field: string;
  value: string;
  delayed: string;
  cursor: string;
}

export interface TimescaleRawSourceOptions {
  connectionString: string;
  table: string;
  columns: TimescaleColumns;
  fetchImpl?: never;
}

interface PgQueryable {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

/**
 * Reads raw rows from the client-shaped `points` table, advancing on `seq`.
 * Uses a lazily-imported `pg` pool so the package stays optional.
 */
export class TimescaleRawSource implements SourceDriver {
  private pool: PgQueryable | null = null;

  constructor(private readonly opts: TimescaleRawSourceOptions) {}

  private async getPool(): Promise<PgQueryable> {
    if (!this.pool) {
      const { Pool } = (await import('pg')) as unknown as {
        Pool: new (cfg: unknown) => PgQueryable;
      };
      this.pool = new Pool({ connectionString: this.opts.connectionString });
    }
    return this.pool;
  }

  async next(cursor: string | null, limit: number): Promise<SourceBatch> {
    const c = this.opts.columns;
    const pool = await this.getPool();
    const since = cursor ? Number(cursor) : 0;
    const sql = `SELECT ${c.cursor} AS seq, ${c.time} AS time, ${c.measurement} AS measurement,
        ${c.entity} AS entity_id, ${c.field} AS field, ${c.value} AS value, ${c.delayed} AS is_delayed
      FROM ${this.opts.table} WHERE ${c.cursor} > $1 ORDER BY ${c.cursor} ASC LIMIT $2`;
    const res = await pool.query<Record<string, unknown>>(sql, [since, limit]);
    const rows: SourceRow[] = res.rows.map((r) => ({
      seq: String(r.seq),
      time: new Date(r.time as string | number | Date).toISOString(),
      measurement: String(r.measurement),
      entityId: String(r.entity_id),
      field: String(r.field),
      value: Number(r.value),
      isDelayed: Boolean(r.is_delayed),
    }));
    const nextCursor = rows.length ? rows[rows.length - 1].seq : cursor ?? '0';
    return { rows, cursor: nextCursor };
  }
}

// ── InfluxSource (stub) ──────────────────────────────────────────────────────

export class InfluxSource implements SourceDriver {
  async next(): Promise<SourceBatch> {
    throw new NotImplementedError('InfluxSource');
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

export interface SourceFactoryConfig {
  driver: string;
  url?: string;
  dsnRef?: string;
  path?: string;
  table?: string;
  columns?: Partial<TimescaleColumns>;
  measurements?: { component?: string; device?: string };
}

/** Build the source driver selected by site config (never by site name). */
export function createSourceDriver(cfg: SourceFactoryConfig): SourceDriver {
  switch (cfg.driver) {
    case 'sim-http':
      return new SimHttpSource({ baseUrl: cfg.url ?? '' });
    case 'csv':
      return new CsvSource({ path: cfg.path ?? '' });
    case 'timescale-raw':
      return new TimescaleRawSource({
        connectionString: cfg.dsnRef ?? '',
        table: cfg.table ?? 'points',
        columns: {
          time: cfg.columns?.time ?? 'time',
          measurement: cfg.columns?.measurement ?? 'measurement',
          entity: cfg.columns?.entity ?? 'entity_id',
          field: cfg.columns?.field ?? 'field',
          value: cfg.columns?.value ?? 'value',
          delayed: cfg.columns?.delayed ?? 'is_delayed',
          cursor: cfg.columns?.cursor ?? 'seq',
        },
      });
    case 'influx':
      return new InfluxSource();
    default:
      throw new Error(`unknown source driver: ${cfg.driver}`);
  }
}
