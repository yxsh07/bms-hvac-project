import { parseCsvExport } from '../src/drivers/csv-parser.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(HERE, '..', '..', '..', 'data', 'raw');

async function test() {
  // Test with a small sample of the real data
  const file = join(RAW_DIR, 'components', '2026-07-12', 'components_2026-07-12_0000-0600_IST.csv');
  const text = await readFile(file, 'utf-8');

  // Just test first 100 lines to keep it fast
  const lines = text.split('\n').slice(0, 100).join('\n');

  console.log('Testing pivoted format parsing...');
  const result = parseCsvExport(lines);

  console.log('Blocks:', result.blocks.length);
  console.log('Is pivoted:', result.blocks[0]?.isPivoted);
  console.log('Row count:', result.rowCount);
  console.log('Line count:', result.lineCount);
  console.log('Ragged rows:', result.raggedRows);
  console.log('Invalid rows:', result.invalidRows);

  if (result.rows.length > 0) {
    console.log('\nFirst 5 rows:');
    for (const row of result.rows.slice(0, 5)) {
      console.log(`  ${row.time} | ${row.entityId} | ${row.field} | ${row.value} | delayed=${row.isDelayed} | measurement=${row.measurement}`);
    }
  }

  // Check specific fields
  const kwRows = result.rows.filter(r => r.field === 'kw');
  console.log(`\nkw rows: ${kwRows.length}`);
  if (kwRows.length > 0) {
    console.log('Sample kw:', kwRows[0]);
  }

  const actuatorRows = result.rows.filter(r => r.field === 'actuator');
  console.log(`actuator rows: ${actuatorRows.length}`);
}

test().catch(console.error);
