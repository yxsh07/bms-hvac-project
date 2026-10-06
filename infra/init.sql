-- Bootstrap for the dev Timescale/Postgres container.
--
-- The logical databases in PLAN §2.1 are represented as schemas in ONE
-- database (the API opens a single DSN and uses `site_store.*` for the raw
-- client-shaped rows and `app_store.*` for normalised telemetry and app data).
-- The actual schema lives in apps/api/src/migrations/*.sql, which compose mounts
-- after this file. `$POSTGRES_DB` (app_store) is created by the postgres image.
--
-- The site_store `points` table in §6.2 is created by migration 001.

CREATE EXTENSION IF NOT EXISTS timescaledb;
