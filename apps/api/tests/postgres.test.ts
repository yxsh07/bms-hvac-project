/**
 * PostgresStore tests against an in-memory Postgres (pg-mem).
 *
 * These execute the store's real SQL (INSERT / SELECT / ON CONFLICT / RETURNING
 * / transactions), unlike the reference MemoryStore tests in the other suites.
 * A live-DB integration test is in postgres.integration.test.ts and runs when
 * TEST_DATABASE_URL is set.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { DataType, newDb, type IMemoryDb } from 'pg-mem';
import type { Pool } from 'pg';
import { PostgresStore } from '../src/store/postgres.js';
import type { UserRecord } from '../src/store/types.js';

const DDL = `
  CREATE TABLE users (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    roles jsonb NOT NULL DEFAULT '{}',
    site_ids jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
  );
  CREATE TABLE ingest_cursor (
    site_id text PRIMARY KEY,
    cursor text NOT NULL,
    updated_at timestamptz NOT NULL
  );
  CREATE TABLE telemetry (
    time timestamptz NOT NULL,
    site_id text NOT NULL,
    entity_id text NOT NULL,
    entity_kind text NOT NULL,
    field text NOT NULL,
    value double precision,
    raw_value double precision,
    quality integer NOT NULL,
    is_delayed boolean NOT NULL,
    PRIMARY KEY (site_id, entity_id, field, time)
  );
  CREATE TABLE audit_log (
    id text PRIMARY KEY,
    site_id text NOT NULL,
    occurred_at timestamptz NOT NULL,
    event_type text NOT NULL,
    actor_id text,
    actor_email text,
    ip text,
    device text,
    resource text,
    action text,
    before jsonb,
    after jsonb,
    justification text,
    approver_id text,
    signature text NOT NULL,
    seq integer NOT NULL
  );
`;

function buildDb(): IMemoryDb {
  const db = newDb();
  // pg functions the store relies on that pg-mem does not ship.
  db.public.registerFunction({
    name: 'hashtext',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (s: string) => {
      let h = 0;
      for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
      return h;
    },
  });
  db.public.registerFunction({
    name: 'pg_advisory_xact_lock',
    args: [DataType.integer],
    returns: DataType.integer,
    implementation: () => 0,
  });
  db.public.none(DDL);
  return db;
}

function storeFor(db: IMemoryDb): PostgresStore {
  const pg = db.adapters.createPg();
  return new PostgresStore({
    connectionString: 'postgres://unused',
    auditKey: 'test-audit-key',
    pool: new pg.Pool() as unknown as Pool,
  });
}

const user: UserRecord = {
  id: 'u1',
  name: 'Engineer',
  email: 'Engineer@Example.com',
  passwordHash: 'hash',
  roles: { 'simsite-hospital': 'engineer' },
  siteIds: ['simsite-hospital'],
  createdAt: '2026-07-12T00:00:00Z',
  updatedAt: '2026-07-12T00:00:00Z',
};

describe('PostgresStore (pg-mem)', () => {
  let db: IMemoryDb;
  let store: PostgresStore;

  beforeEach(() => {
    db = buildDb();
    store = storeFor(db);
  });

  it('creates, finds (case-insensitively), lists, updates and deletes users', async () => {
    await store.createUser(user);

    const found = await store.findUserByEmail('engineer@example.com');
    expect(found?.id).toBe('u1');
    expect(found?.roles).toEqual({ 'simsite-hospital': 'engineer' });
    expect(await store.getUser('u1')).not.toBeNull();

    const all = await store.listUsers();
    expect(all.map((u) => u.id)).toEqual(['u1']);

    const updated = await store.updateUser('u1', { name: 'Lead Engineer' });
    expect(updated?.name).toBe('Lead Engineer');
    expect((await store.getUser('u1'))?.name).toBe('Lead Engineer');

    expect(await store.deleteUser('u1')).toBe(true);
    expect(await store.getUser('u1')).toBeNull();
    expect(await store.deleteUser('missing')).toBe(false);
  });

  it('upserts the ingest cursor on conflict', async () => {
    expect(await store.getIngestCursor('simsite-hospital')).toBeNull();
    await store.setIngestCursor('simsite-hospital', '5');
    await store.setIngestCursor('simsite-hospital', '9');
    expect(await store.getIngestCursor('simsite-hospital')).toBe('9');
  });

  it('bulk upserts telemetry across chunks while retaining quality values', async () => {
    const rows = Array.from({ length: 251 }, (_, index) => ({
      siteId: 'simsite-hospital', entityId: 'asset-1', entityKind: 'component' as const,
      field: 'KW', time: new Date(Date.UTC(2026, 6, 12, 0, index)).toISOString(),
      value: index === 250 ? null : index, rawValue: index === 250 ? 9999 : null,
      quality: index === 250 ? 1 : 0, isDelayed: false,
    }));
    expect(await store.upsertTelemetry(rows)).toBe(251);
    expect(await store.upsertTelemetry([{ ...rows[0], value: 777 }])).toBe(1);
    const stored = db.public.many('SELECT value, raw_value, quality FROM telemetry WHERE time = \'2026-07-12T04:10:00Z\'');
    expect(stored).toEqual([{ value: null, raw_value: 9999, quality: 1 }]);
    expect(db.public.one('SELECT value FROM telemetry WHERE time = \'2026-07-12T00:00:00Z\'').value).toBe(777);
    expect(db.public.one('SELECT count(*) AS n FROM telemetry').n).toBe(251);
  });

  it('runs transactions via withSiteLock and reuses a nested transaction', async () => {
    const result = await store.withSiteLock('simsite-hospital', async () => {
      await store.setIngestCursor('simsite-hospital', '1');
      const nested = await store.withSiteLock('simsite-hospital', async () =>
        store.getIngestCursor('simsite-hospital'),
      );
      return nested;
    });
    expect(result).toBe('1');
  });

  it('appends an audit chain and detects tampering', async () => {
    await store.appendAudit({
      siteId: 'simsite-hospital',
      eventType: 'auth.login',
      actorId: 'u1',
      actorEmail: 'engineer@example.com',
      ip: '10.0.0.1',
      device: 'vitest',
      resource: null,
      action: 'login',
      before: null,
      after: null,
      justification: null,
      approverId: null,
    });
    await store.appendAudit({
      siteId: 'simsite-hospital',
      eventType: 'setpoint.approved',
      actorId: 'u2',
      actorEmail: 'facility@example.com',
      ip: '10.0.0.2',
      device: 'vitest',
      resource: 'setpoint-request:r1',
      action: 'approve',
      before: { state: 'PENDING' },
      after: { state: 'APPROVED' },
      justification: 'load trim',
      approverId: 'u2',
    });

    const verified = await store.verifyAudit('simsite-hospital');
    expect(verified.valid).toBe(true);
    expect(verified.checkedCount).toBe(2);

    // Tamper with the first entry directly in SQL.
    db.public.none(`UPDATE audit_log SET justification='forged' WHERE seq=1`);

    const broken = await store.verifyAudit('simsite-hospital');
    expect(broken.valid).toBe(false);
    expect(broken.firstBrokenSeq).toBe(1);
  });
});
