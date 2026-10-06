"""Mock BMS gateway.

The gateway keeps the **actual equipment value** separate from the telemetry
stream (PLAN 6.3).  Writes are idempotent on ``idempotencyKey``.  Presets let
the e2e suite exercise every workflow state.
"""

from __future__ import annotations

from typing import Any, ClassVar


class Gateway:
    PRESETS: ClassVar[set[str]] = {"ok", "reject", "ignore", "apply-then-alarm", "drift", "local-mode"}

    def __init__(self) -> None:
        self.actual: dict[tuple[str, str], float] = {}
        self.preset: str = "ok"
        self.latency_ms: int = 0
        self.failure_rate: float = 0.0
        self.alarms: list[dict[str, Any]] = []
        self.control_types: dict[str, str] = {}
        self._idem: dict[str, tuple[int, dict[str, Any]]] = {}

    def set_control_type(self, asset: str, control_type: str) -> None:
        self.control_types[asset] = control_type

    def configure(
        self,
        preset: str | None = None,
        latency_ms: int | None = None,
        failure_rate: float | None = None,
    ) -> dict[str, Any]:
        if preset is not None:
            if preset not in self.PRESETS:
                raise ValueError(f"unknown preset: {preset}")
            self.preset = preset
        if latency_ms is not None:
            self.latency_ms = int(latency_ms)
        if failure_rate is not None:
            self.failure_rate = float(failure_rate)
        return self.state()

    def state(self) -> dict[str, Any]:
        return {
            "preset": self.preset,
            "latencyMs": self.latency_ms,
            "failureRate": self.failure_rate,
            "controlTypes": dict(self.control_types),
            "alarms": list(self.alarms),
        }

    def write(
        self,
        asset: str,
        point: str,
        value: float,
        idempotency_key: str | None = None,
    ) -> tuple[int, dict[str, Any]]:
        if idempotency_key and idempotency_key in self._idem:
            return self._idem[idempotency_key]

        preset = self.preset
        base = {"asset": asset, "point": point}
        if preset == "local-mode" and self.control_types.get(asset) == "Local":
            response: tuple[int, dict[str, Any]] = (
                409,
                {**base, "status": "rejected", "reason": "asset is in local mode"},
            )
        elif preset == "reject":
            response = (409, {**base, "status": "rejected", "reason": "gateway preset reject"})
        elif preset == "ignore":
            response = (202, {**base, "status": "accepted", "applied": False})
        elif preset == "drift":
            drifted = float(value) * 1.05 + 0.5
            self.actual[(asset, point)] = drifted
            response = (202, {**base, "status": "accepted", "applied": True, "drifted": True, "appliedValue": drifted})
        elif preset == "apply-then-alarm":
            self.actual[(asset, point)] = float(value)
            self.alarms.append({"asset": asset, "point": point, "value": float(value), "reason": "watch-window alarm"})
            response = (202, {**base, "status": "accepted", "applied": True, "alarm": True})
        else:  # ok
            self.actual[(asset, point)] = float(value)
            response = (202, {**base, "status": "accepted", "applied": True})

        if idempotency_key:
            self._idem[idempotency_key] = response
        return response

    def read(self, asset: str, point: str) -> dict[str, Any]:
        return {"asset": asset, "point": point, "value": self.actual.get((asset, point))}
