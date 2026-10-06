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
    """Multi-block annotated CSV: blank line ends a block, ``#`` is an annotation."""
    rows: list[CalRow] = []
    stats = {"line_count": 0, "ragged": 0, "invalid": 0}
    header: list[str] = []
    cols: dict[str, int] | None = None
    delayed_keys: set[tuple[str, str]] = set()
    delay_fields: list[CalRow] = []

    def flush_block() -> None:
        nonlocal header, cols
        header = []
        cols = None

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
            stats["line_count"] += 1
            continue
        stats["line_count"] += 1
        if cols is None or len(cells) != len(header):
            stats["ragged"] += 1
            continue
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
        delay_fields.append(row)

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


def calibrate(
    rows: Iterable[CalRow],
    entity_types: dict[str, str],
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


def calibrate_export(input_path: str | Path, entity_types: dict[str, str], **kw: Any) -> dict[str, Any]:
    path = Path(input_path)
    texts: list[str] = []
    if path.is_dir():
        for f in sorted(path.glob("*.csv")):
            texts.append(f.read_text(encoding="utf-8"))
    else:
        texts.append(path.read_text(encoding="utf-8"))
    rows: list[CalRow] = []
    for text in texts:
        parsed, _ = parse_annotated_csv(text)
        rows.extend(parsed)
    return calibrate(rows, entity_types, **kw)


def write_calibration(result: dict[str, Any], out_dir: str | Path, max_bytes: int = 200_000) -> list[Path]:
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
