"""API smoke tests (PLAN 6.3)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from sim.app import Settings, create_app


@pytest.fixture()
def client():
    app = create_app(Settings(seed=1001))
    with TestClient(app) as c:
        yield c


def test_clock_control(client):
    resp = client.post("/sim/clock", json={"scale": 60, "paused": False})
    assert resp.status_code == 200
    assert resp.json()["scale"] == 60
    state = client.get("/sim/state").json()
    assert state["clock"]["scale"] == 60
    assert state["clock"]["paused"] is False

    client.post("/sim/clock", json={"paused": True})
    assert client.get("/sim/state").json()["clock"]["paused"] is True

    client.post("/sim/clock", json={"seek": "2026-07-13T00:00:00+00:00"})
    assert client.get("/sim/state").json()["clock"]["simTime"].startswith("2026-07-13")


def test_scenario_start_stop(client):
    scenarios = client.get("/sim/scenarios").json()["scenarios"]
    assert any(s["name"] == "normal-day" for s in scenarios)

    started = client.post("/sim/scenarios/normal-day/start", json={"seed": 42})
    assert started.status_code == 200
    assert started.json()["started"] is True
    assert client.get("/sim/state").json()["scenario"] == "normal-day"

    stopped = client.post("/sim/scenarios/normal-day/stop")
    assert stopped.status_code == 200
    assert client.get("/sim/state").json()["scenario"] is None

    assert client.post("/sim/scenarios/nope/start", json={}).status_code == 404


def test_gateway_write_read_round_trip(client):
    assert client.put("/sim/gateway", json={"preset": "ok"}).status_code == 200
    write = client.post(
        "/gateway/write",
        json={
            "asset": "chiller-01",
            "point": "CHWSSP",
            "value": 7.5,
            "idempotencyKey": "k-1",
        },
    )
    assert write.status_code == 202
    assert write.json()["applied"] is True

    read = client.get("/gateway/read", params={"asset": "chiller-01", "point": "CHWSSP"})
    assert read.status_code == 200
    assert read.json()["value"] == 7.5

    # idempotent replay returns the same response and does not re-apply
    replay = client.post(
        "/gateway/write",
        json={
            "asset": "chiller-01",
            "point": "CHWSSP",
            "value": 9.9,
            "idempotencyKey": "k-1",
        },
    )
    assert replay.status_code == 202
    assert client.get("/gateway/read", params={"asset": "chiller-01", "point": "CHWSSP"}).json()["value"] == 7.5


def test_gateway_reject_preset(client):
    client.put("/sim/gateway", json={"preset": "reject"})
    resp = client.post(
        "/gateway/write",
        json={"asset": "chiller-01", "point": "CHWSSP", "value": 7.0},
    )
    assert resp.status_code == 409
    assert resp.json()["status"] == "rejected"


def test_gateway_ignore_and_local_mode(client):
    client.put("/sim/gateway", json={"preset": "ignore"})
    resp = client.post("/gateway/write", json={"asset": "chiller-01", "point": "CHWSSP", "value": 6.0})
    assert resp.status_code == 202
    assert resp.json()["applied"] is False
    assert client.get("/gateway/read", params={"asset": "chiller-01", "point": "CHWSSP"}).json()["value"] is None

    client.post("/sim/modes", json={"asset": "chiller-01", "controlType": "Local"})
    client.put("/sim/gateway", json={"preset": "local-mode"})
    resp = client.post("/gateway/write", json={"asset": "chiller-01", "point": "CHWSSP", "value": 6.0})
    assert resp.status_code == 409


def test_checklist_post_get(client):
    listing = client.get("/sim/checklist").json()["features"]
    assert any(f["featureId"] == "live-value" for f in listing)
    resp = client.post(
        "/sim/checklist",
        json={"featureId": "live-value", "status": "pass", "runId": "run-1", "evidence": "trace.zip"},
    )
    assert resp.status_code == 200
    listing = client.get("/sim/checklist").json()["features"]
    entry = next(f for f in listing if f["featureId"] == "live-value")
    assert entry["status"] == "pass"
    assert entry["runId"] == "run-1"


def test_faults_add_and_delete(client):
    added = client.post("/sim/faults", json={"type": "sentinel", "target": "lead-chiller"})
    assert added.status_code == 200
    fault_id = added.json()["id"]
    assert client.delete(f"/sim/faults/{fault_id}").json()["removed"] is True
    assert client.delete(f"/sim/faults/{fault_id}").status_code == 404


def test_env_and_whatif(client):
    env = client.post("/sim/env", json={"outdoor_dbt": 40.0, "rh": 30.0, "occupancy_mult": 1.2})
    assert env.status_code == 200
    assert env.json()["outdoor_dbt"] == 40.0

    whatif = client.post("/sim/whatif", json={"changes": [], "horizonMin": 30})
    assert whatif.status_code == 200
    assert whatif.json()["horizonMin"] == 30
    assert whatif.json()["points"] > 0
