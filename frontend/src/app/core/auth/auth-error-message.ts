import { HttpErrorResponse } from '@angular/common/http';

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const body: unknown = error.error;
  if (!isRecord(body)) {
    return fallback;
  }
  const message = body['message'];
  const fieldErrors = body['fieldErrors'];
  if (
    typeof message !== 'string' ||
    (fieldErrors !== undefined &&
      (!Array.isArray(fieldErrors) ||
        !fieldErrors.every((item: unknown) => typeof item === 'string')))
  ) {
    return fallback;
  }
  return Array.isArray(fieldErrors) && fieldErrors.length
    ? fieldErrors.join(' ')
    : message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
