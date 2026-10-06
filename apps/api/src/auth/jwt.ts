/**
 * Hand-rolled HS256 JWT (PLAN §7.9).
 *
 * `@fastify/jwt` is not installed offline, so signing/verification is done with
 * `node:crypto`. Access and refresh tokens share the payload shape from the
 * contracts package; a non-standard `typ` claim distinguishes them.
 */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { JwtPayloadSchema, type JwtPayload } from '@contracts';

export class TokenExpiredError extends Error {
  readonly code = 'TOKEN_EXPIRED';
  constructor(message = 'Token expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class TokenInvalidError extends Error {
  readonly code = 'TOKEN_INVALID';
  constructor(message = 'Token invalid') {
    super(message);
    this.name = 'TokenInvalidError';
  }
}

export type TokenType = 'access' | 'refresh';

export interface TokenClaims {
  sub: string;
  name: string;
  email: string;
  roles: JwtPayload['roles'];
  siteIds: string[];
  jti: string;
}

export interface SignOptions {
  expiresInSeconds: number;
  tokenType?: TokenType;
}

interface DecodedPayload extends JwtPayload {
  typ?: TokenType;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

/** New random token id (also used as the refresh-token family id). */
export function newJti(): string {
  return randomUUID();
}

/** Sign a JWT. `iat`/`exp` are derived from the current epoch. */
export function signToken(claims: TokenClaims, secret: string, opts: SignOptions): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: DecodedPayload = {
    ...claims,
    iat: now,
    exp: now + opts.expiresInSeconds,
    ...(opts.tokenType ? { typ: opts.tokenType } : {}),
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify a JWT and return its payload. Throws `TokenExpiredError` when the
 * `exp` claim is in the past and `TokenInvalidError` for any structural or
 * signature problem. The signature comparison is timing-safe.
 */
export function verifyToken(token: string, secret: string): DecodedPayload {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new TokenInvalidError('Malformed token');
  }
  const [encodedHeader, encodedPayload, signature] = parts;

  let header: { alg?: string };
  let payload: unknown;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf-8'));
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
  } catch {
    throw new TokenInvalidError('Malformed token payload');
  }
  if (header.alg !== 'HS256') throw new TokenInvalidError('Unsupported algorithm');

  const expected = Buffer.from(sign(`${encodedHeader}.${encodedPayload}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new TokenInvalidError('Invalid signature');
  }

  const parsed = JwtPayloadSchema.safeParse(payload);
  if (!parsed.success) throw new TokenInvalidError('Invalid token claims');

  const now = Math.floor(Date.now() / 1000);
  if (parsed.data.exp <= now) throw new TokenExpiredError();

  return { ...parsed.data, ...(isTokenType((payload as { typ?: unknown }).typ)) };
}

function isTokenType(value: unknown): { typ?: TokenType } {
  return value === 'access' || value === 'refresh' ? { typ: value } : {};
}

/** Decode without verifying (never trust the result for authz). */
export function decodeUnsafe(token: string): DecodedPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as DecodedPayload;
  } catch {
    return null;
  }
}
