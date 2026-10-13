import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generate } from './gen_twin_layout.js';

async function main(): Promise<void> {
const root = resolve(process.cwd(), '../..');
const ontology = JSON.parse(await readFile(resolve(root, 'data/seed/ontology.json'), 'utf8')) as {
  site: { id: string };
  floors: Array<{ id: string; name: string; level: number }>;
  assets: Array<{ id: string; type: string; floorId?: string; zoneId?: string }>;
};

const result = await generate({
  siteId: ontology.site.id,
  floors: ontology.floors.map((floor) => ({
    id: floor.id,
    name: floor.name,
    elevation: floor.level,
  })),
  assets: ontology.assets.map((asset) => ({
    id: asset.id,
    type: asset.type,
    floorId: asset.floorId,
    zoneId: asset.zoneId,
    classifications: [],
  })),
});

if (!result.ok) throw new Error(result.error);
await writeFile(
  resolve(root, 'data/seed/twin-layout.json'),
  `${JSON.stringify(result.layout, null, 2)}\n`,
);
console.log(`Wrote layout with ${result.layout.floors.length} floors and ${Object.keys(result.layout.anchors).length} anchors`);
}

void main();
