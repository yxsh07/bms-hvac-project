/**
 * Report schemas (§7.9, §7.7)
 *
 * Covers:
 *  - GET  /reports              → list available report definitions
 *  - POST /reports/:key/run     → queue a report run
 *  - GET  /reports/runs/:id     → poll status and download link
 *
 * Roles: all roles can run reports; export is restricted (§7.7).
 */

import { z } from 'zod';

// ── Report key enum ───────────────────────────────────────────────────────────

export const ReportKeySchema = z.enum([
  /** Energy consumption summary per floor/zone. */
  'energy-summary',
  /** Plant efficiency: SEC, COP, staging history. */
  'plant-efficiency',
  /** Setpoint change history and outcomes. */
  'setpoint-history',
  /** Alarm frequency and acknowledgement SLA. */
  'alarm-frequency',
  /** Data coverage / quality report. */
  'data-quality',
  /** Audit export (human-readable). */
  'audit-export',
  /** Override and schedule activity. */
  'override-schedule',
]);
export type ReportKey = z.infer<typeof ReportKeySchema>;

// ── Report definition (static metadata) ──────────────────────────────────────

export const ReportParameterSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'datetime', 'enum']),
  required: z.boolean(),
  /** Allowed values when type = "enum". */
  options: z.array(z.string()).optional(),
  /** Default value (serialised as string). */
  default: z.string().optional(),
});
export type ReportParameter = z.infer<typeof ReportParameterSchema>;

export const ReportDefinitionSchema = z.object({
  key: ReportKeySchema,
  title: z.string().min(1),
  description: z.string(),
  /** Supported export formats. */
  formats: z.array(z.enum(['json', 'csv', 'xlsx'])),
  parameters: z.array(ReportParameterSchema),
  /** Minimum role required to run this report (all roles if absent). */
  minRole: z.string().optional(),
});
export type ReportDefinition = z.infer<typeof ReportDefinitionSchema>;

// ── Run request ───────────────────────────────────────────────────────────────

export const RunReportRequestSchema = z.object({
  siteId: z.string().min(1),
  from: z.string().datetime(),
  to: z.string().datetime(),
  format: z.enum(['json', 'csv', 'xlsx']).default('json'),
  /** Report-specific parameters (validated server-side against the definition). */
  params: z.record(z.string(), z.unknown()).optional(),
});
export type RunReportRequest = z.infer<typeof RunReportRequestSchema>;

// ── Run status ────────────────────────────────────────────────────────────────

export const ReportRunStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
]);
export type ReportRunStatus = z.infer<typeof ReportRunStatusSchema>;

export const ReportRunSchema = z.object({
  id: z.string().min(1),
  reportKey: ReportKeySchema,
  status: ReportRunStatusSchema,
  siteId: z.string().min(1),
  requestedBy: z.string().min(1),
  requestedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  /** Signed download URL (pre-signed S3 or similar). Present only when status = completed. */
  downloadUrl: z.string().url().nullable(),
  /** MIME type of the download. */
  contentType: z.string().nullable(),
  /** Row count in the output. Present only when status = completed. */
  rowCount: z.number().int().nonnegative().nullable(),
  /** Format used. */
  format: z.enum(['json', 'csv', 'xlsx']),
  /** Error message when status = failed. */
  errorMessage: z.string().nullable(),
  params: z.record(z.string(), z.unknown()).optional(),
});
export type ReportRun = z.infer<typeof ReportRunSchema>;

// ── List definitions response ─────────────────────────────────────────────────

export const ReportDefinitionListResponseSchema = z.object({
  reports: z.array(ReportDefinitionSchema),
});
export type ReportDefinitionListResponse = z.infer<typeof ReportDefinitionListResponseSchema>;

// ── List runs response ────────────────────────────────────────────────────────

export const ReportRunListQuerySchema = z.object({
  reportKey: ReportKeySchema.optional(),
  status: ReportRunStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
});
export type ReportRunListQuery = z.infer<typeof ReportRunListQuerySchema>;

export const ReportRunListResponseSchema = z.object({
  items: z.array(ReportRunSchema),
  nextCursor: z.string().nullable(),
});
export type ReportRunListResponse = z.infer<typeof ReportRunListResponseSchema>;
