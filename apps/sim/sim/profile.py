"""Profile loading and logical target resolution.

Everything the engine knows comes from three files:

* ``data/seed/ontology.json``   - assets, points, controllers (site model)
* ``data/calibration/profile.json`` - calibration parameters / acceptance targets
* ``data/scenarios/catalogue.yaml`` - scenario timelines

There are **no site strings** in the engine.  Scenarios and faults refer to
LOGICAL targets ("lead-chiller", "area-unit", "ctrl-plant", ...) which
``resolve_target`` maps onto real ids using generic asset ``type`` ordering.
"""

from __future__ import annotations

import os
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict


# --------------------------------------------------------------------------
# paths
# --------------------------------------------------------------------------
def repo_root() -> Path:
    # apps/sim/sim/profile.py -> repo root
    return Path(__file__).resolve().parents[3]


def data_dir() -> Path:
    env = os.environ.get("SIM_DATA_DIR")
    return Path(env) if env else repo_root() / "data"


def _ontology_path() -> Path:
    return data_dir() / "seed" / "ontology.json"


def _profile_path() -> Path:
    return data_dir() / "calibration" / "profile.json"


def _catalogue_path() -> Path:
    return data_dir() / "scenarios" / "catalogue.yaml"


def _features_path() -> Path:
    return data_dir() / "scenarios" / "features.yaml"


# --------------------------------------------------------------------------
# ontology
# --------------------------------------------------------------------------
class PointDef(BaseModel):
    model_config = ConfigDict(extra="ignore")

    abbr: str
    display: str = ""
    unit: str = ""
    group: str = ""
    cls: str = ""
    source: str = ""
    writable: bool = False
    safeMin: float | None = None
    safeMax: float | None = None


class Asset(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str = ""
    type: str
    criticality: str = ""
    zoneId: str | None = None
    floorId: str | None = None
    points: list[PointDef] = []

    def point(self, abbr: str) -> PointDef | None:
        for p in self.points:
            if p.abbr == abbr:
                return p
        return None

    def point_by_cls(self, cls: str) -> PointDef | None:
        for p in self.points:
            if p.cls == cls:
                return p
        return None

    def has_cls(self, cls: str) -> bool:
        return any(p.cls == cls for p in self.points)


class Controller(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str = ""
    deviceId: str | None = None
    assetIds: list[str] = []


class SiteInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = "site"
    name: str = ""
    timezone: str = "UTC"


class Ontology(BaseModel):
    model_config = ConfigDict(extra="ignore")

    site: SiteInfo = SiteInfo()
    floors: list[dict[str, Any]] = []
    zones: list[dict[str, Any]] = []
    assets: list[Asset] = []
    controllers: list[Controller] = []
    meters: list[dict[str, Any]] = []

    def asset(self, asset_id: str) -> Asset | None:
        for a in self.assets:
            if a.id == asset_id:
                return a
        return None

    def controller(self, controller_id: str) -> Controller | None:
        for c in self.controllers:
            if c.id == controller_id:
                return c
        return None

    def by_type(self, types: Iterable[str]) -> list[Asset]:
        wanted = set(types)
        return [a for a in self.assets if a.type in wanted]

    @property
    def cooling_assets(self) -> list[Asset]:
        """Assets that own a chilled-water valve (AHUs / FCUs)."""
        return [a for a in self.assets if a.has_cls("valve-position")]

    @property
    def timezone(self) -> str:
        return self.site.timezone or "UTC"


# --------------------------------------------------------------------------
# calibration profile
# --------------------------------------------------------------------------
class Weather(BaseModel):
    model_config = ConfigDict(extra="ignore")
    dryBulbMinC: float = 24.0
    dryBulbMaxC: float = 36.0
    peakHourLocal: int = 15
    troughHourLocal: int = 5
    rhMinPct: float = 35.0
    rhMaxPct: float = 85.0
    rhPeakHourLocal: int = 5
    rhTroughHourLocal: int = 15


class Occupancy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    hourlyMultiplier: list[float] = [1.0] * 24


class Station(BaseModel):
    model_config = ConfigDict(extra="ignore")
    leadAloneShare: float = 0.726
    leadLagShare: float = 0.272
    neitherShare: float = 0.002
    lagStageLoadPct: float = 85.0
    lagStageMinutes: int = 10
    lagUnstageLoadPct: float = 55.0
    lagUnstageMinutes: int = 15
    minOnOffMinutes: int = 10


class ChillerCal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    chwLeavingMeanC: float = 7.93
    chwLeavingMinC: float = 7.1
    chwLeavingMaxC: float = 12.1
    chwEnteringMeanC: float = 10.99
    deltaTMeanC: float = 3.06
    deltaTMinC: float = 1.3
    deltaTMaxC: float = 4.8
    outputMeanTr: float = 67.1
    outputMinTr: float = 0.0
    outputMaxTr: float = 181.0
    loadingMeanPct: float = 35.1
    efficiencyMeanIkwPerTr: float = 0.47
    meanKw: float = 32.6


class LagChillerCal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    runtimeShare: float = 0.272
    meanKw: float = 8.9


class CondenserCal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    approachMeanC: float = 1.0
    approachMinC: float = -1.0
    approachMaxC: float = 2.8
    rangeMeanC: float = 3.22
    enteringMinC: float = 21.0
    enteringMaxC: float = 30.0
    kwPerTrToCondenserSensitivityPerK: float = 0.025


class PhysicsCal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    kwPerCubicMeterPerHourPerK: float = 1.163
    kwPerTr: float = 3.517


class PlantCal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    chillers: int = 3
    lagChillerNameplateTr: float = 180.0
    leadChillerNameplateTr: float = 180.0
    airCooledChillerNameplateTr: float = 120.0
    station: Station = Station()
    leadChiller: ChillerCal = ChillerCal()
    lagChiller: LagChillerCal = LagChillerCal()
    condenser: CondenserCal = CondenserCal()
    physics: PhysicsCal = PhysicsCal()


class CriticalAhuCal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    valveMeanPct: float = 95.24
    valveAbove90Share: float = 0.86
    valveAtCapShare: float = 0.757
    returnAirRhMeanPct: float = 75.85
    supplyAirMeanC: float = 13.94
    returnAirMeanC: float = 18.81
    setpointC: float = 21.0


class ZoneThermal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    rcHours: float = 6.0
    internalGainKwPerZone: float = 1.4
    qMaxKwPerZone: float = 8.0
    piKp: float = 0.4
    piKi: float = 0.02
    antiWindupPct: float = 120.0


class AirSide(BaseModel):
    model_config = ConfigDict(extra="ignore")
    criticalAhu: CriticalAhuCal = CriticalAhuCal()
    zoneThermal: ZoneThermal = ZoneThermal()


class QualityRates(BaseModel):
    model_config = ConfigDict(extra="ignore")
    missingCadenceShare: float = 0.0021
    lateDataShare: float = 0.00181
    basementOutageCoverageLowPct: float = 7.1
    basementOutageCoverageHighPct: float = 11.8


class FaultDistribution(BaseModel):
    model_config = ConfigDict(extra="ignore")
    sentinel: float = 0.0008
    outOfRange: float = 0.0006
    droppedPolls: float = 0.0021
    delayedBackfill: float = 0.00181
    orphan: float = 0.0004
    stoppedZero: float = 0.0005
    contradictory: float = 0.0002
    controllerOutage: float = 0.0001
    counterReset: float = 0.0002
    flatline: float = 0.0003
    negativeKw: float = 0.0002


class ProfileSite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    timezone: str = "UTC"
    latitude: float = 0.0
    longitude: float = 0.0


class Profile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    profileVersion: str = ""
    cadenceSeconds: int = 60
    site: ProfileSite = ProfileSite()
    weather: Weather = Weather()
    occupancy: Occupancy = Occupancy()
    plant: PlantCal = PlantCal()
    airSide: AirSide = AirSide()
    qualityRates: QualityRates = QualityRates()
    faultDistribution: FaultDistribution = FaultDistribution()


# --------------------------------------------------------------------------
# scenarios
# --------------------------------------------------------------------------
class Event(BaseModel):
    model_config = ConfigDict(extra="allow")
    atMin: int = 0
    type: str


class Scenario(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    seed: int = 1
    tier: str = ""
    description: str = ""
    events: list[Event] = []


class Catalogue(BaseModel):
    model_config = ConfigDict(extra="ignore")
    scenarios: list[Scenario] = []


class Feature(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    scenario: str
    docRef: str = ""


class Features(BaseModel):
    model_config = ConfigDict(extra="ignore")
    features: list[Feature] = []


# --------------------------------------------------------------------------
# loaders
# --------------------------------------------------------------------------
def load_ontology(path: str | Path | None = None) -> Ontology:
    import json

    p = Path(path) if path else _ontology_path()
    with open(p, "r", encoding="utf-8") as fh:
        return Ontology.model_validate(json.load(fh))


def load_profile(path: str | Path | None = None) -> Profile:
    import json

    p = Path(path) if path else _profile_path()
    with open(p, "r", encoding="utf-8") as fh:
        return Profile.model_validate(json.load(fh))


def load_catalogue(path: str | Path | None = None) -> Catalogue:
    p = Path(path) if path else _catalogue_path()
    with open(p, "r", encoding="utf-8") as fh:
        return Catalogue.model_validate(yaml.safe_load(fh) or {})


def load_features(path: str | Path | None = None) -> Features:
    p = Path(path) if path else _features_path()
    with open(p, "r", encoding="utf-8") as fh:
        return Features.model_validate(yaml.safe_load(fh) or {})


# --------------------------------------------------------------------------
# logical target resolution
# --------------------------------------------------------------------------
# Logical name -> (acceptable generic asset types in priority order, index).
_ASSET_TARGETS: dict[str, tuple[tuple[str, ...], int]] = {
    "chiller": (("chiller",), 0),
    "lead-chiller": (("chiller",), 0),
    "standby-chiller": (("chiller",), 1),
    "lag-chiller": (("chiller",), 1),
    "air-cooled-chiller": (("air-cooled-chiller", "airCooledChiller", "air-cooled"), 0),
    "critical-ahu": (("critical-ahu", "criticalAhu", "ahu"), 0),
    "ahu": (("ahu",), 0),
    "area-unit": (("fcu", "vav", "fan-coil"), 0),
    "fcu": (("fcu", "vav", "fan-coil"), 0),
    "cooling-tower": (("cooling-tower",), 0),
    "chilled-water-pump": (("chilled-water-pump",), 0),
    "condenser-water-pump": (("condenser-water-pump",), 0),
    "plant": (("chiller",), 0),
}

# Controller logical roles resolved by ordering among controllers.
_CONTROLLER_TARGETS: dict[str, int] = {
    "ctrl-plant": 0,
    "ctrl-air": 1,
}


def resolve_target(
    name: str | None,
    ontology: Ontology,
    profile: Profile | None = None,
) -> str | None:
    """Map a logical target onto a real asset / controller id."""
    if not name:
        return None
    # A concrete id always wins.
    if ontology.asset(name) is not None:
        return name
    if ontology.controller(name) is not None:
        return name
    if name in _CONTROLLER_TARGETS:
        idx = _CONTROLLER_TARGETS[name]
        if idx < len(ontology.controllers):
            return ontology.controllers[idx].id
        return None
    if name in _ASSET_TARGETS:
        types, idx = _ASSET_TARGETS[name]
        matches = ontology.by_type(types)
        if idx < len(matches):
            return matches[idx].id
        # graceful fallback: the first match of any acceptable type
        return matches[0].id if matches else None
    return None


def assets_for_target(name: str | None, ontology: Ontology) -> list[str]:
    """Return every asset id a logical target covers (controllers expand)."""
    if not name:
        return []
    ctrl = ontology.controller(name)
    if ctrl is not None:
        return list(ctrl.assetIds)
    resolved = resolve_target(name, ontology)
    return [resolved] if resolved and ontology.asset(resolved) else []


def controller_for_asset(asset_id: str, ontology: Ontology) -> Controller | None:
    for c in ontology.controllers:
        if asset_id in c.assetIds:
            return c
    return None
