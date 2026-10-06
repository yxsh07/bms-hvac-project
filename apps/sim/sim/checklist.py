"""Test Checklist state (PLAN 6.8).

Playwright tests POST a result after asserting; the console renders the list.
State is keyed by ``featureId``.  No wall-clock dependence: we record a
monotonic run counter instead of a timestamp so replays stay deterministic.
"""

from __future__ import annotations

from typing import Any

from .profile import Features


class Checklist:
    def __init__(self, features: Features | None = None) -> None:
        self.features = features.features if features else []
        self.entries: dict[str, dict[str, Any]] = {}
        self._runs = 0

    def get(self) -> dict[str, Any]:
        items = []
        for f in self.features:
            entry = self.entries.get(f.id, {})
            items.append(
                {
                    "featureId": f.id,
                    "title": f.title,
                    "scenario": f.scenario,
                    "docRef": f.docRef,
                    "status": entry.get("status"),
                    "runId": entry.get("runId"),
                    "evidence": entry.get("evidence"),
                }
            )
        return {"features": items}

    def post(
        self,
        feature_id: str,
        status: str,
        run_id: str | None = None,
        evidence: str | None = None,
    ) -> dict[str, Any]:
        self._runs += 1
        entry = {
            "featureId": feature_id,
            "status": status,
            "runId": run_id,
            "evidence": evidence,
            "seq": self._runs,
        }
        self.entries[feature_id] = entry
        return entry
