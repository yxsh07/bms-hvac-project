"""Surrogate training-envelope tests (PLAN 6.4, WIF1)."""

from __future__ import annotations

from sim.envelope import envelope_bounds, evaluate_envelope


def _sample(**kw):
    base = {
        "t": "2026-07-12T00:00:00+00:00",
        "kw": 30.0,
        "deltaTC": 3.0,
        "tr": 60.0,
        "chwLeavingC": 8.0,
        "condenserEnteringC": 25.0,
    }
    base.update(kw)
    return base


def test_bounds_come_from_calibration(profile):
    bounds = envelope_bounds(profile)
    assert bounds["chwLeavingC"] == {"min": 7.1, "max": 12.1}
    assert bounds["outputTr"]["max"] == 181.0
    assert bounds["condenserEnteringC"]["min"] < bounds["condenserEnteringC"]["max"]


def test_inside_envelope_is_not_flagged(profile):
    result = evaluate_envelope(profile, [_sample(), _sample(chwLeavingC=11.0)])
    assert result["exceeded"] is False
    assert result["fallbackActive"] is False
    assert result["warning"] is None
    assert result["insideEnvelopePct"] == 100.0


def test_outside_envelope_warns_and_names_the_breach(profile):
    result = evaluate_envelope(profile, [_sample(chwLeavingC=15.0)])
    assert result["exceeded"] is True
    assert result["fallbackActive"] is True
    assert result["breaches"] == ["chwLeavingC"]
    assert result["warning"] and "training envelope" in result["warning"]


def test_five_percent_pad_is_allowed(profile):
    # 5 % of the 5 K span is 0.25 K; 12.3 K is inside, 12.5 K is not.
    assert evaluate_envelope(profile, [_sample(chwLeavingC=12.3)])["exceeded"] is False
    assert evaluate_envelope(profile, [_sample(chwLeavingC=12.5)])["exceeded"] is True


def test_missing_samples_do_not_manufacture_a_breach(profile):
    result = evaluate_envelope(profile, [_sample(chwLeavingC=None, condenserEnteringC=None)])
    assert result["exceeded"] is False
