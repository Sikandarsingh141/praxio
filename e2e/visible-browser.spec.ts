import { chromium, expect, test } from '@playwright/test';

test('opens regular Chromium visibly and navigates to the local login page', async ({ page }) => {
  expect(chromium.executablePath().toLowerCase()).toMatch(/chrome-win64\\chrome\.exe$/);

  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': 'http://localhost:4200',
        'access-control-allow-credentials': 'true',
      },
      body: JSON.stringify({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Unauthenticated',
      }),
    }),
  );

  const response = await page.goto('/auth/login');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  expect(page.url()).toBe('http://localhost:4200/auth/login');
  await page.screenshot({ path: 'artifacts/visible-chromium-login.png', fullPage: true });
});
