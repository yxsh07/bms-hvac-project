#!/usr/bin/env python3
"""Build ontology JSON from the building-model data (T-010).

Reads the building-model xlsx from ``data/raw/`` (git-ignored) and emits:
  - data/seed/ontology.json          (assets, points, zones, controllers)
  - data/seed/point-roles.json       (role -> abbreviation, keyed by asset type)
  - data/seed/forbidden-strings.txt  (distinctive tokens only)
  - a stdout summary: counts, and writable points by class.

SAFETY
------
The repository ships a committed, hand-authored ``data/seed/ontology.json`` and
``data/seed/point-roles.json`` used by the app, the twin and every test. This
tool must never clobber them with an empty scaffold. It therefore:

  * refuses to run when ``data/raw/`` containing the building-model xlsx is
    absent, and
  * refuses to overwrite existing seed files unless ``--force`` is passed.

Usage:
  python tools/build_ontology_json.py [--anonymise] [--force]

The parser itself is intentionally not implemented until the client export is
available (H-1 / gate G1); this scaffold makes the contract and the safety
behaviour explicit and stops accidental data loss.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "data" / "raw"
SEED_DIR = REPO_ROOT / "data" / "seed"

XLSX_SUFFIXES = (".xlsx", ".xlsm")


def find_building_model() -> Path | None:
    if not RAW_DIR.exists():
        return None
    for path in RAW_DIR.rglob("*"):
        if path.is_file() and path.suffix.lower() in XLSX_SUFFIXES:
            return path
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Build ontology JSON from the building model")
    parser.add_argument("--anonymise", action="store_true", help="Strip client-specific identifiers")
    parser.add_argument("--force", action="store_true", help="Overwrite existing seed files")
    args = parser.parse_args()

    model = find_building_model()
    if model is None:
        print(
            "ERROR: no building-model spreadsheet found under data/raw/.\n"
            "This tool needs the client export (git-ignored, H-1). Refusing to run so the\n"
            "committed seeds in data/seed/ are not overwritten with an empty scaffold.",
            file=sys.stderr,
        )
        return 2

    seed_files = [
        SEED_DIR / "ontology.json",
        SEED_DIR / "point-roles.json",
        SEED_DIR / "forbidden-strings.txt",
    ]
    existing = [p for p in seed_files if p.exists()]
    if existing and not args.force:
        print(
            "ERROR: seed files already exist; refusing to overwrite without --force:\n"
            + "\n".join(f"  - {p.relative_to(REPO_ROOT)}" for p in existing),
            file=sys.stderr,
        )
        return 3

    # Real parse is pending the client data (H-1). Do not fabricate an ontology.
    print(f"Found building model: {model.relative_to(REPO_ROOT)}")
    print("Parser not yet implemented: pending the client export and H-1 (gate G1).")
    print("No files written. Implement the xlsx parse here once data/raw/ is provided.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
