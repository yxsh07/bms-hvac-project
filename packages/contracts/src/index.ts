/**
 * packages/contracts — single source of truth for API shapes (§7.1).
 *
 * Every route handler, driver and client codes against these zod schemas.
 * The generated typed client lives in ./client and is produced by
 * `pnpm -w run generate:client`.
 */

export * from './ontology.js';
export * from './telemetry.js';
export * from './setpoint.js';
export * from './audit.js';
export * from './auth.js';
export * from './errors.js';
export * from './gateway.js';
export * from './alarm.js';
export * from './report.js';
export * from './whatif.js';
