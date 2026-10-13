"""Surrogate training envelope (PLAN 6.4, task WIF1).

The plan asks for a gradient-boosted chiller-kW surrogate trained on days 1-2
and validated on day 3.  For the synthetic seed that model is out of scope
(ADR-003) and the parametric efficiency curve is used throughout.  What
remains, and what a what-if must still honour, is the surrogate *contract*: the
operating range the 3-day calibration actually covers.

A prediction that leaves the training envelope cannot be trusted.  The engine
falls back to the parametric curve and the API raises a warning so the UI can
label the result "indicative, 3-day calibration".

Pure functions only, so this is easy to unit-test.
"""

from __future__ import annotations

from typing import Any

# PLAN 6.4: the surrogate is trusted "inside the training envelope (± 5 %)".
TOLERANCE_PCT = 5.0
TRAINED_ON_DAYS = 3
SURROGATE_KIND = "parametric-curve"  # GBM surrogate out of scope; ADR-003


def envelope_bounds(profile) -> dict[str, dict[str, float]]:
    """The calibrated operating range for the surrogate's input features."""
    lc = profile.plant.leadChiller
    cond = profile.plant.condenser
    return {
        "outputTr": {"min": float(lc.outputMinTr), "max": float(lc.outputMaxTr)},
        "chwLeavingC": {"min": float(lc.chwLeavingMinC), "max": float(lc.chwLeavingMaxC)},
        "condenserEnteringC": {"min": float(cond.enteringMinC), "max": float(cond.enteringMaxC)},
    }


def _in_band(value: float | None, band: dict[str, float]) -> bool:
    if value is None:
        # No data is a coverage question, not an envelope breach; never
        # manufacture a warning from a missing sample.
        return True
    lo, hi = band["min"], band["max"]
    span = max(hi - lo, 1e-9)
    pad = span * TOLERANCE_PCT / 100.0
    return (lo - pad) <= value <= (hi + pad)


def evaluate_envelope(profile, series: list[dict[str, Any]]) -> dict[str, Any]:
    """Classify a predicted series against the training envelope."""
    bands = envelope_bounds(profile)
    total = len(series)
    outside = 0
    breaches: set[str] = set()
    for sample in series:
        sample_outside = False
        for key, band in bands.items():
            if not _in_band(sample.get(key), band):
                sample_outside = True
                breaches.add(key)
        if sample_outside:
            outside += 1

    inside_pct = 100.0 * (total - outside) / total if total else 100.0
    exceeded = outside > 0
    warning: str | None = None
    if exceeded:
        warning = (
            "Surrogate left its training envelope: this prediction runs outside "
            f"the 3-day calibration range ({', '.join(sorted(breaches))}). "
            "It falls back to the parametric curve and is indicative only."
        )
    return {
        "kind": SURROGATE_KIND,
        "trainedOnDays": TRAINED_ON_DAYS,
        "tolerancePct": TOLERANCE_PCT,
        "bounds": bands,
        "samples": total,
        "samplesOutside": outside,
        "insideEnvelopePct": round(inside_pct, 1),
        "exceeded": exceeded,
        "fallbackActive": exceeded,
        "breaches": sorted(breaches),
        "warning": warning,
    }
