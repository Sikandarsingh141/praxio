import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // The real API is deliberately not started: backend/.env targets a remote
  // Atlas database. Return an unauthenticated response without making requests.
  await page.route('**/api/**', async (route) => {
    const headers = {
      'access-control-allow-origin': 'http://localhost:4200',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers,
      body: JSON.stringify({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthenticated' }),
    });
  });
});

test('login page renders and rejects an empty submission in the browser', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  const email = page.getByLabel('Email address');
  const password = page.getByRole('textbox', { name: 'Password' });
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
  expect(await email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await page.screenshot({ path: 'artifacts/phase2-login-desktop.png', fullPage: true });
});

test('malformed login email is rejected before an authentication request', async ({ page }) => {
  const loginRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/auth/login')) loginRequests.push(request.url());
  });
  await page.goto('/auth/login');
  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByRole('textbox', { name: 'Password' }).fill('Arbitrary-test-only1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  expect(loginRequests).toEqual([]);
});

test('public registration entry points render without submitting account data', async ({ page }) => {
  await page.goto('/auth/register');
  await expect(page.getByRole('heading', { name: 'Create Your Fixroa Account' })).toBeVisible();
  await expect(page.getByText('Customer Account')).toBeVisible();
  await expect(page.getByText('Shop Account')).toBeVisible();

  await page.getByRole('link', { name: 'Continue as Customer' }).click();
  await expect(page.getByRole('heading', { name: 'Create your customer account' })).toBeVisible();
  await expect(page.locator('form')).toBeVisible();

  await page.getByRole('link', { name: 'Choose another account type' }).click();
  await page.getByRole('link', { name: 'Register as Shop' }).click();
  await expect(page.getByRole('heading', { name: 'Register your repair business' })).toBeVisible();
  await expect(page.locator('form')).toBeVisible();
});

test('empty customer registration shows required-field feedback without sending a request', async ({ page }) => {
  const registrationRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/auth/register')) registrationRequests.push(request.url());
  });
  await page.goto('/auth/register/customer');
  await page.getByRole('button', { name: 'Create Customer Account' }).click();
  await expect(page.getByText('Enter your first name (up to 50 characters).')).toBeVisible();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await expect(page.getByText('Enter a 10-digit mobile number.')).toBeVisible();
  await expect(page.getByText('You must accept the terms to continue.')).toBeVisible();
  expect(registrationRequests).toEqual([]);
});

test('customer, shop, and admin pages redirect unauthenticated users to login', async ({ page }) => {
  for (const path of [
    '/customer',
    '/customer/profile',
    '/customer/shops',
    '/shop',
    '/shop/profile',
    '/admin',
    '/admin/users',
    '/admin/repair-jobs',
    '/admin/disputes',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  }
});

test('login screen fits a narrow mobile viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  expect(await page.locator('body').evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/phase2-login-mobile.png', fullPage: true });
});

test('customer registration fits a tablet viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/auth/register/customer');
  await expect(page.getByRole('heading', { name: 'Create your customer account' })).toBeVisible();
  expect(await page.locator('body').evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(768);
  await page.screenshot({ path: 'artifacts/phase2-register-tablet.png', fullPage: true });
});
