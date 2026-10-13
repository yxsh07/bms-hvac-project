/**
 * Multi-block annotated CSV parser (T-012, PLAN §6.2 / C1).
 *
 * The client export is a directory of CSV files whose content is a sequence of
 * *blocks*:
 *
 *   - a blank line ends a block;
 *   - lines beginning with `#` are annotations (they belong to the next block,
 *     and a `# file: <name>` annotation also names it);
 *   - the first non-annotation line of a block is the header;
 *   - the remaining lines are data rows;
 *   - a ragged row (column count ≠ header count) is skipped and counted, never
 *     silently dropped.
 *
 * Supports two CSV formats:
 * 1. **Long format** (test fixtures): one row per entity/field/time
 *    Columns: time | entity | field | value | is_delayed_data (optional)
 *
 * 2. **Pivoted format** (client export): one row per entity/time, fields as columns
 *    Columns: _time, _measurement, componentId/deviceId, siteId, field1, field2, ...
 *    Each field column becomes a separate row in the output.
 *
 * `is_delayed_data` is a *field* in the export (value 1.0). Rows carrying it
 * mark every row for the same `(entity, time)` as delayed, and are themselves
 * delayed — mirroring how §6.2 maps the field onto the `is_delayed` column.
 *
 * Times are normalised to UTC ISO-8601. `toSiteIso` converts to the site
 * timezone for the API edge (the app never does timezone maths).
 */

export interface RawCsvRow {
  time: string; // UTC ISO-8601
  entityId: string;
  field: string;
  value: number | null;
  isDelayed: boolean;
  measurement?: string;
}

export interface PivotedParseOptions {
  /** Known metadata columns that should NOT be melted into field rows. */
  metadataColumns?: string[];
  /** Fallback measurement when not present in the row. */
  defaultMeasurement?: string;
}

export interface CsvBlock {
  /** Annotation lines (without the leading `#`), in order. */
  annotations: string[];
  header: string[];
  /** Parsed data rows. */
  rows: RawCsvRow[];
  /** `# file: <name>` value when present. */
  file: string | null;
  /** True when the block is in pivoted (wide) format. */
  isPivoted?: boolean;
}

export interface CsvParseResult {
  blocks: CsvBlock[];
  rows: RawCsvRow[];
  /** Non-blank, non-annotation lines (header + data), for manifest reconciliation. */
  lineCount: number;
  /** Parsed data rows. */
  rowCount: number;
  /** Rows whose column count did not match the header. */
  raggedRows: number;
  /** Rows with an unparseable time or value. */
  invalidRows: number;
}

export interface CsvParseOptions {
  /** Fallback measurement when a row has no measurement column (informational). */
  defaultMeasurement?: string;
}

const HEADER_ALIASES: Record<Exclude<keyof ColumnMap, 'measurement'>, string[]> = {
  time: ['time', 'timestamp', 'datetime', 'date'],
  entity: ['entity', 'entityid', 'component', 'componentid', 'id', 'asset'],
  field: ['field', 'parameter', 'point', 'tag'],
  value: ['value', 'val', 'reading'],
  delayed: ['isdelayeddata', 'isdelayed', 'delayed'],
};

interface ColumnMap {
  time: number;
  entity: number;
  field: number;
  value: number;
  delayed: number;
  measurement?: number;
}

function normaliseHeaderCell(cell: string): string {
  return cell.trim().toLowerCase().replace(/[_\-\s]/g, '');
}

function resolveColumns(header: string[]): ColumnMap | null {
  const norm = header.map(normaliseHeaderCell);
  const map: Partial<ColumnMap> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [keyof ColumnMap, string[]][]) {
    const idx = norm.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[key] = idx;
  }
  if (map.time === undefined || map.entity === undefined || map.field === undefined || map.value === undefined) {
    return null;
  }
  return {
    time: map.time,
    entity: map.entity,
    field: map.field,
    value: map.value,
    delayed: map.delayed ?? -1,
  };
}

/** Split a single CSV line, honouring double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else if (ch === '"') {
      inQuotes = true;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Known metadata column names (normalised) that should not be melted as fields. */
const METADATA_COLUMNS = new Set([
  'time', 'timestamp', '_time',
  'measurement', '_measurement',
  'entity', 'entityid', 'component', 'componentid', 'deviceid', 'device_id', 'id',
  'site', 'siteid', 'site_id',
  'result', 'table',
  'result', 'table',
  '', // empty column (common in InfluxDB exports)
]);

/** Detect if a CSV header is in pivoted format (many field columns, few metadata columns). */
function isPivotedFormat(header: string[]): boolean {
  let fieldCount = 0;
  for (const h of header) {
    const norm = normaliseHeaderCell(h);
    if (!METADATA_COLUMNS.has(norm)) fieldCount++;
  }
  // If more than 4 non-metadata columns, it's likely pivoted
  return fieldCount > 4;
}

/** Melt a pivoted row into multiple RawCsvRow entries (one per field column). */
function meltPivotedRow(
  cells: string[],
  header: string[],
  cols: ColumnMap,
): RawCsvRow[] {
  const out: RawCsvRow[] = [];
  const t = Date.parse(cells[cols.time].trim());
  if (Number.isNaN(t)) return out;
  const time = new Date(t).toISOString();
  const entity = cells[cols.entity].trim();
  if (!entity) return out;

  const measurement = (cols.measurement !== undefined && cols.measurement >= 0) ? cells[cols.measurement].trim() : undefined;

  // For each non-metadata column, create a row
  for (let i = 0; i < header.length; i++) {
    const colName = header[i];
    const normName = normaliseHeaderCell(colName);
    if (METADATA_COLUMNS.has(normName)) continue;

    const valueStr = cells[i]?.trim();
    if (valueStr === '' || valueStr === undefined) continue;

    const numeric = Number(valueStr);
    const isDelayed = isDelayField(colName) && numeric === 1;

    out.push({
      time: new Date(t).toISOString(),
      entityId: entity,
      field: colName,
      value: Number.isNaN(numeric) ? null : numeric,
      isDelayed,
      measurement,
    });
  }
  return out;
}

/** Resolve only metadata columns for pivoted format (time, entity, measurement). */
function resolvePivotedColumns(header: string[]): ColumnMap | null {
  const norm = header.map(normaliseHeaderCell);
  const map: Partial<ColumnMap> = {};

  // Time column
  for (const alias of HEADER_ALIASES.time) {
    const idx = norm.findIndex((h) => h === alias);
    if (idx >= 0) { map.time = idx; break; }
  }
  // Entity column
  for (const alias of HEADER_ALIASES.entity) {
    const idx = norm.findIndex((h) => h === alias);
    if (idx >= 0) { map.entity = idx; break; }
  }
  // Measurement column (optional)
  for (const alias of ['measurement', '_measurement']) {
    const idx = norm.findIndex((h) => h === alias);
    if (idx >= 0) { map.measurement = idx; break; }
  }
  // Field and value not needed for pivoted format - we melt all other columns
  // But we need placeholder values for the ColumnMap type
  map.field = -1;
  map.value = -1;

  if (map.time === undefined || map.entity === undefined) {
    return null;
  }
  return {
    time: map.time,
    entity: map.entity,
    field: map.field,
    value: map.value,
    delayed: -1,
    measurement: map.measurement,
  };
}

function isDelayedTrue(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === '1.0' || v === 'true' || v === 'yes';
}

/** True when a field name denotes the delayed-marker field (punctuation-insensitive). */
function isDelayField(field: string): boolean {
  return field.toLowerCase().replace(/[_\-\s]/g, '') === 'isdelayeddata';
}

/**
 * Parse a full CSV export (one or more blocks) into rows.
 * Never throws on bad data: it counts and skips.
 */
export function parseCsvExport(text: string, _opts: CsvParseOptions = {}): CsvParseResult {
  const lines = text.split(/\r?\n/);
  const blocks: CsvBlock[] = [];
  let pendingAnnotations: string[] = [];
  let current: CsvBlock | null = null;

  let lineCount = 0;
  let raggedRows = 0;
  let invalidRows = 0;

  const closeBlock = () => {
    if (current && current.header.length > 0) blocks.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === '') {
      closeBlock();
      continue;
    }
    if (line.trimStart().startsWith('#')) {
      const note = line.trimStart().replace(/^#\s?/, '');
      if (!current) {
        current = { annotations: pendingAnnotations, header: [], rows: [], file: null };
        pendingAnnotations = [];
      }
      current.annotations.push(note);
      const fileMatch = /^file:\s*(.+)$/i.exec(note);
      if (fileMatch) current.file = fileMatch[1].trim();
      continue;
    }

    if (!current) {
      current = { annotations: pendingAnnotations, header: [], rows: [], file: null };
      pendingAnnotations = [];
    }

    const cells = splitCsvLine(line);
    if (current.header.length === 0) {
      current.header = cells.map((c) => c.trim());
      // Detect pivoted format on first header row
      current.isPivoted = isPivotedFormat(current.header);
      lineCount++;
      continue;
    }

    lineCount++;
    if (cells.length !== current.header.length) {
      raggedRows++;
      continue;
    }

    // For pivoted format, we only need metadata columns; skip full resolution
    if (current.isPivoted) {
      const cols = resolvePivotedColumns(current.header);
      if (!cols) {
        invalidRows++;
        continue;
      }
      const melted = meltPivotedRow(cells, current.header, cols);
      for (const row of melted) {
        current.rows.push(row);
      }
      continue;
    }

    const cols = resolveColumns(current.header);
    if (!cols) {
      invalidRows++;
      continue;
    }
    const t = Date.parse(cells[cols.time].trim());
    if (Number.isNaN(t)) {
      invalidRows++;
      continue;
    }
    const numeric = Number(cells[cols.value]);
    const entity = cells[cols.entity].trim();
    const field = cells[cols.field].trim();
    if (entity === '' || field === '') {
      invalidRows++;
      continue;
    }

    // `is_delayed_data` is a field (value 1.0) in the export, not a column.
    // Also honour an explicit delayed column when a source provides one.
    const delayByColumn = cols.delayed >= 0 && isDelayedTrue(cells[cols.delayed]);
    const delayByField = isDelayField(field) && numeric === 1;

    current.rows.push({
      time: new Date(t).toISOString(),
      entityId: entity,
      field,
      value: Number.isNaN(numeric) ? null : numeric,
      isDelayed: delayByColumn || delayByField,
    });
  }
  closeBlock();
  if (pendingAnnotations.length > 0 && !current) {
    // Trailing annotations with no block; keep them on a synthetic empty block.
    blocks.push({ annotations: pendingAnnotations, header: [], rows: [], file: null });
  }

  // Pass 2: propagate delay markers to every row at the same (entity, time).
  const delayedKeys = new Set<string>();
  for (const b of blocks) {
    for (const r of b.rows) {
      if (r.isDelayed && isDelayField(r.field)) {
        delayedKeys.add(`${r.entityId}|${r.time}`);
      }
    }
  }
  const allRows: RawCsvRow[] = [];
  for (const b of blocks) {
    for (const r of b.rows) {
      if (!isDelayField(r.field) && delayedKeys.has(`${r.entityId}|${r.time}`)) {
        r.isDelayed = true;
      }
      allRows.push(r);
    }
  }

  return {
    blocks,
    rows: allRows,
    lineCount,
    rowCount: allRows.length,
    raggedRows,
    invalidRows,
  };
}

// ── Manifest reconciliation (C1 / gate G1) ───────────────────────────────────

export interface ManifestEntry {
  /** File name as it appears in the export. */
  name: string;
  /** Expected non-blank, non-annotation line count (header + data). */
  lines?: number;
  /** Expected parsed data-row count. */
  rows?: number;
}

export interface Manifest {
  files: ManifestEntry[];
}

export interface FileParse {
  name: string;
  result: CsvParseResult;
}

export interface ReconcileMismatch {
  name: string;
  field: 'lines' | 'rows' | 'missing';
  expected: number;
  actual: number;
}

export interface ReconcileResult {
  ok: boolean;
  mismatches: ReconcileMismatch[];
  /** Files present in the export but absent from the manifest. */
  unexpected: string[];
  /** Manifest entries with no parsed file. */
  missing: string[];
}

/** Compare parsed counts against `manifest.json`. A mismatch is a hard failure. */
export function reconcileManifest(parsed: FileParse[], manifest: Manifest): ReconcileResult {
  const byName = new Map(parsed.map((p) => [p.name, p.result]));
  const expectedNames = new Set(manifest.files.map((f) => f.name));
  const mismatches: ReconcileMismatch[] = [];
  const missing: string[] = [];

  for (const entry of manifest.files) {
    const result = byName.get(entry.name);
    if (!result) {
      missing.push(entry.name);
      mismatches.push({ name: entry.name, field: 'missing', expected: 1, actual: 0 });
      continue;
    }
    if (entry.lines !== undefined && result.lineCount !== entry.lines) {
      mismatches.push({ name: entry.name, field: 'lines', expected: entry.lines, actual: result.lineCount });
    }
    if (entry.rows !== undefined && result.rowCount !== entry.rows) {
      mismatches.push({ name: entry.name, field: 'rows', expected: entry.rows, actual: result.rowCount });
    }
  }

  const unexpected = parsed.filter((p) => !expectedNames.has(p.name)).map((p) => p.name);
  return { ok: mismatches.length === 0 && unexpected.length === 0, mismatches, unexpected, missing };
}

// ── Timezone edge (PLAN §7.1) ────────────────────────────────────────────────

/**
 * Render a UTC instant as ISO-8601 with the site's offset, e.g.
 * `2026-07-12T05:30:00+05:30` for Asia/Kolkata. Uses Intl so the offset (and
 * DST, where applicable) is correct for the instant.
 */
export function toSiteIso(utcIso: string, timeZone: string): string {
  const date = new Date(utcIso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  // longOffset yields e.g. "GMT+05:30"; normalise to "+05:30".
  const offsetRaw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const offset = offsetRaw.replace('GMT', '') || '+00:00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${offset}`;
}
