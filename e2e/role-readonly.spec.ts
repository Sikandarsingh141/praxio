import { expect, test, type Page } from '@playwright/test';

type RoleAccount = {
  label: string;
  email?: string;
  password?: string;
  landing: RegExp;
  routes: string[];
};

const accounts: RoleAccount[] = [
  {
    label: 'Admin',
    email: process.env.FIXROA_QA_ADMIN_EMAIL,
    password: process.env.FIXROA_QA_ADMIN_PASSWORD,
    landing: /\/admin(?:\/|$)/,
    routes: ['/admin', '/admin/users', '/admin/repair-jobs', '/admin/disputes'],
  },
  ...[1, 2, 3].map((index) => ({
    label: `Shop ${index}`,
    email: process.env[`FIXROA_QA_SHOP_${index}_EMAIL`],
    password: process.env[`FIXROA_QA_SHOP_${index}_PASSWORD`],
    landing: /\/shop(?:\/|$)/,
    routes: [
      '/shop',
      '/shop/profile',
      '/shop/repair-requests',
      '/shop/quotations',
      '/shop/disputes',
      '/shop/messages',
      '/shop/reviews',
    ],
  })),
  {
    label: 'Customer',
    email: process.env.FIXROA_QA_CUSTOMER_EMAIL,
    password: process.env.FIXROA_QA_CUSTOMER_PASSWORD,
    landing: /\/customer(?:\/|$)/,
    routes: [
      '/customer',
      '/customer/profile',
      '/customer/shops',
      '/customer/repair-requests',
      '/customer/quotations',
      '/customer/disputes',
      '/customer/messages',
    ],
  },
];

async function configureReadOnlyGuard(page: Page): Promise<{
  blockedWrites: string[];
  apiFailures: string[];
  pageErrors: string[];
  consoleErrors: string[];
}> {
  const blockedWrites: string[] = [];
  const apiFailures: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    const method = response.request().method();
    const expectedGuardBlock = response.status() === 403 && blockedWrites.includes(`${method} ${url.pathname}`);
    if (url.pathname.startsWith('/api/') && response.status() >= 400 && !expectedGuardBlock) {
      apiFailures.push(`${method} ${url.pathname} ${response.status()}`);
    }
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    if (
      ['GET', 'HEAD', 'OPTIONS'].includes(method) ||
      (method === 'POST' && path === '/api/auth/login')
    ) {
      await route.continue();
      return;
    }

    blockedWrites.push(`${method} ${path}`);
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 403, message: 'Read-only QA guard' }),
    });
  });

  return { blockedWrites, apiFailures, pageErrors, consoleErrors };
}

for (const account of accounts) {
  test(`${account.label} can sign in and open role pages without forwarding writes`, async ({ page }) => {
    test.skip(!account.email || !account.password, 'Provide this approved account through QA environment variables.');
    test.setTimeout(120_000);

    const guard = await configureReadOnlyGuard(page);
    let loginStatus: number | undefined;
    page.on('response', (response) => {
      if (new URL(response.url()).pathname === '/api/auth/login') loginStatus = response.status();
    });

    await page.goto('/auth/login');
    await page.getByLabel('Email address').fill(account.email!);
    await page.getByRole('textbox', { name: 'Password' }).fill(account.password!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect.poll(() => loginStatus, { timeout: 60_000 }).toBe(200);
    await expect(page).toHaveURL(account.landing, { timeout: 15_000 });
    expect(loginStatus).toBe(200);

    for (const route of account.routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    }

    expect(guard.apiFailures).toEqual([]);
    expect(guard.pageErrors).toEqual([]);
    expect(guard.consoleErrors).toEqual([]);
    expect(guard.blockedWrites.every((request) => request !== 'POST /api/auth/login')).toBe(true);
  });
}
