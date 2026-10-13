"""FastAPI application for SimSite (PLAN 6.3).

``app = create_app()`` at module level so ``uvicorn sim.app:app`` works.
CORS is wide open for local development only.
"""

from __future__ import annotations

import asyncio
import os
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass, field
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .checklist import Checklist
from .clock import SimClock
from .engine import SimEngine
from .gateway import Gateway
from .profile import (
    load_catalogue,
    load_features,
    load_ontology,
    load_profile,
    resolve_target,
)


@dataclass
class Settings:
    seed: int = 1001
    data_dir: str | None = None
    cors_origins: list[str] = field(default_factory=lambda: ["*"])


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    ontology = load_ontology()
    profile = load_profile()
    catalogue = load_catalogue()
    features = load_features()

    engine = SimEngine(
        seed=settings.seed,
        ontology=ontology,
        profile=profile,
        catalogue=catalogue,
        clock=SimClock(),
    )
    gateway = Gateway()
    checklist = Checklist(features)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        task: asyncio.Task[None] | None = None
        if os.getenv("SIM_AUTORUN") == "1":
            engine.runner.start(os.getenv("SIM_DEFAULT_SCENARIO", "normal-day"))
            engine.run(5)  # Prime the live API before the first ingest poll.

            async def advance_clock() -> None:
                carry = 0.0
                previous = time.monotonic()
                while True:
                    await asyncio.sleep(0.25)
                    now = time.monotonic()
                    elapsed = now - previous
                    previous = now
                    if engine.clock.paused:
                        carry = 0.0
                        continue
                    carry += elapsed * engine.clock.scale / 60.0
                    due = min(int(carry), 5)
                    if due:
                        engine.run(due)
                        carry -= due

            task = asyncio.create_task(advance_clock())
        try:
            yield
        finally:
            if task is not None:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task

    app = FastAPI(title="SimSite", version="1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.gateway = gateway
    app.state.checklist = checklist
    app.state.ontology = ontology
    app.state.profile = profile

    # ------------------------------------------------------------------
    # clock / state
    # ------------------------------------------------------------------
    @app.post("/sim/clock")
    async def set_clock(request: Request) -> dict[str, Any]:
        body = await _json(request)
        if "scale" in body and body["scale"] is not None:
            engine.clock.scale = float(min(600.0, max(1.0, float(body["scale"]))))
        if "paused" in body and body["paused"] is not None:
            engine.clock.paused = bool(body["paused"])
        if body.get("seek"):
            engine.clock.seek(str(body["seek"]))
        return engine.clock.state()

    @app.get("/sim/state")
    async def get_state() -> dict[str, Any]:
        return {"clock": engine.clock.state(), **engine.state()}

    # ------------------------------------------------------------------
    # scenarios
    # ------------------------------------------------------------------
    @app.get("/sim/scenarios")
    async def list_scenarios() -> dict[str, Any]:
        return {"scenarios": engine.runner.list(), "active": engine.runner.current_name}

    @app.post("/sim/scenarios/{name}/start")
    async def start_scenario(name: str, request: Request) -> dict[str, Any]:
        body = await _json(request)
        seed = body.get("seed")
        started = engine.runner.start(name, seed)
        if not started:
            raise HTTPException(status_code=404, detail=f"unknown scenario {name}")
        return {"started": True, "scenario": name, "seed": engine.seed}

    @app.post("/sim/scenarios/{name}/stop")
    async def stop_scenario(name: str) -> dict[str, Any]:
        engine.runner.stop()
        return {"stopped": True, "scenario": name}

    # ------------------------------------------------------------------
    # faults
    # ------------------------------------------------------------------
    @app.post("/sim/faults")
    async def add_fault(request: Request) -> dict[str, Any]:
        body = await _json(request)
        if not body.get("type"):
            raise HTTPException(status_code=422, detail="type is required")
        fault_id = engine.faults.add(
            body["type"],
            body.get("target"),
            body.get("params"),
            body.get("duration"),
        )
        return {"id": fault_id, "active": len(engine.faults.specs)}

    @app.delete("/sim/faults/{fault_id}")
    async def delete_fault(fault_id: str) -> dict[str, Any]:
        removed = engine.faults.remove(fault_id)
        if not removed:
            raise HTTPException(status_code=404, detail=f"unknown fault {fault_id}")
        return {"removed": True, "id": fault_id}

    # ------------------------------------------------------------------
    # environment / modes
    # ------------------------------------------------------------------
    @app.post("/sim/env")
    async def set_env(request: Request) -> dict[str, Any]:
        body = await _json(request)
        engine.set_env(body.get("outdoor_dbt"), body.get("rh"), body.get("occupancy_mult"))
        return {
            "outdoor_dbt": engine.env_dbt,
            "rh": engine.env_rh,
            "occupancy_mult": engine.env_occ,
        }

    @app.post("/sim/modes")
    async def set_mode(request: Request) -> dict[str, Any]:
        body = await _json(request)
        asset = body.get("asset")
        control_type = body.get("controlType") or body.get("control_type")
        if not asset or not control_type:
            raise HTTPException(status_code=422, detail="asset and controlType are required")
        asset_id = resolve_target(str(asset), engine.ontology) or str(asset)
        engine.modes[asset_id] = str(control_type)
        gateway.set_control_type(asset_id, str(control_type))
        return {"asset": asset_id, "controlType": str(control_type)}

    # ------------------------------------------------------------------
    # gateway
    # ------------------------------------------------------------------
    @app.post("/gateway/write")
    async def gateway_write(request: Request) -> JSONResponse:
        body = await _json(request)
        asset = body.get("asset")
        point = body.get("point")
        if asset is None or point is None or body.get("value") is None:
            raise HTTPException(status_code=422, detail="asset, point and value are required")
        status, payload = gateway.write(
            str(asset), str(point), float(body["value"]), body.get("idempotencyKey")
        )
        return JSONResponse(status_code=status, content=payload)

    @app.get("/gateway/read")
    async def gateway_read(asset: str = Query(...), point: str = Query(...)) -> dict[str, Any]:
        return gateway.read(asset, point)

    @app.put("/sim/gateway")
    async def configure_gateway(request: Request) -> dict[str, Any]:
        body = await _json(request)
        try:
            return gateway.configure(
                body.get("preset"), body.get("latencyMs"), body.get("failureRate")
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

    # ------------------------------------------------------------------
    # what-if / checklist / helper
    # ------------------------------------------------------------------
    @app.post("/sim/whatif")
    async def whatif(request: Request) -> dict[str, Any]:
        body = await _json(request)
        try:
            horizon = int(body.get("horizonMin", 60))
            step = int(body.get("stepMinutes", 5))
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="horizonMin and stepMinutes must be integers")
        if not 1 <= horizon <= 1440:
            raise HTTPException(status_code=422, detail="horizonMin must be between 1 and 1440")
        try:
            return engine.whatif(body.get("changes"), horizon, step)
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=422, detail=str(exc))

    @app.get("/sim/checklist")
    async def get_checklist() -> dict[str, Any]:
        return checklist.get()

    @app.post("/sim/checklist")
    async def post_checklist(request: Request) -> dict[str, Any]:
        body = await _json(request)
        feature_id = body.get("featureId") or body.get("feature_id")
        if not feature_id:
            raise HTTPException(status_code=422, detail="featureId is required")
        return checklist.post(
            str(feature_id),
            str(body.get("status", "unknown")),
            body.get("runId"),
            body.get("evidence"),
        )

    @app.get("/sim/points")
    async def points() -> dict[str, Any]:
        """Test helper (not in the plan): list the emitted entity/point shape."""
        out = []
        for asset in engine.assets:
            out.append(
                {
                    "entityId": asset.id,
                    "type": asset.type,
                    "points": [p.abbr for p in asset.points],
                }
            )
        return {"entities": out, "count": len(out)}

    @app.post("/sim/run")
    async def run(request: Request) -> dict[str, Any]:
        """Advance the engine by N sim-minutes and flush the emitted rows.

        A dev/test affordance: the plan drives time via the scalable clock, but
        exposing an explicit step makes the Sim -> ingest -> API chain testable
        deterministically (gate G2).
        """
        body = await _json(request)
        minutes = max(0, min(10_080, int(body.get("minutes", 1))))
        rows = engine.run(minutes)
        return {"minutes": minutes, "emitted": len(rows), "total": len(engine.writer.recent(0))}

    @app.get("/sim/raw")
    async def raw(
        since: int = Query(0),
        limit: int = Query(10_000),
    ) -> dict[str, Any]:
        """Cursor view of the raw rows the writer would persist (dev/test helper).

        Rows are the fault-layer output, so they carry the same quality signals
        the real `site_store.points` writer emits. Cursor is `seq`.
        """
        combined = engine.writer.recent(0)
        out: list[dict[str, Any]] = []
        for i, r in enumerate(combined):
            seq = i + 1
            if seq <= since:
                continue
            if len(out) >= limit:
                break
            out.append(
                {
                    "seq": seq,
                    "time": r.time,
                    "measurement": r.measurement,
                    "entity_id": r.entity_id,
                    "field": r.field,
                    "value": r.value,
                    "is_delayed": r.is_delayed,
                }
            )
        cursor = out[-1]["seq"] if out else since
        return {"points": out, "cursor": cursor}

    return app


async def _json(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001 - malformed body falls back to empty
        return {}
    return body if isinstance(body, dict) else {}


app = create_app()
