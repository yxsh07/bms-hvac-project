/**
 * T-012 — multi-block annotated CSV parser and manifest reconciliation.
 */

import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseCsvExport,
  reconcileManifest,
  splitCsvLine,
  toSiteIso,
  type Manifest,
} from '../src/drivers/csv-parser.js';
import { CsvSource } from '../src/drivers/source.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'export');

describe('parseCsvExport', () => {
  it('parses blocks, annotations and named headers', async () => {
    const result = parseCsvExport(await readFile(join(FIX, 'day1.csv'), 'utf-8'));
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].file).toBe('day1.csv');
    expect(result.rowCount).toBe(4);
    expect(result.lineCount).toBe(5);
    expect(result.raggedRows).toBe(0);
  });

  it('marks rows delayed via the is_delayed_data field at the same entity/time', async () => {
    const result = parseCsvExport(await readFile(join(FIX, 'day1.csv'), 'utf-8'));
    const run = result.rows.find((r) => r.field === 'RUN');
    const chwst = result.rows.find((r) => r.field === 'CHWST' && r.time.endsWith('00:05:00.000Z'));
    expect(run?.isDelayed).toBe(true);
    // A row at a different timestamp is not delayed.
    expect(chwst).toBeUndefined();
    expect(result.rows.find((r) => r.field === 'CHWST')?.isDelayed).toBe(false);
  });

  it('skips ragged rows but counts them', async () => {
    const result = parseCsvExport(await readFile(join(FIX, 'day2.csv'), 'utf-8'));
    expect(result.rowCount).toBe(1);
    expect(result.raggedRows).toBe(1);
    expect(result.lineCount).toBe(3);
  });

  it('counts rows with an unparseable time or value', () => {
    const bad = [
      '# annotation',
      'time,entity,field,value',
      'not-a-date,chiller-01,CHWST,7.9',
      '2026-07-12T00:00:00Z,chiller-01,CHWST,7.9',
    ].join('\n');
    const result = parseCsvExport(bad);
    expect(result.invalidRows).toBe(1);
    expect(result.rowCount).toBe(1);
  });

  it('splits quoted CSV fields', () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    expect(splitCsvLine('"he said ""hi""",x')).toEqual(['he said "hi"', 'x']);
  });
});

describe('reconcileManifest (gate G1)', () => {
  it('passes when parsed counts match the manifest', async () => {
    const manifest = JSON.parse(await readFile(join(FIX, 'manifest.json'), 'utf-8')) as Manifest;
    const parsed = [
      { name: 'day1.csv', result: parseCsvExport(await readFile(join(FIX, 'day1.csv'), 'utf-8')) },
      { name: 'day2.csv', result: parseCsvExport(await readFile(join(FIX, 'day2.csv'), 'utf-8')) },
    ];
    const recon = reconcileManifest(parsed, manifest);
    expect(recon).toMatchObject({ ok: true, mismatches: [], unexpected: [], missing: [] });
  });

  it('fails loudly on a count mismatch', async () => {
    const parsed = [
      { name: 'day1.csv', result: parseCsvExport(await readFile(join(FIX, 'day1.csv'), 'utf-8')) },
    ];
    const manifest: Manifest = { files: [{ name: 'day1.csv', rows: 999 }] };
    const recon = reconcileManifest(parsed, manifest);
    expect(recon.ok).toBe(false);
    expect(recon.mismatches[0]).toMatchObject({ name: 'day1.csv', field: 'rows', expected: 999, actual: 4 });
  });
});

describe('CsvSource', () => {
  it('pages a directory of CSVs and carries the delayed flag', async () => {
    const source = new CsvSource({ path: FIX, manifestPath: join(FIX, 'manifest.json') });
    const first = await source.next(null, 3);
    expect(first.rows).toHaveLength(3);
    expect(first.cursor).toMatch(/^csv:/);
    const rest = await source.next(first.cursor, 100);
    expect(first.rows.length + rest.rows.length).toBe(5);
    const all = [...first.rows, ...rest.rows];
    expect(all.some((r) => r.isDelayed)).toBe(true);
  });

  it('throws when the manifest does not reconcile', async () => {
    const badManifest = join(FIX, 'manifest.json');
    const source = new CsvSource({ path: join(FIX, 'day1.csv'), manifestPath: badManifest });
    // manifest expects day1.csv lines=5 rows=4 and day2.csv, so a single file fails.
    await expect(source.next(null, 10)).rejects.toThrow(/manifest reconciliation failed/);
  });
});

describe('toSiteIso (API edge, PLAN 7.1)', () => {
  it('renders UTC as the site offset', () => {
    expect(toSiteIso('2026-07-12T00:00:00Z', 'Asia/Kolkata')).toBe('2026-07-12T05:30:00+05:30');
  });
});
