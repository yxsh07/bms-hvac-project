/**
 * Auth schemas (§7.9, §7.7)
 *
 * Covers:
 *  - POST /auth/login   → LoginRequest / LoginResponse
 *  - POST /auth/refresh → RefreshRequest / LoginResponse (same shape)
 *  - POST /auth/logout  → LogoutRequest
 *  - JWT payload embedded in every access token
 *  - Five RBAC roles
 */

import { z } from 'zod';

// ── RBAC roles (§7.7) ────────────────────────────────────────────────────────

export const RoleSchema = z.enum([
  'admin',
  'engineer',
  'facility-manager',
  'operator',
  'executive',
]);
export type Role = z.infer<typeof RoleSchema>;

// ── JWT payload ───────────────────────────────────────────────────────────────

export const JwtPayloadSchema = z.object({
  /** Subject — the user's stable ID. */
  sub: z.string().min(1),
  /** User's display name. */
  name: z.string(),
  /** User's email. */
  email: z.string().email(),
  /** Role within each site the user has access to. */
  roles: z.record(z.string(), RoleSchema),
  /** Site IDs the user may access. */
  siteIds: z.array(z.string()),
  /** Issued-at epoch (seconds). */
  iat: z.number().int(),
  /** Expiry epoch (seconds). */
  exp: z.number().int(),
  /** Token family — used to detect refresh-token reuse. */
  jti: z.string(),
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

// ── Login ─────────────────────────────────────────────────────────────────────

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  /** Short-lived access token (e.g. 15 min). */
  accessToken: z.string(),
  /** Long-lived refresh token (httpOnly cookie in the reference impl; also in body for native clients). */
  refreshToken: z.string(),
  /** Access token TTL in seconds. */
  expiresIn: z.number().int().positive(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// ── Refresh ───────────────────────────────────────────────────────────────────

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

// Refresh response re-uses LoginResponse shape.
export const RefreshResponseSchema = LoginResponseSchema;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

// ── Logout ────────────────────────────────────────────────────────────────────

export const LogoutRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

// ── /me ───────────────────────────────────────────────────────────────────────

export const MeResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  /** Role per site. */
  roles: z.record(z.string(), RoleSchema),
  siteIds: z.array(z.string()),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

// ── User CRUD (admin only) ───────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  roles: z.record(z.string(), RoleSchema),
  siteIds: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.record(z.string(), RoleSchema),
  siteIds: z.array(z.string()),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export const UpdateUserRequestSchema = CreateUserRequestSchema.partial().omit({
  password: true,
});
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;
