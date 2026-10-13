"""Physics-lite simulation engine.

One sim-minute per ``step``.  State:

* weather  - diurnal dry-bulb / RH from the calibration profile
* zones    - first-order RC model, PI valve toward a zone set point
* plant    - CHW load -> TR -> staging -> efficiency curve -> tower approach

The engine emits *raw rows only*; the fault layer mutates the emitted rows
and never the physics state (PLAN 6.5).  All randomness is stateless hashing
of ``(seed, entity, field, t)`` so replay and ``seek`` are exact.
"""

from __future__ import annotations

import copy
import math
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np

from .clock import SimClock
from .envelope import evaluate_envelope
from .faults import FaultLayer
from .noise import hash_noise
from .profile import (
    Ontology,
    Profile,
    load_catalogue,
    load_ontology,
    load_profile,
    resolve_target,
)
from .scenarios import ScenarioRunner
from .writer import Writer

# The label every what-if surface must carry (PLAN 5.9, 6.4).
WHATIF_LABEL = "indicative, 3-day calibration"

# Set-point roles a what-if may change, and the classes that map to them.
_CHW_SETPOINTS = {"setpoint-chw-temp", "chw-leaving-temp"}
_AREA_SETPOINTS = {"setpoint-area-temp", "area-temp-setpoint"}

# Temperature classes that a stopped unit may report as 0.0 (PLAN 3.2).
_WATER_TEMPS = {
    "chilled-water-supply-temp",
    "chilled-water-return-temp",
    "condenser-water-supply-temp",
    "condenser-water-return-temp",
}


def stull_wet_bulb(dry_bulb_c: float, rh_pct: float) -> float:
    """Stull (2011) approximation of wet-bulb temperature."""
    t = dry_bulb_c
    rh = max(1.0, min(100.0, rh_pct))
    tw = (
        t * math.atan(0.151977 * math.sqrt(rh + 8.313659))
        + math.atan(t + rh)
        - math.atan(rh - 1.676331)
        + 0.00391838 * (rh ** 1.5) * math.atan(0.023101 * rh)
        - 4.686035
    )
    return tw


class SimEngine:
    # Calibration constants (unitless tuning knobs, never site strings).
    EFF_CAPACITY_KW = 56.0     # effective lead capacity used by the staging rule
    PUMP_K = 0.375             # variable-flow pump rule: flow = K * Q**0.9
    APPROACH_A0 = 0.55
    APPROACH_A1 = 0.55
    EFF_A = 0.38
    EFF_B = 0.5
    EFF_P0 = 0.45
    EFF_COND = 0.004
    EFF_CHW = 0.012            # efficiency gain per K of CHW leaving-temperature lift
    ZONE_R = 2.5               # K per kW
    DEFAULT_SETPOINT = 22.0
    CHW_LEAVE_SETPOINT = 8.0
    SUBSTEPS = 1

    def __init__(
        self,
        seed: int = 1001,
        ontology: Ontology | None = None,
        profile: Profile | None = None,
        catalogue=None,
        clock: SimClock | None = None,
    ) -> None:
        self.ontology = ontology or load_ontology()
        self.profile = profile or load_profile()
        self.catalogue = catalogue or load_catalogue()
        self.clock = clock or SimClock()
        self.assets = sorted(self.ontology.assets, key=lambda a: a.id)
        self.writer = Writer()
        self.faults = FaultLayer(self)
        self.runner = ScenarioRunner(self, self.catalogue)

        self.chillers = [a for a in self.assets if a.type == "chiller"]
        self.cooling = self.ontology.cooling_assets
        self.tz = ZoneInfo(self.profile.site.timezone or self.ontology.timezone)

        zt = self.profile.airSide.zoneThermal
        self.R = self.ZONE_R
        self.C = zt.rcHours / self.R
        self.qmax = zt.qMaxKwPerZone
        self.gain = zt.internalGainKwPerZone
        self.Kp = zt.piKp
        self.Ki = zt.piKi
        self.aw = zt.antiWindupPct / 100.0
        self.lead_nameplate = self.profile.plant.leadChillerNameplateTr
        self.kw_per_tr = self.profile.plant.physics.kwPerTr
        self.kw_per_flow = self.profile.plant.physics.kwPerCubicMeterPerHourPerK

        self.reset(seed)

    # ------------------------------------------------------------------
    # lifecycle
    # ------------------------------------------------------------------
    def reset(self, seed: int | None = None) -> None:
        if seed is not None:
            self.seed = int(seed)
        n = len(self.cooling)
        self.zone_ids = [a.id for a in self.cooling]
        self.zone_index = {aid: i for i, aid in enumerate(self.zone_ids)}
        self.Tsp = np.array([self._zone_setpoint(a) for a in self.cooling], dtype=float)
        self.Tz = self.Tsp + np.array(
            [0.4 * hash_noise(self.seed, a.id, "T0") for a in self.cooling],
            dtype=float,
        )
        self.integral = np.zeros(n, dtype=float)
        self.valve = np.zeros(n, dtype=float)
        self.Q = 0.0
        self.chw_setpoint = self.CHW_LEAVE_SETPOINT
        self.lag_on = False
        self._above = 0
        self._below = 0
        self._lag_change = -10_000
        self.plant_kwh = 0.0
        self.minutes = 0
        self.twb = 22.0
        self.modes: dict[str, str] = {}
        self.metrics = {
            "minutes": 0,
            "lag_on_minutes": 0,
            "dt_sum": 0.0,
            "dt_n": 0,
            "kw_sum": 0.0,
            "tr_sum": 0.0,
        }
        self.env_dbt: float | None = None
        self.env_rh: float | None = None
        self.env_occ: float = 1.0
        self.env_dbt_offset: float = 0.0
        self.runner.reset()

    def _zone_setpoint(self, asset) -> float:
        p = asset.point_by_cls("setpoint-area-temp")
        if p and p.safeMin is not None and p.safeMax is not None:
            return (p.safeMin + p.safeMax) / 2.0
        return self.DEFAULT_SETPOINT

    # ------------------------------------------------------------------
    # environment hooks (API + scenario runner)
    # ------------------------------------------------------------------
    def set_env(
        self,
        outdoor_dbt: float | None = None,
        rh: float | None = None,
        occupancy_mult: float | None = None,
    ) -> None:
        if outdoor_dbt is not None:
            self.env_dbt = float(outdoor_dbt)
        if rh is not None:
            self.env_rh = float(rh)
        if occupancy_mult is not None:
            self.env_occ = float(occupancy_mult)

    # ------------------------------------------------------------------
    # weather / occupancy
    # ------------------------------------------------------------------
    def _weather(self, local: datetime) -> tuple[float, float, float, float]:
        w = self.profile.weather
        hour = local.hour + local.minute / 60.0
        dbt_mid = (w.dryBulbMinC + w.dryBulbMaxC) / 2.0
        dbt_amp = (w.dryBulbMaxC - w.dryBulbMinC) / 2.0
        dbt = dbt_mid + dbt_amp * math.cos(2 * math.pi * (hour - w.peakHourLocal) / 24.0)
        dbt += self.env_dbt_offset
        if self.env_dbt is not None:
            dbt = self.env_dbt
        rh_mid = (w.rhMinPct + w.rhMaxPct) / 2.0
        rh_amp = (w.rhMaxPct - w.rhMinPct) / 2.0
        rh = rh_mid + rh_amp * math.cos(2 * math.pi * (hour - w.rhPeakHourLocal) / 24.0)
        if self.env_rh is not None:
            rh = self.env_rh
        rh = max(w.rhMinPct, min(w.rhMaxPct, rh))
        mult = self.profile.occupancy.hourlyMultiplier[int(local.hour) % 24]
        occ = mult * self.env_occ
        return dbt, rh, occ, stull_wet_bulb(dbt, rh)

    # ------------------------------------------------------------------
    # step
    # ------------------------------------------------------------------
    def step(self) -> list[dict[str, Any]]:
        ctx = self._advance()
        if ctx is None:
            return []
        t = self.clock.now()
        rows = self._emit(t, ctx)
        rows = self.faults.apply(rows, self.minutes)
        self.writer.add_many(rows)
        return rows

    def _advance(self) -> dict[str, Any] | None:
        """Advance the physics one sim-minute and return its context.

        No rows are emitted and no faults are applied, so ``what-if`` can step
        a clone cheaply and read physics aggregates only (PLAN 6.3).  ``step``
        wraps this with emission; the two must stay in lock-step.
        """
        if self.clock.paused:
            return None
        self.minutes += 1
        self.clock.step(1)
        self.runner.tick(self.minutes)
        t = self.clock.now()
        local = t.astimezone(self.tz)
        dbt, rh, occ, twb = self._weather(local)
        self.twb = twb

        # --- zones: first-order RC + PI valve (vectorised) -------------
        err = self.Tz - self.Tsp
        self.integral = np.clip(self.integral + self.Ki * err, 0.0, self.aw)
        self.valve = np.clip(self.Kp * err + self.integral, 0.0, 1.0)
        qcool = self.valve * self.qmax
        qenv = (dbt - self.Tz) / self.R
        qint = self.gain * occ
        dt_hours = 1.0 / 60.0
        self.Tz = self.Tz + (dt_hours / self.C) * (qenv + qint - qcool)
        self.Q = float(qcool.sum())

        # --- staging ---------------------------------------------------
        self._update_staging()

        # --- plant -----------------------------------------------------
        q_lead = self.Q
        q_lag = 0.0
        if self.lag_on and len(self.chillers) > 1:
            q_lead = 0.6 * self.Q
            q_lag = 0.4 * self.Q

        chiller_ctx: dict[str, dict[str, float] | None] = {}
        for a in self.chillers:
            chiller_ctx[a.id] = None
        if self.chillers:
            chiller_ctx[self.chillers[0].id] = self._chiller_detail(self.chillers[0], q_lead, twb)
        if len(self.chillers) > 1:
            chiller_ctx[self.chillers[1].id] = self._chiller_detail(self.chillers[1], q_lag, twb)
        for a in self.chillers[2:]:
            chiller_ctx[a.id] = None

        # metrics (fault-free ground truth)
        self.metrics["minutes"] += 1
        if self.lag_on:
            self.metrics["lag_on_minutes"] += 1
        for detail in chiller_ctx.values():
            if detail is not None and detail["running"]:
                self.metrics["dt_sum"] += detail["dt"]
                self.metrics["dt_n"] += 1
                self.metrics["kw_sum"] += detail["kw"]
                self.metrics["tr_sum"] += detail["tr"]

        chiller_kw = sum(
            d["kw"] for d in chiller_ctx.values() if d is not None
        )
        pumps = [a for a in self.assets if a.has_cls("differential-pressure") or a.type == "condenser-water-pump"]
        pump_kw = 2.2 * len(pumps) if self.Q > 0.5 else 0.4
        tower_kw = 0.05 * self.Q
        total_kw = chiller_kw + pump_kw + tower_kw
        self.plant_kwh += total_kw / 60.0
        cop = (self.Q / self.kw_per_tr) / chiller_kw if chiller_kw > 0.01 else 0.0

        ctx = {
            "dbt": dbt,
            "rh": rh,
            "twb": twb,
            "occ": occ,
            "Q": self.Q,
            "total_kw": total_kw,
            "kwh": self.plant_kwh,
            "cop": cop,
            "chiller": chiller_ctx,
            "running": {},
        }
        for a in self.cooling:
            i = self.zone_index[a.id]
            ctx["running"][a.id] = True
            ctx.setdefault("zone", {})[a.id] = {
                "temp": float(self.Tz[i]),
                "valve": float(self.valve[i]),
                "setpoint": float(self.Tsp[i]),
            }
        for a in self.chillers:
            ctx["running"][a.id] = chiller_ctx.get(a.id) is not None

        return ctx

    def sample(self, ctx: dict[str, Any]) -> dict[str, Any]:
        """Aggregate one step's physics into the what-if overlay shape."""
        details = [d for d in ctx["chiller"].values() if d is not None]
        delta_t = sum(d["dt"] for d in details) / len(details) if details else 0.0
        tr = sum(d["tr"] for d in details)
        lead = ctx["chiller"].get(self.chillers[0].id) if self.chillers else None
        return {
            "t": self.clock.now().astimezone(timezone.utc).isoformat(),
            "kw": round(float(ctx["total_kw"]), 3),
            "deltaTC": round(float(delta_t), 3),
            "tr": round(float(tr), 3),
            "chwLeavingC": round(float(lead["tleave"]), 3) if lead else None,
            "condenserEnteringC": round(float(lead["tcond"]), 3) if lead else None,
        }

    def _update_staging(self) -> None:
        st = self.profile.plant.station
        load_pct = 100.0 * self.Q / self.EFF_CAPACITY_KW
        min_onoff = st.minOnOffMinutes
        if self.lag_on:
            if load_pct < st.lagUnstageLoadPct:
                self._below += 1
                if (
                    self._below >= st.lagUnstageMinutes
                    and (self.minutes - self._lag_change) >= min_onoff
                ):
                    self.lag_on = False
                    self._lag_change = self.minutes
                    self._below = 0
            else:
                self._below = 0
        else:
            if load_pct > st.lagStageLoadPct:
                self._above += 1
                if self._above >= st.lagStageMinutes:
                    self.lag_on = True
                    self._lag_change = self.minutes
                    self._above = 0
            else:
                self._above = 0

    def _chiller_detail(self, asset, q: float, twb: float) -> dict[str, float] | None:
        if q <= 0.01:
            return None
        tr = q / self.kw_per_tr
        plr = tr / self.lead_nameplate if self.lead_nameplate else 0.0
        approach = (
            self.APPROACH_A0
            + self.APPROACH_A1 * (q / self.EFF_CAPACITY_KW)
            + 0.15 * hash_noise(self.seed, asset.id, "approach", self.minutes)
        )
        tcond = twb + approach
        tleave = self.chw_setpoint + 0.15 * hash_noise(self.seed, asset.id, "leave", self.minutes)
        eff = (
            self.EFF_A
            + self.EFF_B * (plr - self.EFF_P0) ** 2
            + self.EFF_COND * (tcond - 24.0)
        )
        # A higher CHW leaving temperature improves the evaporator approach and
        # so the COP; the term is zero at the calibrated baseline set point.
        eff -= self.EFF_CHW * (tleave - self.CHW_LEAVE_SETPOINT)
        eff = max(0.15, eff)
        flow = self.PUMP_K * (q ** 0.9)
        dt = q / (self.kw_per_flow * flow) if flow > 0 else 0.0
        dt += 0.25 * hash_noise(self.seed, asset.id, "dt", self.minutes)
        dt = max(self.profile.plant.leadChiller.deltaTMinC,
                 min(self.profile.plant.leadChiller.deltaTMaxC, dt))
        crange = self.profile.plant.condenser.rangeMeanC + 0.4 * hash_noise(
            self.seed, asset.id, "range", self.minutes
        )
        return {
            "running": True,
            "q": q,
            "tr": tr,
            "plr": plr,
            "kw": tr * eff,
            "eff": eff,
            "dt": dt,
            "tleave": tleave,
            "treturn": tleave + dt,
            "tcond": tcond,
            "range": crange,
            "load": 100.0 * tr / self.lead_nameplate if self.lead_nameplate else 0.0,
        }

    # ------------------------------------------------------------------
    # row emission
    # ------------------------------------------------------------------
    def _emit(self, t: datetime, ctx: dict[str, Any]) -> list[dict[str, Any]]:
        ts = t.astimezone(timezone.utc).isoformat()
        rows: list[dict[str, Any]] = []
        for asset in self.assets:
            for point in asset.points:
                value = self._value(asset, point, ctx)
                rows.append(
                    {
                        "time": ts,
                        "measurement": "components",
                        "entity_id": asset.id,
                        "field": point.abbr,
                        "value": None if value is None else float(value),
                        "is_delayed": False,
                    }
                )
        return rows

    def _value(self, asset, point, ctx: dict[str, Any]) -> float | None:
        cls = point.cls
        noise = hash_noise(self.seed, asset.id, point.abbr, self.minutes)

        if cls == "run-status":
            return 1.0 if ctx["running"].get(asset.id, True) else 0.0
        if cls == "fault-alarm":
            return 0.0

        if asset.type == "chiller":
            d = ctx["chiller"].get(asset.id)
            if d is None:
                # stopped unit baseline: process values report 0.0
                if cls in _WATER_TEMPS or cls in {
                    "power",
                    "loading-percentage",
                    "condenser-water-return-temp",
                }:
                    return 0.0
                if cls == "setpoint-chw-temp":
                    return self.chw_setpoint
                return 0.0
            if cls == "chilled-water-supply-temp":
                return d["tleave"]
            if cls == "chilled-water-return-temp":
                return d["treturn"]
            if cls == "condenser-water-supply-temp":
                return d["tcond"]
            if cls == "condenser-water-return-temp":
                return d["tcond"] + d["range"]
            if cls == "power":
                return d["kw"]
            if cls == "loading-percentage":
                return d["load"]
            if cls == "setpoint-chw-temp":
                return self.chw_setpoint
            return 0.0

        if cls == "valve-position":
            z = ctx["zone"].get(asset.id)
            return None if z is None else max(0.0, min(100.0, z["valve"] * 100.0))
        if cls == "area-temp":
            if asset.type == "dashboard":
                zs = [z["temp"] for z in ctx["zone"].values()]
                return sum(zs) / len(zs) if zs else 25.0
            z = ctx["zone"].get(asset.id)
            return None if z is None else z["temp"]
        if cls in {"fan-speed", "speed-percentage"}:
            if asset.type == "cooling-tower":
                return 60.0 + 20.0 * noise
            z = ctx["zone"].get(asset.id)
            if z is not None:
                return max(0.0, min(100.0, 35.0 + 65.0 * z["valve"] + 2.0 * noise))
            return 70.0 + 10.0 * noise
        if cls == "supply-air-temp":
            z = ctx["zone"].get(asset.id)
            sp = z["setpoint"] if z else self.DEFAULT_SETPOINT
            return max(10.0, min(24.0, sp - 8.0 + 0.3 * noise))
        if cls == "return-air-temp":
            z = ctx["zone"].get(asset.id)
            return None if z is None else z["temp"]
        if cls == "setpoint-area-temp":
            z = ctx["zone"].get(asset.id)
            return None if z is None else z["setpoint"]
        if cls == "setpoint-supply-air":
            return 16.0
        if cls == "area-humidity":
            return ctx["rh"]
        if cls == "differential-pressure":
            return 120.0 + 20.0 * noise
        if cls == "power":  # dashboard total
            return ctx["total_kw"]
        if cls == "energy-kwh":
            return ctx["kwh"]
        if cls == "cop":
            return ctx["cop"]
        return 0.0

    # ------------------------------------------------------------------
    # introspection
    # ------------------------------------------------------------------
    def lag_alone_share(self) -> float:
        m = self.metrics
        if not m["minutes"]:
            return 0.0
        return 1.0 - (m["lag_on_minutes"] / m["minutes"])

    def mean_dt(self) -> float:
        m = self.metrics
        return m["dt_sum"] / m["dt_n"] if m["dt_n"] else 0.0

    def mean_efficiency(self) -> float:
        m = self.metrics
        return m["kw_sum"] / m["tr_sum"] if m["tr_sum"] else 0.0

    def run(self, minutes: int, writer: Writer | None = None) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for _ in range(int(minutes)):
            out = self.step()
            rows.extend(out)
            if writer is not None:
                writer.add_many(out)
        return rows

    def state(self) -> dict[str, Any]:
        env = self.environment()
        return {
            **self.clock.state(),
            "seed": self.seed,
            "minutes": self.minutes,
            "ingestLagSeconds": 0.0,
            "leadChillerId": self.chillers[0].id if self.chillers else None,
            "lagOn": self.lag_on,
            "chwLoadKw": self.Q,
            "conditions": {"wetBulbC": env["wetBulbC"]},
            # Environment block feeds the app's weather strip (§8.2).
            "outdoorDbtC": env["dryBulbC"],
            "relativeHumidityPct": env["relativeHumidityPct"],
            "occupancyMultiplier": env["occupancyMultiplier"],
            "wetBulbC": env["wetBulbC"],
            "modes": dict(self.modes),
            "scenario": self.runner.current_name,
            "faults": [f.id for f in self.faults.specs],
            "faultSpecs": [
                {
                    "id": f.id,
                    "type": f.type,
                    "target": f.raw_target,
                    "resolvedTarget": f.target,
                    "duration": f.duration,
                    "start": f.start,
                    "active": f.is_active(self.minutes),
                }
                for f in self.faults.specs
            ],
            "activeScenario": self.runner.current_name,
        }

    def environment(self) -> dict[str, float]:
        """The live environment block (weather strip + Sim Console readout).

        Uses the same weather curve the engine steps with, so a manual override
        (``set_env``) is reflected here too.  ``wetBulbC`` is the Stull value.
        """
        t = self.clock.now().astimezone(self.tz)
        dbt, rh, occ, twb = self._weather(t)
        return {
            "dryBulbC": round(float(dbt), 2),
            "relativeHumidityPct": round(float(rh), 1),
            "occupancyMultiplier": round(float(occ), 3),
            "wetBulbC": round(float(twb), 2),
        }

    def fault_types(self) -> list[str]:
        """The fault types the layer implements, derived from its handlers."""
        prefix = "_f_"
        return sorted(
            name[len(prefix):].replace("_", "-")
            for name in dir(self.faults)
            if name.startswith(prefix)
        )

    # ------------------------------------------------------------------
    # what-if (PLAN 5.9, 6.3; task WIF1)
    # ------------------------------------------------------------------
    def __deepcopy__(self, memo: dict[int, Any]) -> SimEngine:
        """Copy the engine without dragging a live DB connection along.

        ``what-if`` deep-copies the whole engine graph; the writer is the one
        field that must not be shared or copied (it may hold a psycopg
        connection), so a fresh in-memory writer is attached to the clone.
        """
        cls = type(self)
        clone = cls.__new__(cls)
        memo[id(self)] = clone
        for key, value in self.__dict__.items():
            if key == "writer":
                setattr(clone, key, Writer())
            else:
                setattr(clone, key, copy.deepcopy(value, memo))
        return clone

    def _fingerprint(self) -> tuple[Any, ...]:
        """Cheap signature of live physics state, to prove no mutation."""
        return (
            self.minutes,
            round(self.Q, 6),
            round(self.plant_kwh, 6),
            self.lag_on,
            round(self.chw_setpoint, 6),
            tuple(float(x) for x in self.Tz),
            tuple(float(x) for x in self.valve),
        )

    def set_setpoint(self, target: str | None, kind: str, value: float) -> None:
        """Apply a proposed set-point change to this (cloned) engine.

        Only set-point roles the engine models are accepted; the caller maps
        the point/role to a logical kind first.  Raises ValueError otherwise so
        the API can answer 422 instead of silently ignoring the request.
        """
        resolved = resolve_target(target, self.ontology) if target else None
        if kind in _CHW_SETPOINTS and (
            resolved is None or resolved in {a.id for a in self.chillers}
        ):
            self.chw_setpoint = float(value)
            return
        if kind in _AREA_SETPOINTS and resolved in self.zone_index:
            self.Tsp[self.zone_index[resolved]] = float(value)
            return
        raise ValueError(f"unsupported set-point change: target={target!r} kind={kind!r}")

    def _apply_whatif_change(self, clone: SimEngine, change: dict[str, Any]) -> None:
        kind = change.get("type") or change.get("kind")
        if kind == "env":
            clone.set_env(
                change.get("outdoor_dbt"),
                change.get("rh"),
                change.get("occupancy_mult"),
            )
        elif kind == "fault":
            clone.faults.add(
                change.get("fault"),
                change.get("target"),
                change.get("params"),
                change.get("durationMin"),
                start_min=0,
            )
        elif kind == "setpoint":
            target = change.get("target") or change.get("asset")
            field = change.get("field") or change.get("role") or "setpoint-chw-temp"
            if change.get("value") is None:
                raise ValueError("setpoint change requires a value")
            clone.set_setpoint(str(target) if target else None, str(field), float(change["value"]))
        elif kind == "mode":
            target = change.get("target") or change.get("asset")
            if target and change.get("controlType"):
                clone.modes[str(target)] = str(change["controlType"])
        else:
            raise ValueError(f"unknown change type: {kind!r}")

    def _simulate_series(self, clone: SimEngine, horizon_min: int, step_min: int) -> list[dict[str, Any]]:
        """Step a clone forward and sample the plant aggregates.

        Uses ``_advance`` directly: no rows are emitted and no faults are
        applied, so the prediction reflects physics only and stays cheap.
        """
        series: list[dict[str, Any]] = []
        for minute in range(1, horizon_min + 1):
            ctx = clone._advance()
            if ctx is None:
                break
            if minute == horizon_min or minute % step_min == 0:
                series.append(clone.sample(ctx))
        return series

    @staticmethod
    def _series_summary(series: list[dict[str, Any]]) -> dict[str, Any]:
        if not series:
            return {"meanKw": 0.0, "peakKw": 0.0, "meanDeltaTC": 0.0, "points": 0}
        return {
            "meanKw": round(sum(s["kw"] for s in series) / len(series), 3),
            "peakKw": round(max(s["kw"] for s in series), 3),
            "meanDeltaTC": round(sum(s["deltaTC"] for s in series) / len(series), 3),
            "points": len(series),
        }

    def whatif(
        self,
        changes: list[dict[str, Any]] | None,
        horizon_min: int = 60,
        step_minutes: int = 5,
    ) -> dict[str, Any]:
        """Copy the state, step it forward with the proposed changes, never touch live.

        Two clones are stepped over the same horizon: one unchanged (baseline)
        and one with ``changes`` applied (predicted).  The live engine is never
        stepped and its physics fingerprint is checked before and after.
        """
        horizon = max(1, min(1440, int(horizon_min)))
        step = max(1, min(horizon, int(step_minutes or 5)))
        before = self._fingerprint()

        baseline = copy.deepcopy(self)
        baseline.clock.paused = False
        predicted = copy.deepcopy(self)
        predicted.clock.paused = False
        for change in changes or []:
            if not isinstance(change, dict):
                raise TypeError("each change must be an object")
            self._apply_whatif_change(predicted, change)

        baseline_series = self._simulate_series(baseline, horizon, step)
        predicted_series = self._simulate_series(predicted, horizon, step)
        envelope = evaluate_envelope(self.profile, predicted_series)

        after = self._fingerprint()
        baseline_summary = self._series_summary(baseline_series)
        predicted_summary = self._series_summary(predicted_series)
        return {
            "label": WHATIF_LABEL,
            "horizonMin": horizon,
            "stepMinutes": step,
            "siteId": self.ontology.site.id,
            "changes": changes or [],
            "liveStateUnchanged": before == after,
            "baseline": baseline_summary,
            "predicted": {**predicted_summary, "series": predicted_series},
            "baselineSeries": baseline_series,
            "delta": {
                "meanKw": round(predicted_summary["meanKw"] - baseline_summary["meanKw"], 3),
                "meanDeltaTC": round(
                    predicted_summary["meanDeltaTC"] - baseline_summary["meanDeltaTC"], 3
                ),
            },
            "envelope": envelope,
            "warning": envelope["warning"],
            # Compatibility with the earlier endpoint shape (test_api).
            "points": predicted_summary["points"],
        }
