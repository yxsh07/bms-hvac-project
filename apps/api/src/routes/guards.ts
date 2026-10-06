/**
 * Shared route guards: authentication, authorization (with audited denials),
 * request parsing and cache headers.
 */

import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { ZodType } from 'zod';
import type { Role } from '@contracts';
import type { AuditChain } from '../audit/chain.js';
import type { LoadedConfig } from '../config.js';
import type { PointRolesData } from '../domain/classify.js';
import type { Store } from '../store/types.js';
import { verifyToken, TokenExpiredError, TokenInvalidError } from '../auth/jwt.js';
import { Actions, can, type Action } from '../auth/rbac.js';
import { badRequest, forbidden, HttpError, unauthorized } from '../util/errors.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: Record<string, Role>;
  siteIds: string[];
  tokenType: 'access' | 'refresh' | undefined;
  /** Role resolved for the current site when the request is site-scoped. */
  siteRole?: Role;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
    routeDeps?: RouteDeps;
  }
}

export interface RouteDeps {
  config: LoadedConfig;
  store: Store;
  chain: AuditChain;
  setpoints: import('../services/setpoints.js').SetpointService;
  ontology: import('@ontology').Ontology;
  pointRoles: PointRolesData;
  clock: () => string;
}

/** Parse with a zod schema, converting failures to a VALIDATION_ERROR. */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

/** Verify the access token and attach the user to the request. */
export function authenticate(deps: RouteDeps): preHandlerHookHandler {
  return async (request) => {
    const token = bearerToken(request);
    if (!token) throw unauthorized();
    try {
      const payload = verifyToken(token, deps.config.jwtSecret);
      request.authUser = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        roles: payload.roles,
        siteIds: payload.siteIds,
        tokenType: payload.typ,
      };
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new HttpError(401, 'TOKEN_EXPIRED', 'Access token expired');
      }
      throw new HttpError(401, 'TOKEN_INVALID', 'Access token invalid');
    }
  };
}

/** Resolve the caller's role for a site (falling back to a wildcard role). */
export function roleForSite(user: AuthUser, siteId: string): Role | undefined {
  return user.roles[siteId] ?? user.roles['*'];
}

/**
 * Authorize an action for the request's site. Denials are audited before the
 * 403 is thrown (PLAN §7.7).
 */
export function authorize(deps: RouteDeps, action: Action): preHandlerHookHandler {
  return async (request: FastifyRequest) => {
    const user = request.authUser;
    if (!user) throw unauthorized();
    const params = (request.params ?? {}) as Record<string, string>;
    const siteId = params.siteId ?? params.s ?? deps.config.siteId;
    const role = roleForSite(user, siteId);
    if (!role || !can(role, action)) {
      await deps.chain.append({
        siteId,
        eventType: 'authz.denied',
        actorId: user.id,
        actorEmail: user.email,
        ip: request.ip,
        device: request.headers['user-agent'] ?? null,
        resource: request.url,
        action,
        before: { role: role ?? null, action },
        after: null,
      });
      throw forbidden();
    }
    user.siteRole = role;
  };
}

/** Enforce that the request carries an Idempotency-Key (§7.1). */
export function requireIdempotency(request: FastifyRequest): string {
  const key = request.headers['idempotency-key'];
  const value = Array.isArray(key) ? key[0] : key;
  if (!value || value.trim() === '') {
    throw badRequest('Idempotency-Key header is required for this request');
  }
  return value;
}

/** Cache-Control per §7.9. */
export function setCache(reply: FastifyReply, policy: 'ontology' | 'telemetry' | 'latest' | 'no-store'): void {
  const value =
    policy === 'ontology'
      ? 'private, max-age=300'
      : policy === 'telemetry'
        ? 'private, max-age=300'
        : policy === 'latest'
          ? 'private, max-age=15'
          : 'no-store';
  reply.header('Cache-Control', value);
}

export { Actions };
