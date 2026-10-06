"""Determinism: same seed + fixed window => byte-identical rows (PLAN 6.4)."""

from __future__ import annotations

import json

from sim.engine import SimEngine


def _export(seed, minutes, ontology, profile):
    engine = SimEngine(seed=seed, ontology=ontology, profile=profile)
    return json.dumps(engine.run(minutes), sort_keys=True).encode("utf-8")


def test_same_seed_is_byte_identical(ontology, profile):
    first = _export(77, 300, ontology, profile)
    second = _export(77, 300, ontology, profile)
    assert first == second


def test_different_seed_changes_rows(ontology, profile):
    assert _export(77, 120, ontology, profile) != _export(78, 120, ontology, profile)
