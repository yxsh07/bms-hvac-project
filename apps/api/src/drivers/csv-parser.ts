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
 * Header columns are matched by name (case-insensitive, `_`/`-` insensitive):
 *   time | timestamp
 *   entity | entity_id | component | id
 *   field | parameter | point
 *   value | val
 *   is_delayed_data | is_delayed | delayed
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
}

export interface CsvBlock {
  /** Annotation lines (without the leading `#`), in order. */
  annotations: string[];
  header: string[];
  /** Parsed data rows. */
  rows: RawCsvRow[];
  /** `# file: <name>` value when present. */
  file: string | null;
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

const HEADER_ALIASES: Record<keyof ColumnMap, string[]> = {
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
      lineCount++;
      continue;
    }

    lineCount++;
    if (cells.length !== current.header.length) {
      raggedRows++;
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
