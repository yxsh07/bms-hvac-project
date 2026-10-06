-- 002_rollups.sql — continuous aggregates (PLAN §7.4).
--
-- Dashboards hit rollups, never raw data. Aggregate only good samples
-- (quality = 0) but count every sample so partial buckets are visible.
-- Refresh start_offset defaults to 48 h (the maximum accepted lateness);
-- anything older needs a manual refresh_continuous_aggregate.

DO $$
BEGIN
  PERFORM 1 FROM pg_extension WHERE extname = 'timescaledb';
  IF NOT FOUND THEN
    RAISE NOTICE '002_rollups: TimescaleDB not installed, skipping continuous aggregates';
    RETURN;
  END IF;

  -- Hourly rollup
  CREATE MATERIALIZED VIEW IF NOT EXISTS app_store.telemetry_hourly
  WITH (timescaledb.continuous) AS
  SELECT time_bucket(INTERVAL '1 hour', time) AS bucket,
         site_id, entity_id, field,
         avg(value) FILTER (WHERE quality = 0) AS avg_value,
         min(value) FILTER (WHERE quality = 0) AS min_value,
         max(value) FILTER (WHERE quality = 0) AS max_value,
         count(*)   FILTER (WHERE quality = 0) AS good_samples,
         count(*)   FILTER (WHERE is_delayed)  AS late_samples,
         count(*)                              AS total_samples
  FROM app_store.telemetry
  GROUP BY bucket, site_id, entity_id, field;

  -- Daily rollup
  CREATE MATERIALIZED VIEW IF NOT EXISTS app_store.telemetry_daily
  WITH (timescaledb.continuous) AS
  SELECT time_bucket(INTERVAL '1 day', time) AS bucket,
         site_id, entity_id, field,
         avg(value) FILTER (WHERE quality = 0) AS avg_value,
         min(value) FILTER (WHERE quality = 0) AS min_value,
         max(value) FILTER (WHERE quality = 0) AS max_value,
         count(*)   FILTER (WHERE quality = 0) AS good_samples,
         count(*)   FILTER (WHERE is_delayed)  AS late_samples,
         count(*)                              AS total_samples
  FROM app_store.telemetry
  GROUP BY bucket, site_id, entity_id, field;

  -- Refresh policies: start_offset >= maximum accepted lateness (48 h).
  PERFORM add_continuous_aggregate_policy('app_store.telemetry_hourly',
    start_offset => INTERVAL '48 hours',
    end_offset   => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '10 minutes');

  PERFORM add_continuous_aggregate_policy('app_store.telemetry_daily',
    start_offset => INTERVAL '48 hours',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

  -- Keep recent chunks uncompressed so late rows upsert cheaply.
  PERFORM set_chunk_time_interval('app_store.telemetry', INTERVAL '1 day');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '002_rollups: continuous aggregate setup skipped: %', SQLERRM;
END $$;
