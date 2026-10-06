"""T-011 calibration parser and statistics (synthetic fixtures only)."""

from __future__ import annotations

import json

from sim.calibration import (
    calibrate,
    parse_annotated_csv,
    pct,
    write_calibration,
)

CSV = """# file: day1.csv
# units: C, kW, %
time,entity,field,value
2026-07-12T00:00:00Z,chiller-01,CHWST,7.9
2026-07-12T00:00:00Z,chiller-01,LOAD,40
2026-07-12T00:00:00Z,chiller-01,KW,20
2026-07-12T00:05:00Z,chiller-01,CHWST,-273.15
2026-07-12T00:05:00Z,chiller-01,KW,21
2026-07-12T00:10:00Z,chiller-01,is_delayed_data,1
2026-07-12T00:10:00Z,chiller-01,KW,22
2026-07-12T00:10:00Z,ahu-01,SAT,14.0
"""

TYPES = {"chiller-01": "chiller", "ahu-01": "ahu"}


def test_parse_annotated_csv_counts_and_delay_propagation():
    rows, stats = parse_annotated_csv(CSV)
    assert stats["line_count"] == 9
    assert stats["ragged"] == 0
    assert stats["invalid"] == 0
    # The is_delayed_data row propagates to its sibling (chiller-01 @ 00:10).
    delayed = [r for r in rows if r.entity == "chiller-01" and r.time.endswith("00:10:00Z")]
    assert any(r.field == "KW" and r.is_delayed for r in delayed)


def test_parse_skips_ragged_rows():
    rows, stats = parse_annotated_csv(
        "time,entity,field,value\n2026-07-12T00:00:00Z,a,b,1\n2026-07-12T00:00:00Z,ragged"
    )
    assert stats["ragged"] == 1
    assert len(rows) == 1


def test_pct_interpolates():
    assert pct([0, 10], 50) == 5
    assert pct([], 50) is None


def test_calibrate_excludes_sentinel_and_builds_part_load():
    rows, _ = parse_annotated_csv(CSV)
    result = calibrate(
        rows,
        TYPES,
        cadence_seconds=60,
        window_minutes=15,
        expected_timestamps=15,
    )
    # Sentinel (-273.15) is counted as a fault and excluded from the CHWST mean.
    assert result["fault_distribution"].get("sentinel") == 1
    chwst = result["by_type_field"]["chiller"]["CHWST"]
    assert chwst["n"] == 1
    assert chwst["mean"] == 7.9

    # Part-load pairs: (LOAD, KW) at matching (entity, time).
    assert {"load_pct": 40.0, "kw": 20.0} in result["chiller_part_load"]

    # Dropped polls: 3 distinct timestamps of an expected 15 -> 80% dropped.
    assert result["dropped_poll_rate"] == 0.8
    assert result["counts"]["distinct_timestamps"] == 3


def test_calibrate_detects_floor_kw_includes_plant():
    text = (
        "time,entity,field,value\n"
        "2026-07-12T00:00:00Z,chiller-01,KW,30\n"
        "2026-07-12T00:00:00Z,dash,TOTAL_KW,35\n"
    )
    rows, _ = parse_annotated_csv(text)
    result = calibrate(rows, {"chiller-01": "chiller", "dash": "dashboard"})
    assert result["total_floor_kw_includes_plant"] is True


def test_write_calibration_persists_and_enforces_size(tmp_path):
    rows, _ = parse_annotated_csv(CSV)
    result = calibrate(rows, TYPES, window_minutes=15, expected_timestamps=15)
    written = write_calibration(result, tmp_path)
    names = {p.name for p in written}
    assert names == {
        "hourly_means.json",
        "chiller_part_load.json",
        "tower_approach.json",
        "fault_stats.json",
    }
    fault_stats = json.loads((tmp_path / "fault_stats.json").read_text())
    assert fault_stats["total_floor_kw_includes_plant"] is None

    # A tiny cap must raise rather than write an oversized file.
    import pytest

    with pytest.raises(ValueError):
        write_calibration(result, tmp_path / "small", max_bytes=10)
