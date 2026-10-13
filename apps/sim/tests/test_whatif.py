"""What-if endpoint contract (PLAN 5.9, 6.3; task WIF1).

The endpoint must step a *copy* of live state forward with the proposed
changes, never mutate the live engine, and label the result "indicative,
3-day calibration" while warning when the surrogate leaves its envelope.
"""

from __future__ import annotations

from sim.engine import WHATIF_LABEL, SimEngine


def _warm(seed: int, minutes: int, ontology, profile) -> SimEngine:
    engine = SimEngine(seed=seed, ontology=ontology, profile=profile)
    engine.run(minutes)
    return engine


def test_whatif_returns_labelled_predicted_kw_and_delta_t(ontology, profile):
    engine = _warm(1001, 120, ontology, profile)
    result = engine.whatif([], horizon_min=60, step_minutes=5)

    assert result["label"] == WHATIF_LABEL
    assert result["label"] == "indicative, 3-day calibration"
    assert result["horizonMin"] == 60
    assert result["points"] > 0
    assert result["predicted"]["series"]
    for sample in result["predicted"]["series"]:
        assert "kw" in sample and "deltaTC" in sample
    assert "meanKw" in result["predicted"] and "meanDeltaTC" in result["predicted"]
    assert result["baselineSeries"] == result["predicted"]["series"] or len(
        result["baselineSeries"]
    ) == len(result["predicted"]["series"])


def test_whatif_never_mutates_live_state(ontology, profile):
    engine = _warm(1001, 120, ontology, profile)
    before = engine._fingerprint()
    live_rows = len(engine.writer.recent(0))

    engine.whatif([{"type": "env", "outdoor_dbt": 45.0}], horizon_min=30)

    assert engine._fingerprint() == before
    assert len(engine.writer.recent(0)) == live_rows


def test_whatif_reports_live_state_unchanged(ontology, profile):
    engine = _warm(1001, 60, ontology, profile)
    result = engine.whatif([{"type": "fault", "fault": "lead-chiller-trip"}], horizon_min=30)
    assert result["liveStateUnchanged"] is True


def test_setpoint_change_moves_the_prediction(ontology, profile):
    engine = _warm(1001, 120, ontology, profile)
    lead = engine.chillers[0].id

    baseline = engine.whatif([], horizon_min=120, step_minutes=10)
    warmer = engine.whatif(
        [{"type": "setpoint", "target": lead, "field": "setpoint-chw-temp", "value": 11.0}],
        horizon_min=120,
        step_minutes=10,
    )

    # A higher CHW leaving temperature improves COP, so mean kW falls.
    assert warmer["predicted"]["meanKw"] < baseline["predicted"]["meanKw"]
    assert warmer["delta"]["meanKw"] < 0


def test_out_of_envelope_setpoint_warns(ontology, profile):
    engine = _warm(1001, 60, ontology, profile)
    lead = engine.chillers[0].id

    inside = engine.whatif(
        [{"type": "setpoint", "target": lead, "field": "setpoint-chw-temp", "value": 9.0}],
        horizon_min=30,
    )
    assert inside["envelope"]["exceeded"] is False
    assert inside["warning"] is None

    outside = engine.whatif(
        [{"type": "setpoint", "target": lead, "field": "setpoint-chw-temp", "value": 15.0}],
        horizon_min=30,
    )
    assert outside["envelope"]["exceeded"] is True
    assert "chwLeavingC" in outside["envelope"]["breaches"]
    assert outside["warning"] and "training envelope" in outside["warning"]


def test_unknown_change_type_is_rejected(ontology, profile):
    engine = _warm(1001, 30, ontology, profile)
    try:
        engine.whatif([{"type": "teleport"}], horizon_min=10)
    except ValueError as exc:
        assert "unknown change type" in str(exc)
    else:  # pragma: no cover - the guard must fire
        raise AssertionError("unknown change type was accepted")
