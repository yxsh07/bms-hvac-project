/**
 * Store contract (PLAN §7.4).
 *
 * One interface with two implementations: an in-memory store used by tests and
 * dev, and a Postgres/Timescale store used in production. Routes and services
 * only ever depend on this interface.
 *
 * Quality values are always preserved: bad readings are stored with
 * `value = null` and the original in `rawValue`, never deleted or averaged.
 */

import type {
  AuditEventType,
  AuditLogEntry,
  Role,
  SeriesBucket,
  SeriesQuery,
  CounterQuery,
  SetpointRequest,
  SetpointState,
  AlarmSeverity,
  AlarmStatus,
} from '@contracts';

// ── Errors ───────────────────────────────────────────────────────────────────

/** Thrown by `createSetpoint` when a live request already occupies the slot. */
export class SetpointConflictError extends Error {
  constructor(readonly existingRequestId: string) {
    super('A live setpoint request already exists for this point');
    this.name = 'SetpointConflictError';
  }
}

// ── Users / auth ─────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  roles: Record<string, Role>;
  siteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RefreshTokenRecord {
  jti: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  replacedBy: string | null;
}

// ── Telemetry ────────────────────────────────────────────────────────────────

export interface TelemetryRow {
  siteId: string;
  entityId: string;
  entityKind: 'component' | 'device';
  field: string;
  /** ISO-8601 UTC event time. */
  time: string;
  /** Null when the reading failed a quality rule. */
  value: number | null;
  /** Original reading, kept only when quality <> 0 (the evidence). */
  rawValue: number | null;
  quality: number;
  isDelayed: boolean;
  seq?: number;
}

export interface LatestSample {
  value: number | null;
  at: string;
  quality: number;
  rawValue: number | null;
  isDelayed: boolean;
}

export interface Coverage {
  expected: number;
  received: number;
  pct: number;
}

// ── Setpoints ────────────────────────────────────────────────────────────────

/** Server-side record: the wire shape plus scheduler bookkeeping. */
export interface SetpointRecord extends SetpointRequest {
  tolerance: number;
  applyDeadline: string | null;
  applyStartedAt: string | null;
  watchUntil: string | null;
}

export interface SetpointListFilter {
  siteId?: string;
  state?: SetpointState;
  assetId?: string;
  limit?: number;
  cursor?: string;
}

// ── Audit ────────────────────────────────────────────────────────────────────

export interface AuditAppendInput {
  id?: string;
  siteId: string;
  occurredAt?: string;
  eventType: AuditEventType;
  actorId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
  device?: string | null;
  resource?: string | null;
  action?: string | null;
  before?: unknown | null;
  after?: unknown | null;
  justification?: string | null;
  approverId?: string | null;
}

export interface AuditQueryFilter {
  eventType?: AuditEventType;
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface AuditVerifyResult {
  valid: boolean;
  firstBrokenId: string | null;
  firstBrokenSeq: number | null;
  checkedCount: number;
}

export interface AuditSink {
  appendAudit(input: AuditAppendInput): Promise<AuditLogEntry>;
  auditLast(siteId: string): Promise<{ signature: string; seq: number } | null>;
  auditInsert(entry: AuditLogEntry): Promise<void>;
  auditAll(siteId: string): Promise<AuditLogEntry[]>;
  /** Serialise writers per site so concurrent appends cannot fork the chain. */
  withSiteLock<T>(siteId: string, fn: () => Promise<T>): Promise<T>;
}

// ── Ingest ───────────────────────────────────────────────────────────────────

export interface IngestReportRecord {
  siteId: string;
  entityId: string;
  firstSeen: string;
  lastSeen: string;
  rowCount: number;
  fields: string[];
}

// ── Alarms ───────────────────────────────────────────────────────────────────

export interface AlarmRecord {
  id: string;
  siteId: string;
  assetId: string;
  assetName: string;
  field: string | null;
  severity: AlarmSeverity;
  status: AlarmStatus;
  message: string;
  alarmCode: string;
  raisedAt: string;
  clearedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  acknowledgeNote: string | null;
  context?: Record<string, unknown>;
}

export interface AlarmListFilter {
  status?: AlarmStatus;
  severity?: AlarmSeverity;
  assetId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

// ── Assets (materialised from the ontology) ──────────────────────────────────

export interface AssetPointRecord {
  abbr: string;
  display: string;
  unit: string;
  group: string;
  cls: string;
  source: string;
  writable: boolean;
  safeMin?: number;
  safeMax?: number;
  tolerance?: number;
}

export interface AssetRecord {
  siteId: string;
  id: string;
  name: string;
  type: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  zoneId?: string;
  floorId?: string;
  controllerId?: string;
  points: AssetPointRecord[];
}

export interface AssetFilter {
  type?: string;
  zoneId?: string;
  floorId?: string;
}

// ── Reports ──────────────────────────────────────────────────────────────────

export interface ReportRunRecord {
  id: string;
  reportKey: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  siteId: string;
  requestedBy: string;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  downloadUrl: string | null;
  contentType: string | null;
  rowCount: number | null;
  format: 'json' | 'csv' | 'xlsx';
  errorMessage: string | null;
  params?: Record<string, unknown>;
}

export interface ReportRunFilter {
  reportKey?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}

// ── Paging ───────────────────────────────────────────────────────────────────

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ── Store ────────────────────────────────────────────────────────────────────

export interface Store extends AuditSink {
  // Users
  findUserByEmail(email: string): Promise<UserRecord | null>;
  getUser(id: string): Promise<UserRecord | null>;
  listUsers(): Promise<UserRecord[]>;
  createUser(user: UserRecord): Promise<UserRecord>;
  updateUser(id: string, patch: Partial<UserRecord>): Promise<UserRecord | null>;
  deleteUser(id: string): Promise<boolean>;

  // Refresh tokens
  saveRefreshToken(token: RefreshTokenRecord): Promise<void>;
  getRefreshToken(jti: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(jti: string, replacedBy?: string): Promise<void>;

  // Telemetry
  upsertTelemetry(rows: TelemetryRow[]): Promise<number>;
  latest(siteId: string, entityId: string): Promise<Record<string, LatestSample>>;
  series(q: SeriesQuery): Promise<SeriesBucket[]>;
  coverage(
    siteId: string,
    entityId: string,
    from: string,
    to: string,
    cadenceSeconds: number,
  ): Promise<Coverage>;
  counterDelta(q: CounterQuery): Promise<{ delta: number; resets: number }>;

  // Setpoints
  createSetpoint(record: SetpointRecord): Promise<SetpointRecord>;
  getSetpoint(id: string): Promise<SetpointRecord | null>;
  listSetpoints(filter: SetpointListFilter): Promise<Page<SetpointRecord>>;
  /** Open (non-terminal) requests, used by the scheduler. */
  listOpenSetpoints(siteId?: string): Promise<SetpointRecord[]>;
  findLiveSetpoint(
    siteId: string,
    assetId: string,
    field: string,
  ): Promise<SetpointRecord | null>;
  updateSetpoint(id: string, patch: Partial<SetpointRecord>): Promise<SetpointRecord>;

  // Audit
  appendAudit(input: AuditAppendInput): Promise<AuditLogEntry>;
  listAudit(siteId: string, query: AuditQueryFilter): Promise<Page<AuditLogEntry>>;
  verifyAudit(siteId: string): Promise<AuditVerifyResult>;

  // Ingest
  getIngestCursor(siteId: string): Promise<string | null>;
  setIngestCursor(siteId: string, cursor: string): Promise<void>;
  recordIngestReport(entries: IngestReportRecord[]): Promise<void>;
  listIngestReport(siteId: string): Promise<IngestReportRecord[]>;

  // Alarms
  createAlarm(alarm: AlarmRecord): Promise<AlarmRecord>;
  getAlarm(id: string): Promise<AlarmRecord | null>;
  listAlarms(siteId: string, filter: AlarmListFilter): Promise<Page<AlarmRecord>>;
  updateAlarm(id: string, patch: Partial<AlarmRecord>): Promise<AlarmRecord | null>;

  // Assets
  upsertAssets(siteId: string, assets: AssetRecord[]): Promise<void>;
  listAssets(siteId: string, filter?: AssetFilter): Promise<AssetRecord[]>;
  getAsset(siteId: string, id: string): Promise<AssetRecord | null>;

  // Reports
  createReportRun(run: ReportRunRecord): Promise<ReportRunRecord>;
  getReportRun(id: string): Promise<ReportRunRecord | null>;
  listReportRuns(siteId: string, filter: ReportRunFilter): Promise<Page<ReportRunRecord>>;

  // Transactions (memory: no-op wrapper; pg: BEGIN/COMMIT)
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;
}
