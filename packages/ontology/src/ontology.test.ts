/**
 * Unit tests for the ontology package.
 *
 * Tests are self-contained: the JSON fixture is defined inline so no file I/O
 * is needed for the helper tests. The JsonOntologyDriver is tested separately
 * using a real file written to a temp path via the OS's tmp directory, using
 * Node.js built-ins.
 */

import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import {
  JsonOntologyDriver,
  findAsset,
  findPoint,
  getAssetsByType,
  getAssetsByZone,
  getWritablePoints,
  getControllerBlastRadius,
} from './index.js';
import type { Ontology } from './index.js';

// ── Inline fixture ─────────────────────────────────────────────────────────────

/**
 * Minimal ontology fixture used by helper tests.
 * Matches the JSON schema expected by JsonOntologyDriver.
 */
const FIXTURE_ONTOLOGY: Ontology = {
  site: { id: 'test-site', name: 'Test Site', timezone: 'UTC' },
  floors: [
    { id: 'floor-g', name: 'Ground', level: 0 },
    { id: 'floor-1', name: 'First',  level: 1 },
  ],
  zones: [
    { id: 'zone-plant', name: 'Plant Room' },
    { id: 'zone-ward',  name: 'Ward' },
  ],
  assets: [
    { id: 'chiller-a', name: 'Chiller A', type: 'chiller', criticality: 'critical' },
    { id: 'chiller-b', name: 'Chiller B', type: 'chiller', criticality: 'high' },
    { id: 'fcu-a',     name: 'FCU A',     type: 'fcu',     criticality: 'medium' },
  ],
  points: {
    'chiller-a': [
      { abbr: 'CHWST',  display: 'CHW Supply',    unit: '°C', group: 'temps',    cls: 'chilled-water-supply-temp', source: 'modbus', writable: false, safeMin: 4, safeMax: 14 },
      { abbr: 'KW',     display: 'Power',         unit: 'kW', group: 'energy',   cls: 'power',                     source: 'modbus', writable: false },
      { abbr: 'CHWSSP', display: 'CHW SP',        unit: '°C', group: 'setpoints',cls: 'setpoint-chw-temp',         source: 'modbus', writable: true,  safeMin: 4, safeMax: 12 },
    ],
    'chiller-b': [
      { abbr: 'CHWST', display: 'CHW Supply', unit: '°C', group: 'temps', cls: 'chilled-water-supply-temp', source: 'modbus', writable: false },
    ],
    'fcu-a': [
      { abbr: 'RAT',   display: 'Room Temp',    unit: '°C', group: 'temps',   cls: 'area-temp',      source: 'bacnet', writable: false },
      { abbr: 'RATSP', display: 'Temp Setpt',   unit: '°C', group: 'setpoints',cls: 'setpoint-area-temp','source':'bacnet',writable: true },
    ],
  },
  assetZone: {
    'chiller-a': 'zone-plant',
    'chiller-b': 'zone-plant',
    'fcu-a':     'zone-ward',
  },
  assetFloor: {
    // chiller-a has a floor; fcu-a and chiller-b do not (DEC-9 scenario)
    'chiller-a': 'floor-g',
  },
  controllers: [
    { id: 'ctrl-1', name: 'Plant Controller', deviceId: 'dev-001' },
    { id: 'ctrl-2', name: 'Air Controller',   deviceId: 'dev-002' },
  ],
  controllerAssets: {
    'ctrl-1': ['chiller-a', 'chiller-b'],
    'ctrl-2': ['fcu-a'],
  },
  meters: [],
};

// ── Helper tests ───────────────────────────────────────────────────────────────

describe('findAsset', () => {
  it('returns the asset when found', () => {
    const a = findAsset(FIXTURE_ONTOLOGY, 'chiller-a');
    expect(a).toBeDefined();
    expect(a?.name).toBe('Chiller A');
    expect(a?.criticality).toBe('critical');
  });

  it('returns undefined for an unknown id', () => {
    expect(findAsset(FIXTURE_ONTOLOGY, 'not-an-asset')).toBeUndefined();
  });
});

describe('findPoint', () => {
  it('returns the correct point', () => {
    const p = findPoint(FIXTURE_ONTOLOGY, 'chiller-a', 'CHWST');
    expect(p).toBeDefined();
    expect(p?.unit).toBe('°C');
    expect(p?.writable).toBe(false);
    expect(p?.safeMin).toBe(4);
  });

  it('returns undefined for an unknown point abbreviation', () => {
    expect(findPoint(FIXTURE_ONTOLOGY, 'chiller-a', 'NONEXISTENT')).toBeUndefined();
  });

  it('returns undefined for an unknown asset', () => {
    expect(findPoint(FIXTURE_ONTOLOGY, 'ghost', 'CHWST')).toBeUndefined();
  });
});

describe('getAssetsByType', () => {
  it('returns all chillers', () => {
    const chillers = getAssetsByType(FIXTURE_ONTOLOGY, 'chiller');
    expect(chillers).toHaveLength(2);
    expect(chillers.map((c) => c.id)).toContain('chiller-a');
    expect(chillers.map((c) => c.id)).toContain('chiller-b');
  });

  it('returns empty array for an unknown type', () => {
    expect(getAssetsByType(FIXTURE_ONTOLOGY, 'boiler')).toHaveLength(0);
  });
});

describe('getAssetsByZone', () => {
  it('returns assets in the plant zone', () => {
    const assets = getAssetsByZone(FIXTURE_ONTOLOGY, 'zone-plant');
    expect(assets).toHaveLength(2);
  });

  it('returns assets in the ward zone', () => {
    const assets = getAssetsByZone(FIXTURE_ONTOLOGY, 'zone-ward');
    expect(assets).toHaveLength(1);
    expect(assets[0].id).toBe('fcu-a');
  });

  it('returns empty array for unknown zone', () => {
    expect(getAssetsByZone(FIXTURE_ONTOLOGY, 'zone-ghost')).toHaveLength(0);
  });
});

describe('getWritablePoints', () => {
  it('returns only writable points for chiller-a', () => {
    const pts = getWritablePoints(FIXTURE_ONTOLOGY, 'chiller-a');
    expect(pts).toHaveLength(1);
    expect(pts[0].abbr).toBe('CHWSSP');
  });

  it('returns writable points for fcu-a', () => {
    const pts = getWritablePoints(FIXTURE_ONTOLOGY, 'fcu-a');
    expect(pts).toHaveLength(1);
    expect(pts[0].abbr).toBe('RATSP');
  });

  it('returns empty array for an asset with no points', () => {
    expect(getWritablePoints(FIXTURE_ONTOLOGY, 'ghost-asset')).toHaveLength(0);
  });

  it('returns empty array when no points are writable', () => {
    const pts = getWritablePoints(FIXTURE_ONTOLOGY, 'chiller-b');
    expect(pts).toHaveLength(0);
  });
});

describe('getControllerBlastRadius', () => {
  it('returns the correct assets for ctrl-1', () => {
    const assets = getControllerBlastRadius(FIXTURE_ONTOLOGY, 'ctrl-1');
    expect(assets).toHaveLength(2);
    const ids = assets.map((a) => a.id);
    expect(ids).toContain('chiller-a');
    expect(ids).toContain('chiller-b');
  });

  it('returns a single-asset blast radius for ctrl-2', () => {
    const assets = getControllerBlastRadius(FIXTURE_ONTOLOGY, 'ctrl-2');
    expect(assets).toHaveLength(1);
    expect(assets[0].id).toBe('fcu-a');
  });

  it('returns empty array for an unknown controller', () => {
    expect(getControllerBlastRadius(FIXTURE_ONTOLOGY, 'ctrl-ghost')).toHaveLength(0);
  });
});

// ── JsonOntologyDriver tests ───────────────────────────────────────────────────

const DRIVER_FIXTURE_JSON = {
  site: { id: 'driver-test-site', name: 'Driver Test Site', timezone: 'UTC' },
  floors: [{ id: 'floor-g', name: 'Ground', level: 0 }],
  zones: [{ id: 'zone-x', name: 'Zone X' }],
  assets: [
    {
      id: 'asset-alpha',
      name: 'Alpha Asset',
      type: 'chiller',
      criticality: 'critical',
      zoneId: 'zone-x',
      // no floorId — DEC-9 scenario
      points: [
        { abbr: 'CHWST', display: 'CHW Supply', unit: '°C', group: 'temps', cls: 'chw-supply', source: 'modbus', writable: false, safeMin: 4, safeMax: 14 },
        { abbr: 'SETPT', display: 'Setpoint',   unit: '°C', group: 'setpoints', cls: 'setpoint', source: 'modbus', writable: true, safeMin: 4, safeMax: 12 },
      ],
    },
  ],
  controllers: [
    { id: 'ctrl-x', name: 'Controller X', deviceId: 'dev-x-001', assetIds: ['asset-alpha'] },
  ],
  meters: [{ deviceId: 'meter-001', name: 'Main Meter', model: 'generic-v1' }],
};

let tmpFilePath: string;

describe('JsonOntologyDriver', () => {
  afterAll(async () => {
    if (tmpFilePath) {
      await unlink(tmpFilePath).catch(() => {/* best-effort cleanup */});
    }
  });

  it('loads and assembles a valid ontology file', async () => {
    tmpFilePath = join(tmpdir(), `ontology-driver-test-${Date.now()}.json`);
    await writeFile(tmpFilePath, JSON.stringify(DRIVER_FIXTURE_JSON), 'utf-8');

    const driver = new JsonOntologyDriver(tmpFilePath);
    const ont = await driver.load('driver-test-site');

    expect(ont.site.id).toBe('driver-test-site');
    expect(ont.site.timezone).toBe('UTC');
    expect(ont.floors).toHaveLength(1);
    expect(ont.zones).toHaveLength(1);
    expect(ont.assets).toHaveLength(1);

    const asset = findAsset(ont, 'asset-alpha');
    expect(asset).toBeDefined();
    expect(asset?.type).toBe('chiller');
    expect(asset?.criticality).toBe('critical');
  });

  it('assembles points correctly', async () => {
    const driver = new JsonOntologyDriver(tmpFilePath);
    const ont = await driver.load('driver-test-site');

    const pts = ont.points['asset-alpha'];
    expect(pts).toHaveLength(2);
    const writable = getWritablePoints(ont, 'asset-alpha');
    expect(writable).toHaveLength(1);
    expect(writable[0].abbr).toBe('SETPT');
  });

  it('omits assetFloor when floorId is absent (DEC-9)', async () => {
    const driver = new JsonOntologyDriver(tmpFilePath);
    const ont = await driver.load('driver-test-site');
    // asset-alpha has no floorId in the fixture
    expect(ont.assetFloor['asset-alpha']).toBeUndefined();
  });

  it('resolves blast radius via controllerAssets', async () => {
    const driver = new JsonOntologyDriver(tmpFilePath);
    const ont = await driver.load('driver-test-site');
    const blast = getControllerBlastRadius(ont, 'ctrl-x');
    expect(blast).toHaveLength(1);
    expect(blast[0].id).toBe('asset-alpha');
  });

  it('loads meters', async () => {
    const driver = new JsonOntologyDriver(tmpFilePath);
    const ont = await driver.load('driver-test-site');
    expect(ont.meters).toHaveLength(1);
    expect(ont.meters[0].deviceId).toBe('meter-001');
  });

  it('throws on site ID mismatch', async () => {
    const driver = new JsonOntologyDriver(tmpFilePath);
    await expect(driver.load('wrong-site-id')).rejects.toThrow(/site ID mismatch/);
  });

  it('throws on malformed JSON', async () => {
    const badPath = join(tmpdir(), `ontology-bad-${Date.now()}.json`);
    await writeFile(badPath, '{ this is not valid json }', 'utf-8');
    const driver = new JsonOntologyDriver(badPath);
    await expect(driver.load('any')).rejects.toThrow(/invalid JSON/);
    await unlink(badPath).catch(() => {});
  });

  it('throws on schema validation failure (missing required field)', async () => {
    const invalidJson = { site: { id: 'x' } }; // missing name, timezone, etc.
    const badPath = join(tmpdir(), `ontology-invalid-${Date.now()}.json`);
    await writeFile(badPath, JSON.stringify(invalidJson), 'utf-8');
    const driver = new JsonOntologyDriver(badPath);
    await expect(driver.load('x')).rejects.toThrow(/schema validation failed/);
    await unlink(badPath).catch(() => {});
  });
});
