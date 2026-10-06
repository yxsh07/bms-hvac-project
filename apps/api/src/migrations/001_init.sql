-- 001_init.sql — initial schema for the BMS/HVAC API.
--
-- Two logical databases are represented as schemas in one Postgres instance:
--   site_store — the client-shaped raw `points` table (PLAN §6.2)
--   app_store  — normalised telemetry + application tables (PLAN §7.4)
--
-- Plain SQL only; no ORM. TimescaleDB is optional at this stage: the
-- hypertable calls are wrapped so a plain Postgres instance still initialises.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE SCHEMA IF NOT EXISTS site_store;
CREATE SCHEMA IF NOT EXISTS app_store;

-- ── site_store.points (§6.2) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS site_store.points (
  seq         BIGSERIAL,
  time        TIMESTAMPTZ NOT NULL,
  measurement TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  field       TEXT NOT NULL,
  value       DOUBLE PRECISION,
  is_delayed  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (time, seq)
);
CREATE INDEX IF NOT EXISTS points_seq_idx ON site_store.points (seq);

DO $$
BEGIN
  PERFORM create_hypertable('site_store.points', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'site_store.points: hypertable not created (TimescaleDB unavailable?)';
END $$;

-- ── app_store.telemetry (§7.4) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_store.telemetry (
  time        TIMESTAMPTZ NOT NULL,
  site_id     TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  entity_kind TEXT NOT NULL,
  field       TEXT NOT NULL,
  value       DOUBLE PRECISION,
  raw_value   DOUBLE PRECISION,
  quality     SMALLINT NOT NULL DEFAULT 0,
  is_delayed  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (site_id, entity_id, field, time)
);

DO $$
BEGIN
  PERFORM create_hypertable('app_store.telemetry', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'app_store.telemetry: hypertable not created (TimescaleDB unavailable?)';
END $$;

-- ── Identity and access ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_store.users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  roles         JSONB NOT NULL DEFAULT '{}'::jsonb,
  site_ids      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON app_store.users (lower(email));

CREATE TABLE IF NOT EXISTS app_store.user_sites (
  user_id TEXT NOT NULL REFERENCES app_store.users(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL,
  PRIMARY KEY (user_id, site_id)
);

CREATE TABLE IF NOT EXISTS app_store.refresh_tokens (
  jti         TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES app_store.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  replaced_by TEXT
);

-- ── Ontology materialisation ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_store.assets (
  site_id       TEXT NOT NULL,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  criticality   TEXT NOT NULL,
  zone_id       TEXT,
  floor_id      TEXT,
  controller_id TEXT,
  points        JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (site_id, id)
);
CREATE INDEX IF NOT EXISTS assets_site_type_idx ON app_store.assets (site_id, type);
CREATE INDEX IF NOT EXISTS assets_site_floor_idx ON app_store.assets (site_id, floor_id);

-- ── Set-point requests (§7.6) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_store.setpoint_requests (
  id                  TEXT PRIMARY KEY,
  site_id             TEXT NOT NULL,
  asset_id            TEXT NOT NULL,
  field               TEXT NOT NULL,
  state               TEXT NOT NULL,
  requested_value     DOUBLE PRECISION NOT NULL,
  before_value        DOUBLE PRECISION,
  after_value         DOUBLE PRECISION,
  proposer_id         TEXT NOT NULL,
  approver_id         TEXT,
  justification       TEXT NOT NULL,
  effective_from      TIMESTAMPTZ,
  revert_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason              TEXT,
  tolerance           DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  apply_deadline      TIMESTAMPTZ,
  apply_started_at    TIMESTAMPTZ,
  watch_until         TIMESTAMPTZ
);

-- One live request per point (PENDING / APPROVED / APPLYING) — §7.6.
CREATE UNIQUE INDEX IF NOT EXISTS setpoint_live_per_point_idx
  ON app_store.setpoint_requests (site_id, asset_id, field)
  WHERE state IN ('PENDING', 'APPROVED', 'APPLYING');

-- ── Audit chain (§7.8) ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_store.audit_log (
  id            TEXT PRIMARY KEY,
  site_id       TEXT NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL,
  event_type    TEXT NOT NULL,
  actor_id      TEXT,
  actor_email   TEXT,
  ip            TEXT,
  device        TEXT,
  resource      TEXT,
  action        TEXT,
  before        JSONB,
  after         JSONB,
  justification TEXT,
  approver_id   TEXT,
  signature     TEXT NOT NULL,
  seq           BIGINT NOT NULL,
  UNIQUE (site_id, seq)
);
CREATE INDEX IF NOT EXISTS audit_site_seq_idx ON app_store.audit_log (site_id, seq);

-- ── Ingest bookkeeping ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_store.ingest_cursor (
  site_id    TEXT PRIMARY KEY,
  cursor     TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_store.ingest_report (
  site_id    TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen  TIMESTAMPTZ NOT NULL,
  row_count  BIGINT NOT NULL DEFAULT 0,
  fields     JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (site_id, entity_id)
);

-- ── Reports ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_store.report_runs (
  id             TEXT PRIMARY KEY,
  report_key     TEXT NOT NULL,
  status         TEXT NOT NULL,
  site_id        TEXT NOT NULL,
  requested_by   TEXT NOT NULL,
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  download_url   TEXT,
  content_type   TEXT,
  row_count      INTEGER,
  format         TEXT NOT NULL DEFAULT 'json',
  error_message  TEXT,
  params         JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS report_runs_status_idx ON app_store.report_runs (status, requested_at);

-- ── Alarms ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_store.alarms (
  id               TEXT PRIMARY KEY,
  site_id          TEXT NOT NULL,
  asset_id         TEXT NOT NULL,
  asset_name       TEXT NOT NULL,
  field            TEXT,
  severity         TEXT NOT NULL,
  status           TEXT NOT NULL,
  message          TEXT NOT NULL,
  alarm_code       TEXT NOT NULL,
  raised_at        TIMESTAMPTZ NOT NULL,
  cleared_at       TIMESTAMPTZ,
  acknowledged_by  TEXT,
  acknowledged_at  TIMESTAMPTZ,
  acknowledge_note TEXT,
  context          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS alarms_site_status_idx ON app_store.alarms (site_id, status, raised_at);

-- ── Schedules / overrides (Should) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_store.schedules (
  id          TEXT PRIMARY KEY,
  site_id     TEXT NOT NULL,
  asset_id    TEXT NOT NULL,
  field       TEXT NOT NULL,
  cron        TEXT,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_store.overrides (
  id            TEXT PRIMARY KEY,
  site_id       TEXT NOT NULL,
  asset_id      TEXT NOT NULL,
  field         TEXT NOT NULL,
  value         DOUBLE PRECISION NOT NULL,
  justification TEXT,
  state         TEXT NOT NULL,
  created_by    TEXT,
  approved_by   TEXT,
  effective_from TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS overrides_active_idx ON app_store.overrides (site_id, state, expires_at);
