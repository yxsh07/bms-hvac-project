"""Calibration from the client export (T-011, gate G1).

Pure functions so they can be unit-tested on synthetic fixtures. The CLI in
``tools/calibrate.py`` calls :func:`calibrate_export` on ``data/raw`` and writes
``data/calibration/*.json`` (each < 200 KB).

No site identifiers live here; asset types come from the caller's ontology map.
"""

from __future__ import annotations

import csv
import json
import math
import statistics
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

UTC = "Z"

# Known metadata column names (normalised) that should not be melted as fields.
_METADATA_COLUMNS = {
    'time', 'timestamp', '_time',
    'measurement', '_measurement',
    'entity', 'entityid', 'component', 'componentid', 'deviceid', 'device_id', 'id',
    'site', 'siteid', 'site_id',
    'result', 'table',
    '',  # empty column (common in InfluxDB exports)
}

# Header aliases mirroring apps/api/src/drivers/csv-parser.ts.
_ALIASES = {
    "time": {"time", "timestamp", "datetime", "date"},
    "entity": {"entity", "entityid", "component", "componentid", "id", "asset"},
    "field": {"field", "parameter", "point", "tag"},
    "value": {"value", "val", "reading"},
    "delayed": {"isdelayeddata", "isdelayed", "delayed"},
}


@dataclass
class CalRow:
    time: str
    entity: str
    field: str
    value: float | None
    is_delayed: bool = False


def _norm(cell: str) -> str:
    return cell.strip().lower().replace("_", "").replace("-", "").replace(" ", "")


def _is_pivoted_format(header: list[str]) -> bool:
    """Detect if a CSV header is in pivoted format (many field columns, few metadata columns)."""
    field_count = 0
    for h in header:
        norm = _norm(h)
        if norm not in _METADATA_COLUMNS:
            field_count += 1
    return field_count > 4


def _melt_pivoted_row(cells: list[str], header: list[str], cols: dict[str, int]) -> list[CalRow]:
    """Melt a pivoted row into multiple CalRow entries (one per field column)."""
    out: list[CalRow] = []
    t = cells[cols["time"]].strip()
    try:
        _ = int(t[:4])  # quick check if it looks like a timestamp
    except (ValueError, IndexError):
        return out
    entity = cells[cols["entity"]].strip()
    if not entity:
        return out

    for i, col_name in enumerate(header):
        norm_name = _norm(col_name)
        if norm_name in _METADATA_COLUMNS:
            continue
        value_str = cells[i].strip() if i < len(cells) else ""
        if not value_str:
            continue
        try:
            numeric = float(value_str)
        except ValueError:
            continue
        is_delayed = _is_delay_field(col_name) and numeric == 1
        out.append(CalRow(
            time=t,
            entity=entity,
            field=col_name,
            value=numeric,
            is_delayed=is_delayed,
        ))
    return out


def _resolve(header: list[str]) -> dict[str, int] | None:
    norm = [_norm(h) for h in header]
    out: dict[str, int] = {}
    for key, aliases in _ALIASES.items():
        for i, h in enumerate(norm):
            if h in aliases:
                out[key] = i
                break
    if not {"time", "entity", "field", "value"}.issubset(out):
        return None
    return out


def _is_delay_field(field_name: str) -> bool:
    return _norm(field_name) == "isdelayeddata"


def parse_annotated_csv(text: str) -> tuple[list[CalRow], dict[str, int]]:
    """Multi-block annotated CSV: blank line ends a block, ``#`` is an annotation.

    Supports both long format (time, entity, field, value) and pivoted format
    (time, entity, field1, field2, ... where each field column is melted).
    """
    rows: list[CalRow] = []
    stats = {"line_count": 0, "ragged": 0, "invalid": 0}
    header: list[str] = []
    cols: dict[str, int] | None = None
    is_pivoted = False
    delayed_keys: set[tuple[str, str]] = set()

    def flush_block() -> None:
        nonlocal header, cols, is_pivoted
        header = []
        cols = None
        is_pivoted = False

    for raw in text.splitlines():
        line = raw.rstrip()
        if line.strip() == "":
            flush_block()
            continue
        if line.lstrip().startswith("#"):
            continue
        cells = next(csv.reader([line]))
        if not header:
            header = [c.strip() for c in cells]
            cols = _resolve(header)
            is_pivoted = _is_pivoted_format(header)
            if is_pivoted:
                # For pivoted format, we only need time, entity, and optionally measurement
                # Re-resolve with relaxed requirements
                norm = [_norm(h) for h in header]
                cols = {}
                for i, h in enumerate(norm):
                    if h in {"time", "timestamp", "_time"}:
                        cols["time"] = i
                    elif h in {"entity", "entityid", "component", "componentid", "id", "asset"}:
                        cols["entity"] = i
                    elif h in {"measurement", "_measurement"}:
                        cols["measurement"] = i
                if "time" not in cols or "entity" not in cols:
                    cols = None
            stats["line_count"] += 1
            continue
        stats["line_count"] += 1
        if cols is None or len(cells) != len(header):
            stats["ragged"] += 1
            continue

        if is_pivoted:
            # Melt pivoted row
            melted = _melt_pivoted_row(cells, header, cols)
            for row in melted:
                if _is_delay_field(row.field) and row.value == 1:
                    row.is_delayed = True
                    delayed_keys.add((row.entity, row.time))
                rows.append(row)
            continue

        # Long format
        t = cells[cols["time"]].strip()
        entity = cells[cols["entity"]].strip()
        field_name = cells[cols["field"]].strip()
        if not t or not entity or not field_name:
            stats["invalid"] += 1
            continue
        try:
            value = float(cells[cols["value"]])
        except ValueError:
            value = None
        row = CalRow(time=t, entity=entity, field=field_name, value=value)
        if _is_delay_field(field_name) and value == 1:
            row.is_delayed = True
            delayed_keys.add((entity, t))
        rows.append(row)

    # Propagate delay markers to sibling rows at the same (entity, time).
    for row in rows:
        if not _is_delay_field(row.field) and (row.entity, row.time) in delayed_keys:
            row.is_delayed = True
    return rows, stats


def pct(values: list[float], p: float) -> float | None:
    if not values:
        return None
    xs = sorted(values)
    if len(xs) == 1:
        return xs[0]
    rank = (p / 100) * (len(xs) - 1)
    lo = math.floor(rank)
    hi = math.ceil(rank)
    if lo == hi:
        return xs[int(rank)]
    return xs[lo] + (xs[hi] - xs[lo]) * (rank - lo)


def _stats(values: list[float]) -> dict[str, float | int | None]:
    clean = [v for v in values if v is not None and not math.isnan(v)]
    if not clean:
        return {"n": 0, "mean": None, "p5": None, "p95": None}
    return {
        "n": len(clean),
        "mean": round(statistics.fmean(clean), 4),
        "p5": round(pct(clean, 5) or 0.0, 4),
        "p95": round(pct(clean, 95) or 0.0, 4),
    }


def _hour(time_str: str) -> int:
    # Accept "HH:MM:SS" embedded, else 0.
    marker = time_str.find("T")
    if marker >= 0 and len(time_str) >= marker + 3:
        try:
            return int(time_str[marker + 1 : marker + 3])
        except ValueError:
            return 0
    return 0


def infer_entity_type(fields: set[str]) -> str:
    """Infer entity type from the set of field names present."""
    fields_lower = {f.lower() for f in fields}

    # Chiller: very specific chilled/condenser water plant fields (NO ikwtr, NO outputfrequency, NO condapproach)
    chiller_indicators = {
        'chleff', 'chlwaterflow', 'chwmval', 'chwmhtmp', 'condewt', 'condlwt',
        'condwaterflow', 'coolewt', 'coollwt', 'dispressure', 'evapflow', 'evapproach',
        'oahum', 'oatmp', 'wbt', 'chlwmval', 'chlwtdelta', 'chlwtdelta_global',
        'condmhrtemp', 'condmhstemp', 'condtdelta',
        'eff', 'scta', 'setpoint', 'ssta', 'sucpressure', 'toteff', 'tpcons',
        'tptr', 'tr', 'v', 'oilpressure', 'opernlstatus', 'pertotcap', 'mhddtmp',
        'mhdmdtr', 'nochr'
    }
    if chiller_indicators & fields_lower:
        return "chiller"

    # Cooling tower: approach, wetbulb, condenser temps - NO shutvalpos, NO noctr
    cooling_tower_indicators = {'approach', 'wetbulb', 'inwatertemp', 'outwatertemp', 'range', 'condapproach', 'efficiency'}
    if cooling_tower_indicators & fields_lower:
        return "cooling_tower"

    # Pump: head, shutvalpos, waterflow, no*wpr (specific pump fields) - NO ikwtr, NO outputfrequency, NO mot2* (those are VFD)
    pump_indicators = {'head', 'shutvalpos', 'waterflow', 'nopcwpr', 'nocondwpr', 'noctr', 'current'}
    if pump_indicators & fields_lower:
        return "pump"

    # Chiller plant (combined): has chlwaterflow, chlmval, chlmhtmp, ctrltemp, dfttemp, ftemp, r1cdtemp, etc.
    chiller_plant_indicators = {'chlwaterflow', 'chlmval', 'chlmhtmp', 'ctrltemp', 'dfttemp', 'flwtemp', 'ctrlmode', 'r1cdtemp', 'r1dptemp', 'r2cdtemp', 'r2dptemp', 'r3cdtemp', 'r3dptemp', 'r4cdtemp', 'radapp', 'rdptemp', 'rtemp', 'setpttemp', 'sltemp', 'tr', 'wdel', 'chlwmval', 'chlwtdelta', 'chwmhtmp', 'coolewt', 'coollwt', 'chlwtdelta_global'}
    if chiller_plant_indicators & fields_lower:
        return "chiller_plant"

    # VFD/Fan motor: mot2* (specific to VFD-driven motors), outputfrequency, fanmode, hfstatus, h1status, hanalogstatus, pfstatus
    vfd_indicators = {'mot2controltype', 'mot2kw', 'mot2status', 'mot2tripstatus', 'fanmode', 'hfstatus', 'h1status', 'hanalogstatus', 'pfstatus', 'outputfrequency'}
    if vfd_indicators & fields_lower:
        return "vfd_motor"

    # AHU: requires actuator + (ahum OR atemp OR fanstatus OR ffstatus OR filterstatus OR pfstatus)
    # These are specific to air handling units - REMOVED pf (conflicts with electrical)
    ahu_specific = {'actuator', 'ahum', 'atemp', 'fanstatus', 'ffstatus', 'filterstatus', 'famddstatus', 'motspeed', 'pfstatus', 'ra', 'rarh', 'sa', 'sarh', 'setpoint_global', 'twvp', 'vfdmode', 'fanspeed', 'thmmode', 'thmsetpoint', 'cassetpoint', 'mode', 'shutvalpos', 'dp1', 'ahum_global', 'brttemp_global', 'current'}
    if ahu_specific & fields_lower:
        return "ahu"

    # FCU: rdptemp, rltemp, rtemp, sltemp, tr, wdel, ftemp, radcdel, radapp, radcdel, avgcol, chlwaterflow, ftemp, radcdel, ctrlmode, ctrltemp, dfttemp, flwtemp, r1cdtemp, r1dptemp, r2cdtemp, r2dptemp, r3cdtemp, r3dptemp, r4cdtemp, r4cdtemp, radapp, rdptemp, rtemp, setpttemp, sltemp, tr, wdel
    fcu_indicators = {'rdptemp', 'rltemp', 'rtemp', 'sltemp', 'tr', 'wdel', 'ftemp', 'radcdel', 'radapp', 'avgcol', 'chlwaterflow', 'ctrlmode', 'ctrltemp', 'dfttemp', 'flwtemp', 'r1cdtemp', 'r1dptemp', 'r2cdtemp', 'r2dptemp', 'r3cdtemp', 'r3dptemp', 'r4cdtemp', 'setpttemp'}
    if fcu_indicators & fields_lower:
        return "fcu"

    # Damper/Valve actuator: dpos, fahum, fatemp, sa, sahum
    damper_indicators = {'dpos', 'fahum', 'fatemp', 'sa', 'sahum'}
    if damper_indicators & fields_lower:
        return "damper"

    # Electrical meter: a_amp, a_vln, statustrip, alarmstatus, ikwtr
    electrical_indicators = {'a_amp', 'a_vln', 'statustrip', 'alarmstatus', 'ikwtr'}
    if electrical_indicators & fields_lower:
        return "electrical"

    # Electrical panel/breaker: a_amp, a_vln, kva, kvah, kwh, pf, statustrip, alarmstatus, ikwtr, frequency, vp
    panel_indicators = {'a_amp', 'a_vln', 'kva', 'kvah', 'kwh', 'pf', 'statustrip', 'alarmstatus', 'ikwtr', 'frequency', 'vp'}
    if panel_indicators & fields_lower:
        return "electrical_panel"

    # Electrical (generic kva/kvah/kw/pf but with statustrip/alarmstatus/ikwtr)
    electrical_generic = {'a_amp', 'a_vln', 'kva', 'kvah', 'kwh', 'pf', 'statustrip', 'alarmstatus', 'ikwtr', 'frequency', 'vp'}
    if electrical_generic & fields_lower:
        return "electrical"

    # Dashboard/virtual: Fkw, fikW/TR, b2kw, status1...statusN
    dashboard_indicators = {'1fkw', '2fkw', '3fkw', '4fkw', '5fkw', '6fkw', '7fkw', '8fkw', '9fkw', '10fikw/tr', '2fikw/tr', '4fikw/tr', '5fikw/tr', '7fikw/tr', '8fikw/tr', 'b2ikw/tr', 'b2kw', '1fikw/tr'}
    if dashboard_indicators & fields_lower:
        return "dashboard"

    # Status only entity
    status_only = all('status' in f for f in fields_lower)
    if status_only:
        return "status_point"

    return "unknown"


def calibrate(
    rows: Iterable[CalRow],
    entity_types: dict[str, str] | None = None,
    *,
    cadence_seconds: int = 60,
    window_minutes: int | None = None,
    expected_timestamps: int | None = None,
) -> dict[str, Any]:
    """Compute the derived calibration JSON from parsed rows."""
    rows = list(rows)
    by_type_field: dict[str, dict[str, list[float]]] = {}
    hourly: dict[str, dict[str, dict[str, list[float]]]] = {}
    chiller_part_load: list[dict[str, float]] = []
    tower_approach: list[dict[str, float]] = []
    fault_distribution: dict[str, int] = {}
    chiller_load: dict[str, dict[str, float]] = {}
    chiller_kw: dict[str, dict[str, float]] = {}

    # Per-entity latest values for the floor-kW question.
    dashboard_total_kw: list[float] = []

    # Collect fields per entity for type inference
    entity_fields: dict[str, set[str]] = {}
    for row in rows:
        if row.field:
            entity_fields.setdefault(row.entity, set()).add(row.field)

    # Build entity_types if not provided
    if entity_types is None:
        entity_types = {}
        for entity, fields in entity_fields.items():
            entity_types[entity] = infer_entity_type(fields)

    # Main calibration loop
    for row in rows:
        asset_type = entity_types.get(row.entity, "unknown")
        value = row.value
        if value is None:
            fault_distribution["null_value"] = fault_distribution.get("null_value", 0) + 1
            continue
        if value == -273.15:
            fault_distribution["sentinel"] = fault_distribution.get("sentinel", 0) + 1
            continue
        if not math.isfinite(value):
            fault_distribution["non_finite"] = fault_distribution.get("non_finite", 0) + 1
            continue
        if row.is_delayed:
            fault_distribution["delayed"] = fault_distribution.get("delayed", 0) + 1

        by_type_field.setdefault(asset_type, {}).setdefault(row.field, []).append(value)
        hourly.setdefault(asset_type, {}).setdefault(row.field, {}).setdefault(
            str(_hour(row.time)), []
        ).append(value)

        if row.field == "TOTAL_KW":
            dashboard_total_kw.append(value)

        # Chiller part-load curve: LOAD (%) vs KW at the same (entity, time).
        if asset_type == "chiller":
            if row.field == "LOAD":
                chiller_load.setdefault(row.entity, {})[row.time] = value
            elif row.field == "KW":
                chiller_kw.setdefault(row.entity, {})[row.time] = value

    # Compose the part-load curve pairs (per entity, same time).
    for entity, loads in chiller_load.items():
        kws = chiller_kw.get(entity, {})
        for t, load in loads.items():
            kw = kws.get(t)
            if kw is not None and kw > 0:
                chiller_part_load.append({"load_pct": round(load, 3), "kw": round(kw, 3)})

    summary_by_type: dict[str, dict[str, Any]] = {}
    for asset_type, fields in by_type_field.items():
        summary_by_type[asset_type] = {f: _stats(v) for f, v in fields.items()}
        for f, hours in hourly[asset_type].items():
            summary_by_type[asset_type][f]["hourly_mean"] = {
                h: round(statistics.fmean(vals), 4) for h, vals in sorted(hours.items()) if vals
            }

    # Dropped polls: distinct timestamps seen vs expected.
    distinct_times = len({r.time for r in rows})
    if expected_timestamps and expected_timestamps > 0:
        observed = min(expected_timestamps, distinct_times)
        dropped = max(0.0, 1.0 - observed / expected_timestamps)
    elif window_minutes and cadence_seconds > 0:
        expected = max(1, int(window_minutes * 60 / cadence_seconds))
        dropped = max(0.0, 1.0 - min(expected, distinct_times) / expected)
    else:
        dropped = None

    # Floor-kW includes plant? Compare dashboard TOTAL_KW with summed chiller kW.
    includes_plant: bool | None = None
    if dashboard_total_kw and chiller_kw:
        mean_total = statistics.fmean(dashboard_total_kw)
        mean_chillers = statistics.fmean(
            [kw for per_entity in chiller_kw.values() for kw in per_entity.values()]
        )
        if mean_total > 0:
            includes_plant = mean_chillers >= 0.5 * mean_total

    return {
        "counts": {
            "rows": len(rows),
            "entities": len({r.entity for r in rows}),
            "distinct_timestamps": distinct_times,
        },
        "dropped_poll_rate": None if dropped is None else round(dropped, 6),
        "by_type_field": summary_by_type,
        "chiller_part_load": chiller_part_load[:200],
        "tower_approach": tower_approach,
        "fault_distribution": fault_distribution,
        "total_floor_kw_includes_plant": includes_plant,
    }


def reset_state() -> None:
    """Retained for CLI symmetry; calibration is now stateless."""


def calibrate_export(input_path: str | Path, entity_types: dict[str, str] | None = None, **kw: Any) -> dict[str, Any]:
    path = Path(input_path)
    texts: list[str] = []
    if path.is_dir():
        for f in sorted(path.rglob("*.csv")):
            texts.append(f.read_text(encoding="utf-8"))
    else:
        texts.append(path.read_text(encoding="utf-8"))
    rows: list[CalRow] = []
    for text in texts:
        parsed, _ = parse_annotated_csv(text)
        rows.extend(parsed)
    return calibrate(rows, entity_types, **kw)


def write_calibration(result: dict[str, Any], out_dir: str | Path, max_bytes: int = 2_000_000) -> list[Path]:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    files = {
        "hourly_means.json": {
            "by_type_field": result.get("by_type_field", {}),
            "counts": result.get("counts", {}),
        },
        "chiller_part_load.json": {"points": result.get("chiller_part_load", [])},
        "tower_approach.json": {"points": result.get("tower_approach", [])},
        "fault_stats.json": {
            "fault_distribution": result.get("fault_distribution", {}),
            "dropped_poll_rate": result.get("dropped_poll_rate"),
            "total_floor_kw_includes_plant": result.get("total_floor_kw_includes_plant"),
        },
    }
    written: list[Path] = []
    for name, payload in files.items():
        data = json.dumps(payload, indent=2)
        if len(data.encode("utf-8")) > max_bytes:
            raise ValueError(f"{name} exceeds {max_bytes} bytes; reduce the window")
        target = out / name
        target.write_text(data, encoding="utf-8")
        written.append(target)
    return written
