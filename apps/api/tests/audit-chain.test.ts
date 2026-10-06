import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../src/audit/chain.js';
import { MemoryStore } from '../src/store/memory.js';

async function seed(store: MemoryStore, count = 3): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const entry = await store.appendAudit({
      siteId: 's',
      eventType: i === 0 ? 'auth.login' : 'setpoint.proposed',
      actorId: `u${i}`,
      actorEmail: `u${i}@example.com`,
      ip: '10.0.0.1',
      device: 'vitest',
      resource: `r${i}`,
      action: `a${i}`,
      justification: `justification ${i}`,
      approverId: i === 0 ? null : 'approver-1',
      before: { b: i },
      after: { a: i },
    });
    ids.push(entry.id);
  }
  return ids;
}

describe('canonical JSON', () => {
  it('sorts keys recursively', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('is stable regardless of key order', () => {
    expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
  });
});

describe('audit hash chain', () => {
  it('appends with increasing seq and verifies', async () => {
    const store = new MemoryStore({ auditKey: 'k' });
    const ids = await seed(store);
    const page = await store.listAudit('s', {});
    expect(page.items.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(new Set(ids).size).toBe(3);

    const result = await store.verifyAudit('s');
    expect(result.valid).toBe(true);
    expect(result.checkedCount).toBe(3);
    expect(result.firstBrokenId).toBeNull();
  });

  it('detects tampering and reports the first broken row', async () => {
    const store = new MemoryStore({ auditKey: 'k' });
    const ids = await seed(store);
    // Tamper with a signed field on the *second* row.
    store.tamperAudit('s', ids[1], { justification: 'edited after the fact' });

    const result = await store.verifyAudit('s');
    expect(result.valid).toBe(false);
    expect(result.firstBrokenId).toBe(ids[1]);
    expect(result.firstBrokenSeq).toBe(2);
    expect(result.checkedCount).toBe(2);
  });

  it('detects tampering with the approver id (correction #1)', async () => {
    const store = new MemoryStore({ auditKey: 'k' });
    const ids = await seed(store);
    store.tamperAudit('s', ids[2], { approverId: 'someone-else' });
    const result = await store.verifyAudit('s');
    expect(result.firstBrokenId).toBe(ids[2]);
  });

  it('serialises concurrent writers per site', async () => {
    const store = new MemoryStore({ auditKey: 'k' });
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        store.appendAudit({ siteId: 's', eventType: 'setpoint.proposed', actorId: `u${i}` }),
      ),
    );
    const page = await store.listAudit('s', { limit: 200 });
    const seqs = page.items.map((e) => e.seq).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect((await store.verifyAudit('s')).valid).toBe(true);
  });

  it('keeps chains separate per site', async () => {
    const store = new MemoryStore({ auditKey: 'k' });
    await store.appendAudit({ siteId: 'a', eventType: 'auth.login' });
    await store.appendAudit({ siteId: 'b', eventType: 'auth.login' });
    const a = await store.listAudit('a', {});
    const b = await store.listAudit('b', {});
    expect(a.items[0].seq).toBe(1);
    expect(b.items[0].seq).toBe(1);
    expect((await store.verifyAudit('a')).valid).toBe(true);
    expect((await store.verifyAudit('b')).valid).toBe(true);
  });
});
