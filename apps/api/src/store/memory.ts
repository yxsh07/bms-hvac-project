/**
 * In-memory Store — used by tests and by local dev without Postgres.
 *
 * Behaviour mirrors the SQL store closely enough that services and routes can
 * be exercised end-to-end: the audit chain is real (HMAC over canonical JSON),
 * quality values are preserved, and the one-live-request rule is enforced.
 */

import { randomUUID } from 'node:crypto';
import {
  LIVE_SETPOINT_STATES,
  TERMINAL_SETPOINT_STATES,
  type AuditLogEntry,
  type SeriesBucket,
  type SeriesQuery,
  type CounterQuery,
} from '@contracts';
import { AuditChain } from '../audit/chain.js';
import {
  SetpointConflictError,
  type AlarmListFilter,
  type AlarmRecord,
  type AssetFilter,
  type AssetRecord,
  type AuditAppendInput,
  type AuditQueryFilter,
  type AuditVerifyResult,
  type Coverage,
  type IngestReportRecord,
  type Page,
  type RefreshTokenRecord,
  type ReportRunFilter,
  type ReportRunRecord,
  type SetpointListFilter,
  type SetpointRecord,
  type Store,
  type TelemetryRow,
  type UserRecord,
} from './types.js';
import { coverageFrom, counterDeltaFrom, latestFrom, seriesFrom } from './telemetry-utils.js';

export interface MemoryStoreOptions {
  auditKey?: string;
  clock?: () => string;
  newId?: () => string;
}

function paginate<T>(items: T[], limit = 50, cursor?: string): Page<T> {
  const start = cursor ? items.findIndex((i) => idOf(i) === cursor) + 1 : 0;
  const slice = items.slice(start, start + limit);
  const nextIndex = start + limit;
  return {
    items: slice,
    nextCursor: nextIndex < items.length && slice.length > 0 ? idOf(items[nextIndex]) : null,
  };
}

function idOf(item: unknown): string {
  return (item as { id: string }).id;
}

export class MemoryStore implements Store {
  private readonly audit: AuditChain;
  private readonly clock: () => string;
  private readonly newId: () => string;

  private readonly users = new Map<string, UserRecord>();
  private readonly usersByEmail = new Map<string, string>();
  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();

  /** siteId → entityId → field → rows (kept sorted on write). */
  private readonly telemetry = new Map<string, Map<string, Map<string, TelemetryRow[]>>>();
  private readonly setpoints = new Map<string, SetpointRecord>();
  private readonly auditLog = new Map<string, AuditLogEntry[]>();
  private readonly siteLocks = new Map<string, Promise<unknown>>();
  private readonly ingestCursor = new Map<string, string>();
  private readonly ingestReport = new Map<string, Map<string, IngestReportRecord>>();
  private readonly alarms = new Map<string, AlarmRecord>();
  private readonly assets = new Map<string, AssetRecord>();
  private readonly reportRuns = new Map<string, ReportRunRecord>();

  constructor(opts: MemoryStoreOptions = {}) {
    this.clock = opts.clock ?? (() => new Date().toISOString());
    this.newId = opts.newId ?? (() => randomUUID());
    this.audit = new AuditChain(this, {
      key: opts.auditKey ?? 'test-audit-key',
      clock: this.clock,
      newId: this.newId,
    });
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const id = this.usersByEmail.get(email.toLowerCase());
    return id ? (this.users.get(id) ?? null) : null;
  }

  async getUser(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async listUsers(): Promise<UserRecord[]> {
    return [...this.users.values()].sort((a, b) => a.email.localeCompare(b.email));
  }

  async createUser(user: UserRecord): Promise<UserRecord> {
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email.toLowerCase(), user.id);
    return user;
  }

  async updateUser(id: string, patch: Partial<UserRecord>): Promise<UserRecord | null> {
    const existing = this.users.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id };
    if (patch.email && patch.email.toLowerCase() !== existing.email.toLowerCase()) {
      this.usersByEmail.delete(existing.email.toLowerCase());
      this.usersByEmail.set(updated.email.toLowerCase(), id);
    }
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    const existing = this.users.get(id);
    if (!existing) return false;
    this.usersByEmail.delete(existing.email.toLowerCase());
    return this.users.delete(id);
  }

  // ── Refresh tokens ─────────────────────────────────────────────────────────

  async saveRefreshToken(token: RefreshTokenRecord): Promise<void> {
    this.refreshTokens.set(token.jti, token);
  }

  async getRefreshToken(jti: string): Promise<RefreshTokenRecord | null> {
    return this.refreshTokens.get(jti) ?? null;
  }

  async revokeRefreshToken(jti: string, replacedBy?: string): Promise<void> {
    const token = this.refreshTokens.get(jti);
    if (token) {
      token.revokedAt = this.clock();
      token.replacedBy = replacedBy ?? null;
    }
  }

  // ── Telemetry ──────────────────────────────────────────────────────────────

  async upsertTelemetry(rows: TelemetryRow[]): Promise<number> {
    let count = 0;
    for (const row of rows) {
      let byEntity = this.telemetry.get(row.siteId);
      if (!byEntity) {
        byEntity = new Map();
        this.telemetry.set(row.siteId, byEntity);
      }
      let byField = byEntity.get(row.entityId);
      if (!byField) {
        byField = new Map();
        byEntity.set(row.entityId, byField);
      }
      let list = byField.get(row.field);
      if (!list) {
        list = [];
        byField.set(row.field, list);
      }
      const existingIndex = list.findIndex((r) => r.time === row.time);
      if (existingIndex >= 0) list[existingIndex] = { ...list[existingIndex], ...row };
      else list.push(row);
      list.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
      count += 1;
    }
    return count;
  }

  private rowsFor(siteId: string, entityId: string, field?: string): TelemetryRow[] {
    const byEntity = this.telemetry.get(siteId)?.get(entityId);
    if (!byEntity) return [];
    if (field) return byEntity.get(field) ?? [];
    return [...byEntity.values()].flat();
  }

  async latest(siteId: string, entityId: string): Promise<Record<string, import('./types.js').LatestSample>> {
    const byEntity = this.telemetry.get(siteId)?.get(entityId);
    const out: Record<string, import('./types.js').LatestSample> = {};
    if (!byEntity) return out;
    for (const [field, rows] of byEntity.entries()) {
      const last = latestFrom(rows);
      if (last) {
        out[field] = {
          value: last.value,
          at: last.time,
          quality: last.quality,
          rawValue: last.rawValue,
          isDelayed: last.isDelayed,
        };
      }
    }
    return out;
  }

  async series(q: SeriesQuery): Promise<SeriesBucket[]> {
    return seriesFrom(this.rowsFor(q.siteId, q.entityId, q.field), q);
  }

  async coverage(
    siteId: string,
    entityId: string,
    from: string,
    to: string,
    cadenceSeconds: number,
  ): Promise<Coverage> {
    return coverageFrom(this.rowsFor(siteId, entityId), from, to, cadenceSeconds);
  }

  async counterDelta(q: CounterQuery): Promise<{ delta: number; resets: number }> {
    return counterDeltaFrom(this.rowsFor(q.siteId, q.entityId, q.field), q);
  }

  // ── Setpoints ──────────────────────────────────────────────────────────────

  async createSetpoint(record: SetpointRecord): Promise<SetpointRecord> {
    const live = await this.findLiveSetpoint(record.siteId, record.assetId, record.field);
    if (live) throw new SetpointConflictError(live.id);
    this.setpoints.set(record.id, record);
    return record;
  }

  async getSetpoint(id: string): Promise<SetpointRecord | null> {
    return this.setpoints.get(id) ?? null;
  }

  async listSetpoints(filter: SetpointListFilter): Promise<Page<SetpointRecord>> {
    let items = [...this.setpoints.values()];
    if (filter.siteId) items = items.filter((s) => s.siteId === filter.siteId);
    if (filter.state) items = items.filter((s) => s.state === filter.state);
    if (filter.assetId) items = items.filter((s) => s.assetId === filter.assetId);
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(items, filter.limit ?? 50, filter.cursor);
  }

  async listOpenSetpoints(siteId?: string): Promise<SetpointRecord[]> {
    // The scheduler needs every non-terminal row (including APPLIED, which is
    // watched for alarms) — not just the live slot states.
    return [...this.setpoints.values()].filter(
      (s) => !TERMINAL_SETPOINT_STATES.has(s.state) && (!siteId || s.siteId === siteId),
    );
  }

  async findLiveSetpoint(
    siteId: string,
    assetId: string,
    field: string,
  ): Promise<SetpointRecord | null> {
    return (
      [...this.setpoints.values()].find(
        (s) =>
          s.siteId === siteId &&
          s.assetId === assetId &&
          s.field === field &&
          LIVE_SETPOINT_STATES.has(s.state),
      ) ?? null
    );
  }

  async updateSetpoint(id: string, patch: Partial<SetpointRecord>): Promise<SetpointRecord> {
    const existing = this.setpoints.get(id);
    if (!existing) throw new Error(`setpoint ${id} not found`);
    const updated = { ...existing, ...patch, id };
    this.setpoints.set(id, updated);
    return updated;
  }

  // ── Audit ──────────────────────────────────────────────────────────────────

  async withSiteLock<T>(siteId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.siteLocks.get(siteId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.siteLocks.set(
      siteId,
      prev.then(() => gate),
    );
    await prev.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async auditLast(siteId: string): Promise<{ signature: string; seq: number } | null> {
    const list = this.auditLog.get(siteId);
    if (!list || list.length === 0) return null;
    const last = list.reduce((a, b) => (a.seq > b.seq ? a : b));
    return { signature: last.signature, seq: last.seq };
  }

  async auditInsert(entry: AuditLogEntry): Promise<void> {
    const list = this.auditLog.get(entry.siteId) ?? [];
    list.push(entry);
    this.auditLog.set(entry.siteId, list);
  }

  async auditAll(siteId: string): Promise<AuditLogEntry[]> {
    return [...(this.auditLog.get(siteId) ?? [])];
  }

  async appendAudit(input: AuditAppendInput): Promise<AuditLogEntry> {
    return this.audit.append(input);
  }

  async listAudit(siteId: string, query: AuditQueryFilter): Promise<Page<AuditLogEntry>> {
    let items = (await this.auditAll(siteId)).slice().sort((a, b) => a.seq - b.seq);
    if (query.eventType) items = items.filter((e) => e.eventType === query.eventType);
    if (query.actorId) items = items.filter((e) => e.actorId === query.actorId);
    if (query.from) items = items.filter((e) => e.occurredAt >= query.from!);
    if (query.to) items = items.filter((e) => e.occurredAt <= query.to!);
    return paginate(items, query.limit ?? 50, query.cursor);
  }

  async verifyAudit(siteId: string): Promise<AuditVerifyResult> {
    return this.audit.verify(siteId);
  }

  // ── Ingest ─────────────────────────────────────────────────────────────────

  async getIngestCursor(siteId: string): Promise<string | null> {
    return this.ingestCursor.get(siteId) ?? null;
  }

  async setIngestCursor(siteId: string, cursor: string): Promise<void> {
    this.ingestCursor.set(siteId, cursor);
  }

  async recordIngestReport(entries: IngestReportRecord[]): Promise<void> {
    for (const entry of entries) {
      let bySite = this.ingestReport.get(entry.siteId);
      if (!bySite) {
        bySite = new Map();
        this.ingestReport.set(entry.siteId, bySite);
      }
      const existing = bySite.get(entry.entityId);
      if (existing) {
        existing.lastSeen = entry.lastSeen;
        existing.rowCount += entry.rowCount;
        existing.fields = [...new Set([...existing.fields, ...entry.fields])];
      } else {
        bySite.set(entry.entityId, { ...entry, fields: [...entry.fields] });
      }
    }
  }

  async listIngestReport(siteId: string): Promise<IngestReportRecord[]> {
    return [...(this.ingestReport.get(siteId)?.values() ?? [])];
  }

  // ── Alarms ─────────────────────────────────────────────────────────────────

  async createAlarm(alarm: AlarmRecord): Promise<AlarmRecord> {
    this.alarms.set(alarm.id, alarm);
    return alarm;
  }

  async getAlarm(id: string): Promise<AlarmRecord | null> {
    return this.alarms.get(id) ?? null;
  }

  async listAlarms(siteId: string, filter: AlarmListFilter): Promise<Page<AlarmRecord>> {
    let items = [...this.alarms.values()].filter((a) => a.siteId === siteId);
    if (filter.status) items = items.filter((a) => a.status === filter.status);
    if (filter.severity) items = items.filter((a) => a.severity === filter.severity);
    if (filter.assetId) items = items.filter((a) => a.assetId === filter.assetId);
    if (filter.from) items = items.filter((a) => a.raisedAt >= filter.from!);
    if (filter.to) items = items.filter((a) => a.raisedAt <= filter.to!);
    items.sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
    return paginate(items, filter.limit ?? 50, filter.cursor);
  }

  async updateAlarm(id: string, patch: Partial<AlarmRecord>): Promise<AlarmRecord | null> {
    const existing = this.alarms.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id };
    this.alarms.set(id, updated);
    return updated;
  }

  // ── Assets ─────────────────────────────────────────────────────────────────

  async upsertAssets(siteId: string, assets: AssetRecord[]): Promise<void> {
    for (const asset of assets) this.assets.set(asset.id, { ...asset, siteId });
  }

  async listAssets(siteId: string, filter: AssetFilter = {}): Promise<AssetRecord[]> {
    return [...this.assets.values()].filter(
      (a) =>
        a.siteId === siteId &&
        (!filter.type || a.type === filter.type) &&
        (!filter.zoneId || a.zoneId === filter.zoneId) &&
        (!filter.floorId || a.floorId === filter.floorId),
    );
  }

  async getAsset(siteId: string, id: string): Promise<AssetRecord | null> {
    const asset = this.assets.get(id);
    return asset && asset.siteId === siteId ? asset : null;
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  async createReportRun(run: ReportRunRecord): Promise<ReportRunRecord> {
    this.reportRuns.set(run.id, run);
    return run;
  }

  async getReportRun(id: string): Promise<ReportRunRecord | null> {
    return this.reportRuns.get(id) ?? null;
  }

  async listReportRuns(siteId: string, filter: ReportRunFilter): Promise<Page<ReportRunRecord>> {
    let items = [...this.reportRuns.values()].filter((r) => r.siteId === siteId);
    if (filter.reportKey) items = items.filter((r) => r.reportKey === filter.reportKey);
    if (filter.status) items = items.filter((r) => r.status === filter.status);
    items.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    return paginate(items, filter.limit ?? 50, filter.cursor);
  }

  // ── Transactions ───────────────────────────────────────────────────────────

  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  // ── Test hooks ─────────────────────────────────────────────────────────────

  /** Mutate a stored audit row (or one of its signed fields) to prove tampering. */
  tamperAudit(siteId: string, id: string, patch: Partial<AuditLogEntry>): void {
    const list = this.auditLog.get(siteId);
    if (!list) return;
    const index = list.findIndex((e) => e.id === id);
    if (index >= 0) list[index] = { ...list[index], ...patch };
  }
}
