import { isRequestOriginAllowed } from './origin-check.middleware';

describe('isRequestOriginAllowed', () => {
  const allowedOrigins = new Set([
    'http://localhost:4200',
    'http://localhost:3000',
  ]);

  it('allows safe methods regardless of origin', () => {
    expect(
      isRequestOriginAllowed(
        'GET',
        'https://untrusted.example',
        allowedOrigins,
      ),
    ).toBe(true);
  });

  it('allows unsafe methods from configured origins', () => {
    expect(
      isRequestOriginAllowed('POST', 'http://localhost:4200', allowedOrigins),
    ).toBe(true);
  });

  it('rejects unsafe methods from unconfigured origins', () => {
    expect(
      isRequestOriginAllowed(
        'POST',
        'https://untrusted.example',
        allowedOrigins,
      ),
    ).toBe(false);
  });

  it('allows requests without an Origin header for non-browser API clients', () => {
    expect(isRequestOriginAllowed('POST', undefined, allowedOrigins)).toBe(
      true,
    );
  });
});
