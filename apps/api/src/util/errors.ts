/**
 * HTTP error type used by every route and service.
 *
 * Errors always serialise to `{ error, code, detail? }` with stable machine
 * codes from the contracts package (PLAN §7.9).
 */

import { ErrorCode, type ApiError } from '@contracts';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  toBody(): ApiError {
    const body: ApiError = { error: this.message, code: this.code };
    if (this.detail) body.detail = this.detail;
    return body;
  }
}

export function badRequest(message: string, detail?: Record<string, unknown>): HttpError {
  return new HttpError(400, ErrorCode.VALIDATION_ERROR, message, detail);
}

export function unauthorized(message = 'Authentication required'): HttpError {
  return new HttpError(401, ErrorCode.UNAUTHORIZED, message);
}

export function forbidden(message = 'Permission denied'): HttpError {
  return new HttpError(403, ErrorCode.FORBIDDEN, message);
}

export function notFound(code: string, message: string): HttpError {
  return new HttpError(404, code, message);
}

export function conflict(code: string, message: string, detail?: Record<string, unknown>): HttpError {
  return new HttpError(409, code, message, detail);
}

export function unprocessable(code: string, message: string, detail?: Record<string, unknown>): HttpError {
  return new HttpError(422, code, message, detail);
}
