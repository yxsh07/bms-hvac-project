/**
 * Real-database integration test (opt-in).
 *
 * Skipped unless TEST_DATABASE_URL is set, because CI has no Postgres service
 * in the default job. To run locally:
 *
 *   docker compose -f infra/docker-compose.yml up -d timescale
 *   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/app_store \
 *     pnpm -C apps/api test
 *
 * The migrations must have been applied (compose does this on first boot, or
 * run apps/api/src/migrations/00*.sql by hand).
 */

import { describe, expect, it } from 'vitest';
import { PostgresStore } from '../src/store/postgres.js';

const dsn = process.env.TEST_DATABASE_URL;

describe.skipIf(!dsn)('PostgresStore against a live database', () => {
  it('creates a user, writes an audit entry and verifies the chain', async () => {
    const { Pool } = (await import('pg')) as unknown as {
      Pool: new (cfg: unknown) => { end(): Promise<void> };
    };
    const pool = new Pool({ connectionString: dsn, max: 2 });
    const store = new PostgresStore({
      connectionString: dsn!,
      auditKey: 'itest-key',
      pool: pool as never,
    });
    try {
      const id = `itest-${Date.now()}`;
      await store.createUser({
        id,
        name: 'Integration',
        email: `${id}@example.com`,
        passwordHash: 'x',
        roles: {},
        siteIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect((await store.getUser(id))?.id).toBe(id);
      await store.deleteUser(id);

      const before = await store.verifyAudit('simsite-hospital');
      expect(before.valid).toBe(true);
    } finally {
      await pool.end();
    }
  });
});
