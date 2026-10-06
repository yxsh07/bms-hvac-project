/**
 * Auth routes (§7.9): login, refresh (with rotation + reuse detection), logout.
 */

import type { FastifyInstance } from 'fastify';
import {
  ErrorCode,
  LoginRequestSchema,
  LogoutRequestSchema,
  RefreshRequestSchema,
  type LoginResponse,
  type Role,
} from '@contracts';
import { newJti, signToken, TokenExpiredError, TokenInvalidError, verifyToken } from '../auth/jwt.js';
import { verifyPassword } from '../auth/passwords.js';
import type { UserRecord } from '../store/types.js';
import { HttpError } from '../util/errors.js';
import { parse, type RouteDeps } from './guards.js';

interface IssuedTokens {
  tokens: LoginResponse;
  refreshJti: string;
}

function claimsFor(user: UserRecord) {
  return {
    sub: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles as Record<string, Role>,
    siteIds: user.siteIds,
  };
}

async function issueTokens(deps: RouteDeps, user: UserRecord): Promise<IssuedTokens> {
  const accessJti = newJti();
  const refreshJti = newJti();
  const accessToken = signToken({ ...claimsFor(user), jti: accessJti }, deps.config.jwtSecret, {
    expiresInSeconds: deps.config.accessTokenTtlSeconds,
    tokenType: 'access',
  });
  const refreshToken = signToken({ ...claimsFor(user), jti: refreshJti }, deps.config.jwtSecret, {
    expiresInSeconds: deps.config.refreshTokenTtlSeconds,
    tokenType: 'refresh',
  });
  const now = Date.now();
  await deps.store.saveRefreshToken({
    jti: refreshJti,
    userId: user.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + deps.config.refreshTokenTtlSeconds * 1000).toISOString(),
    revokedAt: null,
    replacedBy: null,
  });
  return {
    tokens: { accessToken, refreshToken, expiresIn: deps.config.accessTokenTtlSeconds },
    refreshJti,
  };
}

function mapTokenError(err: unknown): HttpError {
  if (err instanceof TokenExpiredError) {
    return new HttpError(401, ErrorCode.TOKEN_EXPIRED, 'Refresh token expired');
  }
  if (err instanceof TokenInvalidError) {
    return new HttpError(401, ErrorCode.TOKEN_INVALID, 'Refresh token invalid');
  }
  return new HttpError(401, ErrorCode.TOKEN_INVALID, 'Refresh token invalid');
}

export function registerAuthRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const device = (request: { headers: Record<string, unknown> }): string | null =>
    (request.headers['user-agent'] as string | undefined) ?? null;

  app.post('/auth/login', async (request) => {
    const body = parse(LoginRequestSchema, request.body);
    const user = await deps.store.findUserByEmail(body.email);
    const ok = user ? await verifyPassword(body.password, user.passwordHash) : false;

    if (!user || !ok) {
      await deps.chain.append({
        siteId: user?.siteIds[0] ?? deps.config.siteId,
        eventType: 'auth.login_failed',
        actorId: user?.id ?? null,
        actorEmail: body.email,
        ip: request.ip,
        device: device(request),
        resource: 'auth:login',
        action: 'login',
        before: null,
        after: null,
      });
      throw new HttpError(401, ErrorCode.UNAUTHORIZED, 'Invalid email or password');
    }

    const issued = await issueTokens(deps, user);
    await deps.chain.append({
      siteId: user.siteIds[0] ?? deps.config.siteId,
      eventType: 'auth.login',
      actorId: user.id,
      actorEmail: user.email,
      ip: request.ip,
      device: device(request),
      resource: `user:${user.id}`,
      action: 'login',
      before: null,
      after: null,
    });
    return issued.tokens;
  });

  app.post('/auth/refresh', async (request) => {
    const body = parse(RefreshRequestSchema, request.body);
    let payload;
    try {
      payload = verifyToken(body.refreshToken, deps.config.jwtSecret);
    } catch (err) {
      throw mapTokenError(err);
    }
    if (payload.typ !== 'refresh') {
      throw new HttpError(401, ErrorCode.TOKEN_INVALID, 'Not a refresh token');
    }

    const stored = await deps.store.getRefreshToken(payload.jti);
    if (!stored) throw new HttpError(401, ErrorCode.TOKEN_INVALID, 'Refresh token unknown');
    if (stored.revokedAt) {
      await deps.chain.append({
        siteId: deps.config.siteId,
        eventType: 'auth.login_failed',
        actorId: payload.sub,
        actorEmail: payload.email,
        ip: request.ip,
        device: device(request),
        resource: `refresh-token:${payload.jti}`,
        action: 'refresh_reuse',
        before: null,
        after: null,
      });
      throw new HttpError(401, ErrorCode.REFRESH_TOKEN_REUSED, 'Refresh token has already been used');
    }

    const user = await deps.store.getUser(payload.sub);
    if (!user) throw new HttpError(401, ErrorCode.USER_NOT_FOUND, 'User no longer exists');

    const issued = await issueTokens(deps, user);
    await deps.store.revokeRefreshToken(payload.jti, issued.refreshJti);
    await deps.chain.append({
      siteId: user.siteIds[0] ?? deps.config.siteId,
      eventType: 'auth.login',
      actorId: user.id,
      actorEmail: user.email,
      ip: request.ip,
      device: device(request),
      resource: `user:${user.id}`,
      action: 'refresh',
      before: null,
      after: null,
    });
    return issued.tokens;
  });

  app.post('/auth/logout', async (request, reply) => {
    const body = parse(LogoutRequestSchema, request.body);
    try {
      const payload = verifyToken(body.refreshToken, deps.config.jwtSecret);
      await deps.store.revokeRefreshToken(payload.jti);
      await deps.chain.append({
        siteId: deps.config.siteId,
        eventType: 'auth.logout',
        actorId: payload.sub,
        actorEmail: payload.email,
        ip: request.ip,
        device: device(request),
        resource: `user:${payload.sub}`,
        action: 'logout',
        before: null,
        after: null,
      });
    } catch {
      // Logout is idempotent: an invalid token is already logged out.
    }
    reply.code(204).send();
  });
}
