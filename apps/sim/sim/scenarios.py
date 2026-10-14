"""Scenario runner.

Scenarios are yaml timelines of ``env`` / ``fault`` / ``mode`` events at
sim-minutes (PLAN 6.6).  Targets inside the yaml are LOGICAL and are resolved
through the profile by the fault layer.  Every start takes a seed.
"""

from __future__ import annotations

from typing import Any

from .profile import Catalogue, Scenario


class ScenarioRunner:
    def __init__(self, engine, catalogue: Catalogue | None = None) -> None:
        self.engine = engine
        self.catalogue = catalogue
        self.current: Scenario | None = None
        self.current_name: str | None = None
        self.start_min = 0
        self._applied: set[int] = set()

    # ------------------------------------------------------------------
    def reset(self) -> None:
        self.current = None
        self.current_name = None
        self.start_min = 0
        self._applied = set()

    def list(self) -> list[dict[str, Any]]:
        if self.catalogue is None:
            return []
        return [
            {"name": s.name, "tier": s.tier, "description": s.description, "seed": s.seed}
            for s in self.catalogue.scenarios
        ]

    def _find(self, name: str) -> Scenario | None:
        if self.catalogue is None:
            return None
        for s in self.catalogue.scenarios:
            if s.name == name:
                return s
        return None

    def start(self, name: str, seed: int | None = None) -> bool:
        sc = self._find(name)
        if sc is None:
            return False
        # A scenario resets physics, but must not rewind timestamps already
        # ingested by the operator app. Tests can seek explicitly for replay.
        start_time = self.engine.clock.now()
        self.engine.reset(seed if seed is not None else sc.seed)
        self.engine.clock.seek(start_time.isoformat())
        self.current = sc
        self.current_name = sc.name
        self.start_min = 0
        self._applied = set()
        # events scheduled at minute zero apply immediately
        for i, ev in enumerate(sc.events):
            if ev.atMin <= 0:
                self._apply(ev, i)
        return True

    def stop(self) -> None:
        self.current = None
        self.current_name = None

    def tick(self, minutes: int) -> None:
        if self.current is None:
            return
        rel = minutes - self.start_min
        for i, ev in enumerate(self.current.events):
            if i in self._applied:
                continue
            if rel >= ev.atMin:
                self._apply(ev, i)

    # ------------------------------------------------------------------
    def _apply(self, ev, index: int) -> None:
        self._applied.add(index)
        extra = ev.model_extra or {}
        if ev.type == "env":
            if "outdoorDbtOffsetC" in extra:
                self.engine.env_dbt_offset = float(extra["outdoorDbtOffsetC"])
            if "outdoor_dbt" in extra:
                self.engine.env_dbt = float(extra["outdoor_dbt"])
            if "rh" in extra:
                self.engine.env_rh = float(extra["rh"])
            if "occupancyMultiplier" in extra:
                self.engine.env_occ = float(extra["occupancyMultiplier"])
        elif ev.type == "fault":
            self.engine.faults.add(
                extra.get("fault"),
                extra.get("target"),
                extra.get("params"),
                extra.get("durationMin"),
                start_min=self.engine.minutes,
            )
        elif ev.type == "mode":
            asset = extra.get("asset")
            ctype = extra.get("controlType")
            if asset and ctype:
                self.engine.modes[str(asset)] = str(ctype)
