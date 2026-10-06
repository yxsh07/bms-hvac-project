"""Each fault type, when active, produces its documented signature."""

from __future__ import annotations

from datetime import datetime
from itertools import pairwise

from sim.clock import DEFAULT_START
from sim.engine import SimEngine


def _minute(iso: str) -> int:
    return int((datetime.fromisoformat(iso) - DEFAULT_START).total_seconds() // 60)


def _engine(seed, ontology, profile):
    return SimEngine(seed=seed, ontology=ontology, profile=profile)


def test_sentinel(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.faults.add("sentinel", "lead-chiller")
    rows = engine.run(1440)
    assert any(r["value"] == -273.15 for r in rows)


def test_out_of_range(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.faults.add("out-of-range", "lead-chiller")
    rows = engine.run(1440)
    spikes = {10383.0, 436.63, 3_800_000.0, 18257.0, 219.0}
    assert any(r["value"] in spikes for r in rows)


def test_dropped_polls(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.faults.add("dropped-polls", "lead-chiller", {"droppedPolls": 0.5})
    rows = engine.run(600)
    lead = engine.chillers[0].id
    scheduled = len(ontology.asset(lead).points) * 600
    present = sum(1 for r in rows if r["entity_id"] == lead)
    assert present < scheduled * 0.6


def test_delayed_backfill(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.faults.add("delayed-backfill", "lead-chiller", {"delayedBackfill": 0.05})
    rows = engine.run(300)
    delayed = [r for r in rows if r["is_delayed"]]
    assert delayed
    # delayed rows carry an *older* event time than the live stream
    assert min(_minute(r["time"]) for r in delayed) < max(
        _minute(r["time"]) for r in rows if not r["is_delayed"]
    )


def test_orphan(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.faults.add("orphan", "lead-chiller", {"orphan": 0.05})
    rows = engine.run(300)
    orphans = {r["entity_id"] for r in rows if r["entity_id"].startswith("orphan-")}
    assert orphans
    assert all(ontology.asset(o) is None for o in orphans)


def test_stopped_zero(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.faults.add("stopped-zero", "standby-chiller")
    rows = engine.run(300)
    standby = engine.chillers[1].id
    stopped = [
        r
        for r in rows
        if r["entity_id"] == standby
        and r["field"] in {"CHWST", "CHWRT"}
        and r["value"] == 0.0
    ]
    assert stopped
    run_zero = [r for r in rows if r["entity_id"] == standby and r["field"] == "RUN" and r["value"] == 0.0]
    assert run_zero


def test_contradictory(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.runner.start("contradictory-fcu")
    rows = engine.run(400)
    target = "fcu-01"
    # FCUs own no run-status point in this ontology; the contradiction shows up
    # as fan speed stuck at 7 with the valve forced closed (status 0 semantics).
    fan = [
        r
        for r in rows
        if r["entity_id"] == target and r["field"] == "FANSPD" and _minute(r["time"]) >= 200
    ]
    valve = [
        r
        for r in rows
        if r["entity_id"] == target and r["field"] == "CHVP" and _minute(r["time"]) >= 200
    ]
    assert fan and all(r["value"] == 7.0 for r in fan)
    assert valve and all(r["value"] == 0.0 for r in valve)


def test_controller_outage(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.run(100)
    outage_assets = set(ontology.controller("ctrl-plant").assetIds)
    engine.faults.add("controller-outage", "ctrl-plant", duration=100, start_min=100)
    rows = engine.run(200)
    during = [r for r in rows if r["entity_id"] in outage_assets and 100 <= _minute(r["time"]) < 200]
    after = [r for r in rows if r["entity_id"] in outage_assets and _minute(r["time"]) >= 200]
    assert during == []
    assert after


def test_counter_reset(ontology, profile):
    engine = _engine(7, ontology, profile)
    before = engine.run(100)
    engine.faults.add("counter-reset", "lead-chiller", start_min=100)
    after = engine.run(100)
    kwh_before = [r["value"] for r in before if r["field"] == "TOTAL_KWH" and r["value"] is not None]
    kwh_after = [r["value"] for r in after if r["field"] == "TOTAL_KWH" and r["value"] is not None]
    assert max(kwh_before) > 0.5
    assert min(kwh_after) < max(kwh_before)


def test_flatline(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.faults.add("flatline", "lead-chiller")
    rows = engine.run(300)
    lead = engine.chillers[0].id
    series = [r["value"] for r in rows if r["entity_id"] == lead and r["field"] == "CHWST"]
    longest = run = 1
    for a, b in pairwise(series):
        run = run + 1 if a == b else 1
        longest = max(longest, run)
    assert longest >= 10


def test_negative_kw(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.faults.add("negative-kw", "lead-chiller")
    rows = engine.run(300)
    assert any(r["field"] == "KW" and r["value"] == -1.21 for r in rows)


def test_lead_chiller_trip(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.runner.start("lead-chiller-trip")
    rows = engine.run(800)
    lead = engine.chillers[0].id
    standby = engine.chillers[1].id
    trip_minute = 600
    lead_after = [
        r for r in rows if r["entity_id"] == lead and r["field"] == "RUN" and _minute(r["time"]) >= trip_minute
    ]
    sb_after = [
        r for r in rows if r["entity_id"] == standby and r["field"] == "RUN" and _minute(r["time"]) >= trip_minute
    ]
    sb_kw = [
        r for r in rows if r["entity_id"] == standby and r["field"] == "KW" and _minute(r["time"]) >= trip_minute
    ]
    assert lead_after and all(r["value"] == 0.0 for r in lead_after)
    assert sb_after and any(r["value"] == 1.0 for r in sb_after)
    assert any((r["value"] or 0) > 0 for r in sb_kw)


def test_valve_saturation(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.runner.start("critical-ahu-drift")
    rows = engine.run(600)
    target = "ahu-01"
    valves = [r["value"] for r in rows if r["entity_id"] == target and r["field"] == "CHVP"]
    assert valves
    assert max(valves) >= 97.0


def test_low_delta_t(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.runner.start("low-delta-t")
    rows = engine.run(600)
    lead = engine.chillers[0].id
    leave = {}
    for r in rows:
        if r["entity_id"] == lead and r["field"] == "CHWST" and _minute(r["time"]) >= 300:
            leave[r["time"]] = r["value"]
    dts = []
    for r in rows:
        if r["entity_id"] == lead and r["field"] == "CHWRT" and r["time"] in leave:
            dts.append(r["value"] - leave[r["time"]])
    assert dts
    assert abs(sum(dts) / len(dts) - 1.0) < 0.3


def test_tower_fouling(ontology, profile):
    engine = _engine(7, ontology, profile)
    engine.faults.add("tower-fouling", "lead-chiller")
    rows = engine.run(400)
    lead = engine.chillers[0].id
    cwst = [( _minute(r["time"]), r["value"]) for r in rows if r["entity_id"] == lead and r["field"] == "CWST"]
    early = [v for m, v in cwst if m < 50]
    late = [v for m, v in cwst if m >= 350]
    assert early and late
    assert sum(late) / len(late) > sum(early) / len(early) + 2.0
