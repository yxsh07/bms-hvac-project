"""Simulation clock.

The clock is the only holder of simulated time.  Physics never reads the
wall clock; it reads this object.  ``scale`` is the playback speed (1x to
600x) and is informational for the engine - the engine always steps in
whole sim-minutes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

DEFAULT_START = datetime(2026, 7, 12, 0, 0, 0, tzinfo=timezone.utc)

_MIN = timedelta(minutes=1)


def _parse(iso: str) -> datetime:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@dataclass
class SimClock:
    scale: float = 1.0
    paused: bool = False
    sim_time: datetime = field(default_factory=lambda: DEFAULT_START)
    sim_minute: int = 0

    def __post_init__(self) -> None:
        self.scale = float(min(600.0, max(1.0, self.scale)))
        self.sim_time = self.sim_time.replace(second=0, microsecond=0)
        self.sim_time = self.sim_time.astimezone(timezone.utc)

    def now(self) -> datetime:
        return self.sim_time

    def step(self, minutes: int = 1) -> datetime:
        if not self.paused and minutes:
            self.sim_time = self.sim_time + _MIN * int(minutes)
            self.sim_minute += int(minutes)
        return self.sim_time

    def seek(self, iso: str) -> datetime:
        dt = _parse(iso).replace(second=0, microsecond=0)
        self.sim_time = dt
        self.sim_minute = int(
            (dt - DEFAULT_START).total_seconds() // 60
        )
        return self.sim_time

    def state(self) -> dict[str, Any]:
        return {
            "scale": self.scale,
            "paused": self.paused,
            "simTime": self.sim_time.isoformat(),
            "simMinute": self.sim_minute,
        }
