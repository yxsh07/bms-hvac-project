"""Acceptance targets from PLAN 3.2 / 6.7."""

from __future__ import annotations

import collections
import statistics

from sim.engine import SimEngine


def _run(seed: int, minutes: int, ontology, profile):
    engine = SimEngine(seed=seed, ontology=ontology, profile=profile)
    rows = engine.run(minutes)
    return engine, rows


def test_entities_per_type_match_ontology(ontology, profile):
    _engine, rows = _run(1001, 240, ontology, profile)
    expected: dict[str, set[str]] = collections.defaultdict(set)
    for asset in ontology.assets:
        expected[asset.type].add(asset.id)
    emitted: dict[str, set[str]] = collections.defaultdict(set)
    for row in rows:
        asset = ontology.asset(row["entity_id"])
        if asset is not None:
            emitted[asset.type].add(asset.id)
    assert set(emitted) == set(expected)
    for asset_type, ids in expected.items():
        assert emitted[asset_type] == ids


def test_mean_delta_t_within_tolerance(ontology, profile):
    engine, rows = _run(1001, 1440, ontology, profile)
    lead = engine.chillers[0].id
    leave = {}
    for row in rows:
        if row["entity_id"] == lead and row["field"] == "CHWST" and row["value"]:
            leave[row["time"]] = row["value"]
    dts = []
    for row in rows:
        if row["entity_id"] == lead and row["field"] == "CHWRT":
            base = leave.get(row["time"])
            if base and 0.0 < row["value"] < 40.0:
                dts.append(row["value"] - base)
    assert dts
    mean_dt = statistics.mean(dts)
    target = profile.plant.leadChiller.deltaTMeanC
    assert abs(mean_dt - target) <= 0.3, (mean_dt, target)
    assert abs(engine.mean_dt() - target) <= 0.3


def test_mean_efficiency_within_tolerance(ontology, profile):
    engine, rows = _run(1001, 1440, ontology, profile)
    nameplate = profile.plant.leadChillerNameplateTr
    kw = {}
    load = {}
    for row in rows:
        key = (row["entity_id"], row["time"])
        if row["field"] == "KW" and row["value"] is not None:
            kw[key] = row["value"]
        elif row["field"] == "LOAD" and row["value"] is not None:
            load[key] = row["value"]
    effs = []
    for key, value in kw.items():
        if key not in load:
            continue
        tr = load[key] / 100.0 * nameplate
        if tr > 0.5 and value and value > 0:
            effs.append(value / tr)
    assert effs
    mean_eff = statistics.mean(effs)
    target = profile.plant.leadChiller.efficiencyMeanIkwPerTr
    assert abs(mean_eff - target) <= 0.03, (mean_eff, target)
    assert abs(engine.mean_efficiency() - target) <= 0.03


def test_lead_alone_runtime_share(ontology, profile):
    engine, _ = _run(1001, 1440, ontology, profile)
    target = profile.plant.station.leadAloneShare
    assert abs(engine.lag_alone_share() - target) <= 0.05


def test_dropped_poll_rate(ontology, profile):
    _engine, rows = _run(1001, 1440, ontology, profile)
    scheduled = sum(len(asset.points) for asset in ontology.assets) * 1440
    missing = scheduled - len(rows)
    rate = missing / scheduled
    target = profile.qualityRates.missingCadenceShare
    # acceptance: within +/- 0.1 percentage point of 0.2%
    assert abs(rate - target) <= 0.001, rate
