"""Fault layer.

Faults mutate **emitted rows only**.  The physics state in the engine stays
truthful, which is what lets the app's quality layer be tested against known
ground truth (PLAN 6.5).  Ambient dropped polls reflect the measured loss in
``profile.qualityRates`` because they are always present in the real export.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from .noise import hash_unit
from .profile import resolve_target

_TEMP_CLS = {
    "chilled-water-supply-temp",
    "chilled-water-return-temp",
    "condenser-water-supply-temp",
    "condenser-water-return-temp",
    "supply-air-temp",
    "return-air-temp",
    "area-temp",
}


def _is_temperature_or_setpoint(cls: str) -> bool:
    return cls in _TEMP_CLS or cls.startswith("setpoint")


@dataclass
class FaultSpec:
    id: str
    type: str
    target: str | None
    raw_target: str | None
    params: dict[str, Any] = field(default_factory=dict)
    duration: int | None = None
    start: int = 0
    state: dict[str, Any] = field(default_factory=dict)

    def is_active(self, tmin: int) -> bool:
        if tmin < self.start:
            return False
        if self.duration is None:
            return True
        return tmin < self.start + self.duration


class FaultLayer:
    def __init__(self, engine) -> None:
        self.engine = engine
        self.specs: list[FaultSpec] = []
        self._n = 0

    # -- management ----------------------------------------------------
    def add(
        self,
        ftype: str | None,
        target: str | None = None,
        params: dict[str, Any] | None = None,
        duration: int | None = None,
        start_min: int | None = None,
    ) -> str:
        if not ftype:
            raise ValueError("fault type is required")
        resolved = resolve_target(target, self.engine.ontology)
        spec = FaultSpec(
            id=f"fault-{self._n}",
            type=str(ftype),
            target=resolved,
            raw_target=target,
            params=dict(params or {}),
            duration=None if duration is None else int(duration),
            start=self.engine.minutes if start_min is None else int(start_min),
        )
        self._n += 1
        self.specs.append(spec)
        return spec.id

    def remove(self, fault_id: str) -> bool:
        before = len(self.specs)
        self.specs = [s for s in self.specs if s.id != fault_id]
        return len(self.specs) != before

    def clear(self) -> None:
        self.specs = []

    def active(self, tmin: int) -> list[FaultSpec]:
        return [s for s in self.specs if s.is_active(tmin)]

    # -- application ---------------------------------------------------
    def apply(self, rows: list[dict[str, Any]], tmin: int) -> list[dict[str, Any]]:
        rate = self.engine.profile.qualityRates.missingCadenceShare
        if rate > 0:
            seed = self.engine.seed
            rows = [
                r
                for r in rows
                if hash_unit(seed, "ambient-drop", r["entity_id"], r["field"], r["time"]) >= rate
            ]
        for spec in list(self.specs):
            if spec.is_active(tmin):
                rows = self._dispatch(spec, rows, tmin)
        return rows

    def _dispatch(self, spec: FaultSpec, rows, tmin):
        fn = getattr(self, "_f_" + spec.type.replace("-", "_"), None)
        if fn is None:
            return rows
        return fn(spec, rows, tmin)

    # -- helpers -------------------------------------------------------
    def _target_assets(self, spec: FaultSpec) -> set[str]:
        ctrl = self.engine.ontology.controller(spec.target) if spec.target else None
        if ctrl is not None:
            return set(ctrl.assetIds)
        if spec.target:
            return {spec.target}
        return set()

    def _cls(self, entity: str, field_name: str) -> str:
        asset = self.engine.ontology.asset(entity)
        if asset is None:
            return ""
        p = asset.point(field_name)
        return p.cls if p else ""

    def _rate(self, spec: FaultSpec, key: str, default: float) -> float:
        if key in spec.params:
            return float(spec.params[key])
        return float(getattr(self.engine.profile.faultDistribution, key, default))

    # -- individual faults --------------------------------------------
    def _f_sentinel(self, spec, rows, tmin):
        rate = self._rate(spec, "sentinel", 0.0008)
        targets = self._target_assets(spec)
        for r in rows:
            if r["entity_id"] not in targets:
                continue
            if not _is_temperature_or_setpoint(self._cls(r["entity_id"], r["field"])):
                continue
            if hash_unit(self.engine.seed, spec.id, "sentinel", r["entity_id"], r["field"], r["time"]) < rate:
                r["value"] = -273.15
        return rows

    def _f_out_of_range(self, spec, rows, tmin):
        rate = self._rate(spec, "outOfRange", 0.0006)
        targets = self._target_assets(spec)
        spikes = {
            "loading-percentage": 10383.0,
            "power": 3_800_000.0,
            "speed-percentage": 436.63,
            "fan-speed": 436.63,
            "differential-pressure": 18257.0,
            "area-temp": 219.0,
        }
        for r in rows:
            if r["entity_id"] not in targets:
                continue
            cls = self._cls(r["entity_id"], r["field"])
            if not cls:
                continue
            if hash_unit(self.engine.seed, spec.id, "oor", r["entity_id"], r["field"], r["time"]) < rate:
                r["value"] = spikes.get(cls, 18257.0)
        return rows

    def _f_dropped_polls(self, spec, rows, tmin):
        rate = self._rate(spec, "droppedPolls", 0.0021)
        targets = self._target_assets(spec)
        return [
            r
            for r in rows
            if not (
                r["entity_id"] in targets
                and hash_unit(self.engine.seed, spec.id, "drop", r["entity_id"], r["field"], r["time"]) < rate
            )
        ]

    def _f_delayed_backfill(self, spec, rows, tmin):
        rate = self._rate(spec, "delayedBackfill", 0.00181)
        targets = self._target_assets(spec)
        out: list[dict[str, Any]] = []
        for r in rows:
            out.append(r)
            if r["entity_id"] not in targets:
                continue
            if hash_unit(self.engine.seed, spec.id, "late", r["entity_id"], r["field"], r["time"]) < rate:
                late = dict(r)
                late["is_delayed"] = True
                lag = 1 + int(hash_unit(self.engine.seed, spec.id, "lag", r["entity_id"], r["field"], r["time"]) * 120)
                late["time"] = self._shift(r["time"], -lag)
                out.append(late)
        return out

    def _f_orphan(self, spec, rows, tmin):
        rate = self._rate(spec, "orphan", 0.0004)
        targets = self._target_assets(spec)
        out: list[dict[str, Any]] = []
        for r in rows:
            out.append(r)
            if r["entity_id"] not in targets:
                continue
            if hash_unit(self.engine.seed, spec.id, "orphan", r["entity_id"], r["field"], r["time"]) < rate:
                h = int(hash_unit(self.engine.seed, spec.id, "orphanid", r["entity_id"], r["field"]) * 1e9)
                orph = dict(r)
                orph["entity_id"] = f"orphan-{h:09x}"
                out.append(orph)
        return out

    def _f_stopped_zero(self, spec, rows, tmin):
        targets = self._target_assets(spec)
        zero_cls = _TEMP_CLS | {"power", "loading-percentage", "valve-position"}
        for r in rows:
            if r["entity_id"] not in targets and not spec.params.get("all"):
                continue
            if self._cls(r["entity_id"], r["field"]) in zero_cls:
                r["value"] = 0.0
        return rows

    def _f_contradictory(self, spec, rows, tmin):
        targets = self._target_assets(spec)
        for r in rows:
            if r["entity_id"] not in targets:
                continue
            cls = self._cls(r["entity_id"], r["field"])
            if cls == "run-status":
                r["value"] = 0.0
            elif cls in {"fan-speed", "speed-percentage"}:
                r["value"] = 7.0
            elif cls in {"power", "loading-percentage", "valve-position"}:
                r["value"] = 0.0
        return rows

    def _f_controller_outage(self, spec, rows, tmin):
        assets = self._target_assets(spec)
        return [r for r in rows if r["entity_id"] not in assets]

    def _f_counter_reset(self, spec, rows, tmin):
        targets = self._target_assets(spec)
        counters = [
            r
            for r in rows
            if self._cls(r["entity_id"], r["field"]) == "energy-kwh"
            and (not targets or r["entity_id"] in targets or spec.params.get("any"))
        ]
        if not counters:
            counters = [r for r in rows if self._cls(r["entity_id"], r["field"]) == "energy-kwh"]
        if not counters:
            return rows
        offset = spec.state.get("offset")
        if offset is None:
            offset = max(abs(float(r["value"] or 0.0)) for r in counters)
            spec.state["offset"] = offset
        for r in counters:
            r["value"] = float(r["value"] or 0.0) - offset
        return rows

    def _f_flatline(self, spec, rows, tmin):
        targets = self._target_assets(spec)
        field_hint = spec.params.get("field")
        frozen: dict[tuple[str, str], float] = spec.state.setdefault("frozen", {})
        for r in rows:
            if r["entity_id"] not in targets:
                continue
            cls = self._cls(r["entity_id"], r["field"])
            if field_hint:
                match = r["field"] == field_hint
            else:
                match = cls in _TEMP_CLS
            if not match:
                continue
            key = (r["entity_id"], r["field"])
            if key not in frozen:
                frozen[key] = float(r["value"] or 0.0)
            r["value"] = frozen[key]
        return rows

    def _f_negative_kw(self, spec, rows, tmin):
        targets = self._target_assets(spec)
        for r in rows:
            if r["entity_id"] in targets and self._cls(r["entity_id"], r["field"]) == "power":
                r["value"] = -1.21
        return rows

    def _f_lead_chiller_trip(self, spec, rows, tmin):
        lead = spec.target or (self.engine.chillers[0].id if self.engine.chillers else None)
        standby = None
        for a in self.engine.chillers:
            if a.id != lead:
                standby = a.id
                break
        lead_power = {
            r["time"]: r["value"]
            for r in rows
            if r["entity_id"] == lead and self._cls(r["entity_id"], r["field"]) == "power"
        }
        for r in rows:
            cls = self._cls(r["entity_id"], r["field"])
            if r["entity_id"] == lead:
                if cls == "run-status" or cls in {"power", "loading-percentage"}:
                    r["value"] = 0.0
                elif cls == "fault-alarm":
                    r["value"] = 1.0
            elif standby and r["entity_id"] == standby:
                if cls == "run-status":
                    r["value"] = 1.0
                elif cls == "power":
                    r["value"] = float(lead_power.get(r["time"], 30.0) or 30.0)
                elif cls == "loading-percentage":
                    r["value"] = 45.0
        return rows

    def _f_valve_saturation(self, spec, rows, tmin):
        targets = self._target_assets(spec)
        for r in rows:
            if r["entity_id"] in targets and self._cls(r["entity_id"], r["field"]) == "valve-position":
                r["value"] = max(97.0, float(r["value"] or 0.0))
        return rows

    def _f_low_delta_t(self, spec, rows, tmin):
        targets = self._target_assets(spec)
        leave = {
            r["time"]: r["value"]
            for r in rows
            if r["entity_id"] in targets and self._cls(r["entity_id"], r["field"]) == "chilled-water-supply-temp"
        }
        for r in rows:
            if r["entity_id"] in targets and self._cls(r["entity_id"], r["field"]) == "chilled-water-return-temp":
                base = leave.get(r["time"])
                if base is not None:
                    r["value"] = float(base) + 1.0
        return rows

    def _f_tower_fouling(self, spec, rows, tmin):
        offset = 0.01 * max(0, tmin - spec.start)
        for r in rows:
            cls = self._cls(r["entity_id"], r["field"])
            if cls in {"condenser-water-supply-temp", "condenser-water-return-temp"}:
                r["value"] = float(r["value"] or 0.0) + offset
        return rows

    # -- time helper ---------------------------------------------------
    @staticmethod
    def _shift(iso: str, minutes: int) -> str:
        try:
            dt = datetime.fromisoformat(iso)
        except ValueError:
            return iso
        return (dt + timedelta(minutes=minutes)).isoformat()
