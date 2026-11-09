import { ForbiddenException } from '@nestjs/common';
import type { RequestHandler } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isRequestOriginAllowed(
  method: string,
  origin: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) {
    return true;
  }
  return origin === undefined || allowedOrigins.has(origin);
}

export function createOriginCheckMiddleware(
  allowedOrigins: ReadonlySet<string>,
): RequestHandler {
  return (request, _response, next): void => {
    if (
      !isRequestOriginAllowed(
        request.method,
        request.get('origin'),
        allowedOrigins,
      )
    ) {
      next(new ForbiddenException('Request origin is not allowed'));
      return;
    }
    next();
  };
}
