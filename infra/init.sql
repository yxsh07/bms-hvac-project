-- Create databases
SELECT 'CREATE DATABASE site_store'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'site_store')\gexec

SELECT 'CREATE DATABASE app_store'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'app_store')\gexec

-- Connect to site_store and create tables
\c site_store;

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS points (
  seq         BIGSERIAL,
  time        TIMESTAMPTZ NOT NULL,
  measurement TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  field       TEXT NOT NULL,
  value       DOUBLE PRECISION,
  is_delayed  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (time, seq)
);

CREATE INDEX IF NOT EXISTS ON points (seq);
SELECT create_hypertable('points', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- Connect to app_store and create tables
\c app_store;

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Telemetry tables with quality
CREATE TABLE IF NOT EXISTS telemetry (
  seq            BIGSERIAL,
  time           TIMESTAMPTZ NOT NULL,
  entity_id      TEXT NOT NULL,
  field          TEXT NOT NULL,
  value          DOUBLE PRECISION,
  raw_value      DOUBLE PRECISION,
  quality_code   SMALLINT NOT NULL DEFAULT 0,
  quality_flags  TEXT[] DEFAULT '{}',
  is_delayed     BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (time, seq)
);

CREATE INDEX IF NOT EXISTS ON telemetry (seq);
SELECT create_hypertable('telemetry', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- Hourly rollups
CREATE TABLE IF NOT EXISTS telemetry_hourly (
  time           TIMESTAMPTZ NOT NULL,
  entity_id      TEXT NOT NULL,
  field          TEXT NOT NULL,
  count          BIGINT NOT NULL,
  sum            DOUBLE PRECISION NOT NULL,
  min            DOUBLE PRECISION NOT NULL,
  max            DOUBLE PRECISION NOT NULL,
  late_samples   BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (time, entity_id, field)
);

SELECT create_hypertable('telemetry_hourly', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- Daily rollups
CREATE TABLE IF NOT EXISTS telemetry_daily (
  time           TIMESTAMPTZ NOT NULL,
  entity_id      TEXT NOT NULL,
  field          TEXT NOT NULL,
  count          BIGINT NOT NULL,
  sum            DOUBLE PRECISION NOT NULL,
  min            DOUBLE PRECISION NOT NULL,
  max            DOUBLE PRECISION NOT NULL,
  late_samples   BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (time, entity_id, field)
);

SELECT create_hypertable('telemetry_daily', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- Ingest cursor and report
CREATE TABLE IF NOT EXISTS ingest_cursor (
  id             TEXT PRIMARY KEY,
  cursor_seq     BIGINT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingest_report (
  id             BIGSERIAL PRIMARY KEY,
  run_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entities_total INTEGER NOT NULL,
  entities_new   INTEGER NOT NULL,
  rows_processed BIGINT NOT NULL,
  errors         JSONB
);

-- Alarms
CREATE TABLE IF NOT EXISTS alarms (
  id             BIGSERIAL PRIMARY KEY,
  entity_id      TEXT NOT NULL,
  alarm_type     TEXT NOT NULL,
  severity       TEXT NOT NULL,
  message        TEXT,
  raised_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cleared_at     TIMESTAMPTZ,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ON alarms (entity_id, raised_at);

-- Audit chain
CREATE TABLE IF NOT EXISTS audit_chain (
  seq            BIGSERIAL PRIMARY KEY,
  prev_hash      TEXT NOT NULL,
  payload_hash   TEXT NOT NULL,
  payload        JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Set-point requests
CREATE TABLE IF NOT EXISTS setpoint_requests (
  id              TEXT PRIMARY KEY,
  entity_id       TEXT NOT NULL,
  field           TEXT NOT NULL,
  proposed_value  DOUBLE PRECISION NOT NULL,
  safe_min        DOUBLE PRECISION,
  safe_max        DOUBLE PRECISION,
  proposed_by     TEXT NOT NULL,
  proposed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'PENDING',
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  applied_at      TIMESTAMPTZ,
  readback_value  DOUBLE PRECISION,
  readback_at     TIMESTAMPTZ,
  error_code      TEXT,
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS ON setpoint_requests (entity_id, field, status);

-- Report runs
CREATE TABLE IF NOT EXISTS report_runs (
  id              BIGSERIAL PRIMARY KEY,
  report_type     TEXT NOT NULL,
  site_id         TEXT NOT NULL,
  window_start    TIMESTAMPTZ NOT NULL,
  window_end      TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'QUEUED',
  requested_by    TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  output_path     TEXT,
  error           TEXT
);

-- Controllers
CREATE TABLE IF NOT EXISTS controllers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  asset_ids       TEXT[] NOT NULL DEFAULT '{}',
  last_seen       TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'unknown'
);