/**
 * Postgres / Timescale Store (PLAN §7.4, §7.8).
 *
 * Loads `pg` lazily behind this adapter so neither typecheck nor the test
 * suite needs the package installed. All methods mirror the memory store; the
 * memory store is the reference implementation for behaviour.
 *
 * Not exercised by the unit tests (no database in CI); listed in the rebuild
 * report as approximated.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import {
  LIVE_SETPOINT_STATES,
  type AuditLogEntry,
  type CounterQuery,
  type SeriesBucket,
  type SeriesQuery,
} from '@contracts';
import { AuditChain } from '../audit/chain.js';
import type { Pool, PoolClient } from 'pg';
import {
  SetpointConflictError,
  type AlarmListFilter,
  type AlarmRecord,
  type AssetFilter,
  type AssetRecord,
  type AuditAppendInput,
  type AuditQueryFilter,
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
import { coverageFrom, counterDeltaFrom, seriesFrom } from './telemetry-utils.js';

export interface PostgresStoreOptions {
  connectionString: string;
  auditKey: string;
  /** Injectable pool (tests / advanced wiring). When absent, a pg Pool is created lazily. */
  pool?: Pool;
}

type Row = Record<string, unknown>;

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function paginate<T>(items: T[], limit = 50, cursor?: string): Page<T> {
  const start = cursor ? items.findIndex((i) => (i as { id: string }).id === cursor) + 1 : 0;
  const slice = items.slice(start, start + limit);
  const nextIndex = start + limit;
  return {
    items: slice,
    nextCursor:
      nextIndex < items.length && slice.length > 0 ? (items[nextIndex] as { id: string }).id : null,
  };
}

export class PostgresStore implements Store {
  private pool: Pool | null = null;
  private readonly tx = new AsyncLocalStorage<PoolClient>();
  private readonly audit: AuditChain;

  constructor(private readonly opts: PostgresStoreOptions) {
    this.pool = opts.pool ?? null;
    this.audit = new AuditChain(this, { key: opts.auditKey });
  }

  private async getPool(): Promise<Pool> {
    if (!this.pool) {
      const { Pool } = (await import('pg')) as unknown as { Pool: new (cfg: unknown) => Pool };
      // The migrations create the tables under the `app_store` schema while the
      // store issues unqualified names (`FROM users`). Pin the search_path so
      // those resolve; `site_store.*` stays explicitly qualified.
      this.pool = new Pool({
        connectionString: this.opts.connectionString,
        max: 10,
        options: '-c search_path=app_store,site_store,public',
      });
    }
    return this.pool;
  }

  private async q<R = Row>(text: string, params: unknown[] = []): Promise<R[]> {
    const client = this.tx.getStore();
    if (client) {
      const res = await client.query(text, params);
      return res.rows as R[];
    }
    const pool = await this.getPool();
    const res = await pool.query(text, params);
    return res.rows as R[];
  }

  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.withSiteLockInternal(null, fn);
  }

  async withSiteLock<T>(siteId: string, fn: () => Promise<T>): Promise<T> {
    return this.withSiteLockInternal(siteId, fn);
  }

  private async withSiteLockInternal<T>(siteId: string | null, fn: () => Promise<T>): Promise<T> {
    // Already inside a transaction (nested call): reuse it, never nest BEGIN.
    if (this.tx.getStore()) return fn();
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (siteId !== null) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [siteId]);
      const result = await this.tx.run(client, fn);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  private mapUser(r: Row): UserRecord {
    return {
      id: String(r.id),
      name: String(r.name),
      email: String(r.email),
      passwordHash: String(r.password_hash),
      roles: (r.roles ?? {}) as UserRecord['roles'],
      siteIds: (r.site_ids ?? []) as string[],
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
    };
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.q('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  async getUser(id: string): Promise<UserRecord | null> {
    const rows = await this.q('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  async listUsers(): Promise<UserRecord[]> {
    return (await this.q('SELECT * FROM users ORDER BY email')).map((r) => this.mapUser(r));
  }

  async createUser(user: UserRecord): Promise<UserRecord> {
    await this.q(
      `INSERT INTO users (id, name, email, password_hash, roles, site_ids, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [user.id, user.name, user.email, user.passwordHash, JSON.stringify(user.roles),
        JSON.stringify(user.siteIds), user.createdAt, user.updatedAt],
    );
    return user;
  }

  async updateUser(id: string, patch: Partial<UserRecord>): Promise<UserRecord | null> {
    const existing = await this.getUser(id);
    if (!existing) return null;
    const merged = { ...existing, ...patch, id };
    await this.q(
      `UPDATE users SET name=$2, email=$3, password_hash=$4, roles=$5, site_ids=$6, updated_at=$7 WHERE id=$1`,
      [id, merged.name, merged.email, merged.passwordHash, JSON.stringify(merged.roles),
        JSON.stringify(merged.siteIds), merged.updatedAt],
    );
    return merged;
  }

  async deleteUser(id: string): Promise<boolean> {
    const rows = await this.q('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  }

  // ── Refresh tokens ─────────────────────────────────────────────────────────

  async saveRefreshToken(token: RefreshTokenRecord): Promise<void> {
    await this.q(
      `INSERT INTO refresh_tokens (jti, user_id, created_at, expires_at, revoked_at, replaced_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [token.jti, token.userId, token.createdAt, token.expiresAt, token.revokedAt, token.replacedBy],
    );
  }

  async getRefreshToken(jti: string): Promise<RefreshTokenRecord | null> {
    const rows = await this.q('SELECT * FROM refresh_tokens WHERE jti = $1', [jti]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      jti: String(r.jti),
      userId: String(r.user_id),
      createdAt: iso(r.created_at),
      expiresAt: iso(r.expires_at),
      revokedAt: r.revoked_at ? iso(r.revoked_at) : null,
      replacedBy: r.replaced_by ? String(r.replaced_by) : null,
    };
  }

  async revokeRefreshToken(jti: string, replacedBy?: string): Promise<void> {
    await this.q('UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE jti = $1', [
      jti,
      replacedBy ?? null,
    ]);
  }

  // ── Telemetry ──────────────────────────────────────────────────────────────

  async upsertTelemetry(rows: TelemetryRow[]): Promise<number> {
    // Keep statements below PostgreSQL's parameter limit and avoid one network
    // round trip per point when accelerated simulation emits thousands/second.
    for (let start = 0; start < rows.length; start += 250) {
      const batch = rows.slice(start, start + 250);
      const params = batch.flatMap((row) => [row.time, row.siteId, row.entityId, row.entityKind,
        row.field, row.value, row.rawValue, row.quality, row.isDelayed]);
      const values = batch.map((_, index) => `(${Array.from({ length: 9 }, (_value, field) => `$${index * 9 + field + 1}`).join(',')})`).join(',');
      await this.q(
        `INSERT INTO telemetry (time, site_id, entity_id, entity_kind, field, value, raw_value, quality, is_delayed)
         VALUES ${values}
         ON CONFLICT (site_id, entity_id, field, time) DO UPDATE
           SET value = EXCLUDED.value, raw_value = EXCLUDED.raw_value,
               quality = EXCLUDED.quality, is_delayed = EXCLUDED.is_delayed`,
        params,
      );
    }
    return rows.length;
  }

  private mapTelemetry(r: Row): TelemetryRow {
    return {
      siteId: String(r.site_id),
      entityId: String(r.entity_id),
      entityKind: r.entity_kind === 'device' ? 'device' : 'component',
      field: String(r.field),
      time: iso(r.time),
      value: r.value === null ? null : Number(r.value),
      rawValue: r.raw_value === null ? null : Number(r.raw_value),
      quality: Number(r.quality),
      isDelayed: Boolean(r.is_delayed),
    };
  }

  async latest(siteId: string, entityId: string): Promise<Record<string, import('./types.js').LatestSample>> {
    const rows = await this.q(
      `SELECT DISTINCT ON (field) * FROM telemetry
       WHERE site_id=$1 AND entity_id=$2 ORDER BY field, time DESC`,
      [siteId, entityId],
    );
    const out: Record<string, import('./types.js').LatestSample> = {};
    for (const r of rows) {
      const row = this.mapTelemetry(r);
      out[row.field] = {
        value: row.value,
        at: row.time,
        quality: row.quality,
        rawValue: row.rawValue,
        isDelayed: row.isDelayed,
      };
    }
    return out;
  }

  async series(q: SeriesQuery): Promise<SeriesBucket[]> {
    const rows = await this.q(
      `SELECT * FROM telemetry WHERE site_id=$1 AND entity_id=$2 AND field=$3 AND time >= $4 AND time <= $5 ORDER BY time`,
      [q.siteId, q.entityId, q.field, q.from, q.to],
    );
    return seriesFrom(rows.map((r) => this.mapTelemetry(r)), q);
  }

  async coverage(
    siteId: string,
    entityId: string,
    from: string,
    to: string,
    cadenceSeconds: number,
  ): Promise<Coverage> {
    const rows = await this.q(
      'SELECT * FROM telemetry WHERE site_id=$1 AND entity_id=$2 AND time >= $3 AND time <= $4',
      [siteId, entityId, from, to],
    );
    return coverageFrom(rows.map((r) => this.mapTelemetry(r)), from, to, cadenceSeconds);
  }

  async counterDelta(q: CounterQuery): Promise<{ delta: number; resets: number }> {
    const rows = await this.q(
      'SELECT * FROM telemetry WHERE site_id=$1 AND entity_id=$2 AND field=$3 AND time >= $4 AND time <= $5 ORDER BY time',
      [q.siteId, q.entityId, q.field, q.from, q.to],
    );
    return counterDeltaFrom(rows.map((r) => this.mapTelemetry(r)), q);
  }

  // ── Setpoints ──────────────────────────────────────────────────────────────

  private mapSetpoint(r: Row): SetpointRecord {
    return {
      id: String(r.id),
      siteId: String(r.site_id),
      assetId: String(r.asset_id),
      field: String(r.field),
      state: r.state as SetpointRecord['state'],
      requestedValue: Number(r.requested_value),
      beforeValue: r.before_value === null ? null : Number(r.before_value),
      afterValue: r.after_value === null ? null : Number(r.after_value),
      proposerId: String(r.proposer_id),
      approverId: r.approver_id ? String(r.approver_id) : null,
      justification: String(r.justification),
      effectiveFrom: r.effective_from ? iso(r.effective_from) : null,
      revertAt: r.revert_at ? iso(r.revert_at) : null,
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
      reason: r.reason ? String(r.reason) : null,
      tolerance: Number(r.tolerance ?? 0.5),
      applyDeadline: r.apply_deadline ? iso(r.apply_deadline) : null,
      applyStartedAt: r.apply_started_at ? iso(r.apply_started_at) : null,
      watchUntil: r.watch_until ? iso(r.watch_until) : null,
    };
  }

  async createSetpoint(record: SetpointRecord): Promise<SetpointRecord> {
    const live = await this.findLiveSetpoint(record.siteId, record.assetId, record.field);
    if (live) throw new SetpointConflictError(live.id);
    await this.q(
      `INSERT INTO setpoint_requests
        (id, site_id, asset_id, field, state, requested_value, before_value, after_value,
         proposer_id, approver_id, justification, effective_from, revert_at, created_at, updated_at,
         reason, tolerance, apply_deadline, apply_started_at, watch_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [record.id, record.siteId, record.assetId, record.field, record.state, record.requestedValue,
        record.beforeValue, record.afterValue, record.proposerId, record.approverId, record.justification,
        record.effectiveFrom, record.revertAt, record.createdAt, record.updatedAt, record.reason,
        record.tolerance, record.applyDeadline, record.applyStartedAt, record.watchUntil],
    );
    return record;
  }

  async getSetpoint(id: string): Promise<SetpointRecord | null> {
    const rows = await this.q('SELECT * FROM setpoint_requests WHERE id = $1', [id]);
    return rows[0] ? this.mapSetpoint(rows[0]) : null;
  }

  async listSetpoints(filter: SetpointListFilter): Promise<Page<SetpointRecord>> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.siteId) { params.push(filter.siteId); where.push(`site_id = $${params.length}`); }
    if (filter.state) { params.push(filter.state); where.push(`state = $${params.length}`); }
    if (filter.assetId) { params.push(filter.assetId); where.push(`asset_id = $${params.length}`); }
    const sql = `SELECT * FROM setpoint_requests ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    const rows = await this.q(sql, params);
    return paginate(rows.map((r) => this.mapSetpoint(r)), filter.limit ?? 50, filter.cursor);
  }

  async listOpenSetpoints(siteId?: string): Promise<SetpointRecord[]> {
    const rows = siteId
      ? await this.q(
          `SELECT * FROM setpoint_requests WHERE site_id=$1 AND state NOT IN ('REJECTED','FAILED','REVERTED')`,
          [siteId],
        )
      : await this.q(
          `SELECT * FROM setpoint_requests WHERE state NOT IN ('REJECTED','FAILED','REVERTED')`,
        );
    return rows.map((r) => this.mapSetpoint(r));
  }

  async findLiveSetpoint(siteId: string, assetId: string, field: string): Promise<SetpointRecord | null> {
    const rows = await this.q(
      `SELECT * FROM setpoint_requests WHERE site_id=$1 AND asset_id=$2 AND field=$3
       AND state = ANY($4) LIMIT 1`,
      [siteId, assetId, field, [...LIVE_SETPOINT_STATES]],
    );
    return rows[0] ? this.mapSetpoint(rows[0]) : null;
  }

  async updateSetpoint(id: string, patch: Partial<SetpointRecord>): Promise<SetpointRecord> {
    const existing = await this.getSetpoint(id);
    if (!existing) throw new Error(`setpoint ${id} not found`);
    const merged = { ...existing, ...patch, id };
    await this.q(
      `UPDATE setpoint_requests SET state=$2, before_value=$3, after_value=$4, approver_id=$5,
         reason=$6, updated_at=$7, apply_deadline=$8, apply_started_at=$9, watch_until=$10 WHERE id=$1`,
      [id, merged.state, merged.beforeValue, merged.afterValue, merged.approverId, merged.reason,
        merged.updatedAt, merged.applyDeadline, merged.applyStartedAt, merged.watchUntil],
    );
    return merged;
  }

  // ── Audit ──────────────────────────────────────────────────────────────────

  private mapAudit(r: Row): AuditLogEntry {
    return {
      id: String(r.id),
      siteId: String(r.site_id),
      occurredAt: iso(r.occurred_at),
      eventType: String(r.event_type) as AuditLogEntry['eventType'],
      actorId: r.actor_id ? String(r.actor_id) : null,
      actorEmail: r.actor_email ? String(r.actor_email) : null,
      ip: r.ip ? String(r.ip) : null,
      device: r.device ? String(r.device) : null,
      resource: r.resource ? String(r.resource) : null,
      action: r.action ? String(r.action) : null,
      before: r.before ?? null,
      after: r.after ?? null,
      justification: r.justification ? String(r.justification) : null,
      approverId: r.approver_id ? String(r.approver_id) : null,
      signature: String(r.signature),
      seq: Number(r.seq),
    };
  }

  async auditLast(siteId: string): Promise<{ signature: string; seq: number } | null> {
    const rows = await this.q(
      'SELECT signature, seq FROM audit_log WHERE site_id=$1 ORDER BY seq DESC LIMIT 1',
      [siteId],
    );
    return rows[0] ? { signature: String(rows[0].signature), seq: Number(rows[0].seq) } : null;
  }

  async auditInsert(entry: AuditLogEntry): Promise<void> {
    await this.q(
      `INSERT INTO audit_log
        (id, site_id, occurred_at, event_type, actor_id, actor_email, ip, device, resource, action,
         before, after, justification, approver_id, signature, seq)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [entry.id, entry.siteId, entry.occurredAt, entry.eventType, entry.actorId, entry.actorEmail,
        entry.ip, entry.device, entry.resource, entry.action, JSON.stringify(entry.before),
        JSON.stringify(entry.after), entry.justification, entry.approverId, entry.signature, entry.seq],
    );
  }

  async auditAll(siteId: string): Promise<AuditLogEntry[]> {
    const rows = await this.q('SELECT * FROM audit_log WHERE site_id=$1 ORDER BY seq', [siteId]);
    return rows.map((r) => this.mapAudit(r));
  }

  async appendAudit(input: AuditAppendInput): Promise<AuditLogEntry> {
    return this.audit.append(input);
  }

  async listAudit(siteId: string, query: AuditQueryFilter): Promise<Page<AuditLogEntry>> {
    let items = await this.auditAll(siteId);
    if (query.eventType) items = items.filter((e) => e.eventType === query.eventType);
    if (query.actorId) items = items.filter((e) => e.actorId === query.actorId);
    if (query.from) items = items.filter((e) => e.occurredAt >= query.from!);
    if (query.to) items = items.filter((e) => e.occurredAt <= query.to!);
    return paginate(items, query.limit ?? 50, query.cursor);
  }

  async verifyAudit(siteId: string) {
    return this.audit.verify(siteId);
  }

  /**
   * E2E-only: mutate a stored audit row in place. Never called by product code;
   * the route that reaches it is disabled unless E2E_TAMPER_ENABLED=1.
   */
  async tamperAudit(siteId: string, id: string, patch: Partial<AuditLogEntry>): Promise<void> {
    const columns: Record<string, string> = {
      justification: 'justification',
      approverId: 'approver_id',
      actorEmail: 'actor_email',
      ip: 'ip',
      device: 'device',
      signature: 'signature',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, column] of Object.entries(columns)) {
      if (patch[key as keyof AuditLogEntry] !== undefined) {
        sets.push(`${column}=$${i++}`);
        values.push(patch[key as keyof AuditLogEntry]);
      }
    }
    if (sets.length === 0) return;
    values.push(siteId, id);
    await this.q(
      `UPDATE audit_log SET ${sets.join(', ')} WHERE site_id=$${i++} AND id=$${i++}`,
      values,
    );
  }

  // ── Ingest ─────────────────────────────────────────────────────────────────

  async getIngestCursor(siteId: string): Promise<string | null> {
    const rows = await this.q('SELECT cursor FROM ingest_cursor WHERE site_id=$1', [siteId]);
    return rows[0] ? String(rows[0].cursor) : null;
  }

  async setIngestCursor(siteId: string, cursor: string): Promise<void> {
    await this.q(
      `INSERT INTO ingest_cursor (site_id, cursor, updated_at) VALUES ($1,$2,now())
       ON CONFLICT (site_id) DO UPDATE SET cursor = EXCLUDED.cursor, updated_at = now()`,
      [siteId, cursor],
    );
  }

  async recordIngestReport(entries: IngestReportRecord[]): Promise<void> {
    for (const e of entries) {
      await this.q(
        `INSERT INTO ingest_report (site_id, entity_id, first_seen, last_seen, row_count, fields)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (site_id, entity_id) DO UPDATE
           SET last_seen = EXCLUDED.last_seen, row_count = ingest_report.row_count + EXCLUDED.row_count,
               fields = EXCLUDED.fields`,
        [e.siteId, e.entityId, e.firstSeen, e.lastSeen, e.rowCount, JSON.stringify(e.fields)],
      );
    }
  }

  async listIngestReport(siteId: string): Promise<IngestReportRecord[]> {
    const rows = await this.q('SELECT * FROM ingest_report WHERE site_id=$1', [siteId]);
    return rows.map((r) => ({
      siteId: String(r.site_id),
      entityId: String(r.entity_id),
      firstSeen: iso(r.first_seen),
      lastSeen: iso(r.last_seen),
      rowCount: Number(r.row_count),
      fields: (r.fields ?? []) as string[],
    }));
  }

  // ── Alarms ─────────────────────────────────────────────────────────────────

  private mapAlarm(r: Row): AlarmRecord {
    return {
      id: String(r.id),
      siteId: String(r.site_id),
      assetId: String(r.asset_id),
      assetName: String(r.asset_name),
      field: r.field ? String(r.field) : null,
      severity: r.severity as AlarmRecord['severity'],
      status: r.status as AlarmRecord['status'],
      message: String(r.message),
      alarmCode: String(r.alarm_code),
      raisedAt: iso(r.raised_at),
      clearedAt: r.cleared_at ? iso(r.cleared_at) : null,
      acknowledgedBy: r.acknowledged_by ? String(r.acknowledged_by) : null,
      acknowledgedAt: r.acknowledged_at ? iso(r.acknowledged_at) : null,
      acknowledgeNote: r.acknowledge_note ? String(r.acknowledge_note) : null,
      context: (r.context ?? undefined) as Record<string, unknown> | undefined,
    };
  }

  async createAlarm(alarm: AlarmRecord): Promise<AlarmRecord> {
    await this.q(
      `INSERT INTO alarms (id, site_id, asset_id, asset_name, field, severity, status, message,
         alarm_code, raised_at, cleared_at, acknowledged_by, acknowledged_at, acknowledge_note, context)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [alarm.id, alarm.siteId, alarm.assetId, alarm.assetName, alarm.field, alarm.severity, alarm.status,
        alarm.message, alarm.alarmCode, alarm.raisedAt, alarm.clearedAt, alarm.acknowledgedBy,
        alarm.acknowledgedAt, alarm.acknowledgeNote, JSON.stringify(alarm.context ?? {})],
    );
    return alarm;
  }

  async getAlarm(id: string): Promise<AlarmRecord | null> {
    const rows = await this.q('SELECT * FROM alarms WHERE id=$1', [id]);
    return rows[0] ? this.mapAlarm(rows[0]) : null;
  }

  async listAlarms(siteId: string, filter: AlarmListFilter): Promise<Page<AlarmRecord>> {
    const where = ['site_id = $1'];
    const params: unknown[] = [siteId];
    if (filter.status) { params.push(filter.status); where.push(`status = $${params.length}`); }
    if (filter.severity) { params.push(filter.severity); where.push(`severity = $${params.length}`); }
    if (filter.assetId) { params.push(filter.assetId); where.push(`asset_id = $${params.length}`); }
    const rows = await this.q(`SELECT * FROM alarms WHERE ${where.join(' AND ')} ORDER BY raised_at DESC`, params);
    return paginate(rows.map((r) => this.mapAlarm(r)), filter.limit ?? 50, filter.cursor);
  }

  async updateAlarm(id: string, patch: Partial<AlarmRecord>): Promise<AlarmRecord | null> {
    const existing = await this.getAlarm(id);
    if (!existing) return null;
    const merged = { ...existing, ...patch, id };
    await this.q(
      `UPDATE alarms SET status=$2, cleared_at=$3, acknowledged_by=$4, acknowledged_at=$5, acknowledge_note=$6 WHERE id=$1`,
      [id, merged.status, merged.clearedAt, merged.acknowledgedBy, merged.acknowledgedAt, merged.acknowledgeNote],
    );
    return merged;
  }

  // ── Assets ─────────────────────────────────────────────────────────────────

  async upsertAssets(siteId: string, assets: AssetRecord[]): Promise<void> {
    for (const a of assets) {
      await this.q(
        `INSERT INTO assets (site_id, id, name, type, criticality, zone_id, floor_id, controller_id, points)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (site_id, id) DO UPDATE SET name=EXCLUDED.name, type=EXCLUDED.type,
           criticality=EXCLUDED.criticality, zone_id=EXCLUDED.zone_id, floor_id=EXCLUDED.floor_id,
           controller_id=EXCLUDED.controller_id, points=EXCLUDED.points`,
        [siteId, a.id, a.name, a.type, a.criticality, a.zoneId ?? null, a.floorId ?? null,
          a.controllerId ?? null, JSON.stringify(a.points)],
      );
    }
  }

  private mapAsset(r: Row): AssetRecord {
    return {
      siteId: String(r.site_id),
      id: String(r.id),
      name: String(r.name),
      type: String(r.type),
      criticality: r.criticality as AssetRecord['criticality'],
      zoneId: r.zone_id ? String(r.zone_id) : undefined,
      floorId: r.floor_id ? String(r.floor_id) : undefined,
      controllerId: r.controller_id ? String(r.controller_id) : undefined,
      points: (r.points ?? []) as AssetRecord['points'],
    };
  }

  async listAssets(siteId: string, filter: AssetFilter = {}): Promise<AssetRecord[]> {
    const where = ['site_id = $1'];
    const params: unknown[] = [siteId];
    if (filter.type) { params.push(filter.type); where.push(`type = $${params.length}`); }
    if (filter.zoneId) { params.push(filter.zoneId); where.push(`zone_id = $${params.length}`); }
    if (filter.floorId) { params.push(filter.floorId); where.push(`floor_id = $${params.length}`); }
    const rows = await this.q(`SELECT * FROM assets WHERE ${where.join(' AND ')}`, params);
    return rows.map((r) => this.mapAsset(r));
  }

  async getAsset(siteId: string, id: string): Promise<AssetRecord | null> {
    const rows = await this.q('SELECT * FROM assets WHERE site_id=$1 AND id=$2', [siteId, id]);
    return rows[0] ? this.mapAsset(rows[0]) : null;
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  private mapReportRun(r: Row): ReportRunRecord {
    return {
      id: String(r.id),
      reportKey: String(r.report_key),
      status: r.status as ReportRunRecord['status'],
      siteId: String(r.site_id),
      requestedBy: String(r.requested_by),
      requestedAt: iso(r.requested_at),
      startedAt: r.started_at ? iso(r.started_at) : null,
      completedAt: r.completed_at ? iso(r.completed_at) : null,
      downloadUrl: r.download_url ? String(r.download_url) : null,
      contentType: r.content_type ? String(r.content_type) : null,
      rowCount: r.row_count === null ? null : Number(r.row_count),
      format: r.format as ReportRunRecord['format'],
      errorMessage: r.error_message ? String(r.error_message) : null,
      params: (r.params ?? undefined) as Record<string, unknown> | undefined,
    };
  }

  async createReportRun(run: ReportRunRecord): Promise<ReportRunRecord> {
    await this.q(
      `INSERT INTO report_runs (id, report_key, status, site_id, requested_by, requested_at, started_at,
         completed_at, download_url, content_type, row_count, format, error_message, params)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [run.id, run.reportKey, run.status, run.siteId, run.requestedBy, run.requestedAt, run.startedAt,
        run.completedAt, run.downloadUrl, run.contentType, run.rowCount, run.format, run.errorMessage,
        JSON.stringify(run.params ?? {})],
    );
    return run;
  }

  async getReportRun(id: string): Promise<ReportRunRecord | null> {
    const rows = await this.q('SELECT * FROM report_runs WHERE id=$1', [id]);
    return rows[0] ? this.mapReportRun(rows[0]) : null;
  }

  async listReportRuns(siteId: string, filter: ReportRunFilter): Promise<Page<ReportRunRecord>> {
    const where = ['site_id = $1'];
    const params: unknown[] = [siteId];
    if (filter.reportKey) { params.push(filter.reportKey); where.push(`report_key = $${params.length}`); }
    if (filter.status) { params.push(filter.status); where.push(`status = $${params.length}`); }
    const rows = await this.q(`SELECT * FROM report_runs WHERE ${where.join(' AND ')} ORDER BY requested_at DESC`, params);
    return paginate(rows.map((r) => this.mapReportRun(r)), filter.limit ?? 50, filter.cursor);
  }

  async close(): Promise<void> {
    if (this.pool) await this.pool.end();
  }
}

/** Factory used by `server.ts` when the site config selects the pg store. */
export function createPostgresStore(opts: PostgresStoreOptions): PostgresStore {
  return new PostgresStore(opts);
}

// Re-exported for callers that need an id generator without the chain.
export { randomUUID };
