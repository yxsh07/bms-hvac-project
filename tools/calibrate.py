#!/usr/bin/env python3
"""Calibrate SimSite from the client export (T-011, gate G1).

Reads a directory of multi-block annotated CSVs (the client export) and writes
small derived JSON to ``data/calibration/``:

  hourly_means.json       mean / p5 / p95 per asset type and field, by hour
  chiller_part_load.json  (LOAD %, kW) curve points
  tower_approach.json     approach vs wet-bulb points
  fault_stats.json        dropped-poll rate, fault counts, floor-kW answer

SAFETY
------
The repository ships a synthetic ``data/calibration/profile.json`` derived from
PLAN 3.2 so the simulator can be built before the client data exists. This tool
never touches that file, refuses to run without ``data/raw/`` unless ``--input``
is given, and refuses to overwrite existing derived files unless ``--force``.

Usage:
  python tools/calibrate.py                 # reads data/raw
  python tools/calibrate.py --input DIR --out DIR --force
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "data" / "raw"
OUT_DIR = REPO_ROOT / "data" / "calibration"
ONTOLOGY = REPO_ROOT / "data" / "seed" / "ontology.json"

# Make apps/sim importable for the shared calibration library.
sys.path.insert(0, str(REPO_ROOT / "apps" / "sim"))

from sim.calibration import calibrate_export, write_calibration  # noqa: E402


def entity_types_from_ontology(path: Path) -> dict[str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {a["id"]: a.get("type", "unknown") for a in data.get("assets", [])}


def main() -> int:
    parser = argparse.ArgumentParser(description="Calibrate SimSite from the client export")
    parser.add_argument("--input", default=str(RAW_DIR), help="export directory or CSV file")
    parser.add_argument("--out", default=str(OUT_DIR), help="output directory")
    parser.add_argument("--force", action="store_true", help="overwrite existing derived files")
    parser.add_argument("--cadence-seconds", type=int, default=60)
    parser.add_argument("--window-minutes", type=int, default=None)
    parser.add_argument("--expected-timestamps", type=int, default=None)
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(
            f"ERROR: input {input_path} does not exist. The client export lives in data/raw/ "
            "(H-1). Refusing to run so the committed synthetic profile is not overwritten.",
            file=sys.stderr,
        )
        return 2

    out_dir = Path(args.out)
    existing = [p for p in out_dir.glob("*.json")] if out_dir.exists() else []
    if existing and not args.force:
        print(
            "ERROR: derived calibration files already exist; refusing to overwrite without "
            "--force:\n" + "\n".join(f"  - {p}" for p in existing),
            file=sys.stderr,
        )
        return 3

    entity_types = entity_types_from_ontology(ONTOLOGY) if ONTOLOGY.exists() else None
    result = calibrate_export(
        input_path,
        entity_types,
        cadence_seconds=args.cadence_seconds,
        window_minutes=args.window_minutes,
        expected_timestamps=args.expected_timestamps,
    )
    written = write_calibration(result, out_dir, max_bytes=2_000_000)

    print(f"Calibrated {result['counts']['rows']} rows from {input_path}")
    print(f"dropped_poll_rate = {result['dropped_poll_rate']}")
    print(f"total_floor_kw_includes_plant = {result['total_floor_kw_includes_plant']}")
    for path in written:
        print(f"  wrote {path.relative_to(REPO_ROOT) if path.is_relative_to(REPO_ROOT) else path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
