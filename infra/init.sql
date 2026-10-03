CREATE DATABASE site_store;
\c site_store;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE points (
  seq BIGSERIAL,
  time TIMESTAMPTZ NOT NULL,
  measurement TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  value DOUBLE PRECISION,
  is_delayed BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (time, seq)
);
SELECT create_hypertable('points', 'time', chunk_time_interval => INTERVAL '1 day');
CREATE INDEX ON points (seq);
