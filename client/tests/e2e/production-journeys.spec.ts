import { expect, test } from '@playwright/test';

async function navigateInApp(page: import('@playwright/test').Page, path: string) {
  await page.locator(`a[href="${path}"]`).first().evaluate((link: HTMLAnchorElement) => link.click());
  await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`));
}

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Varta-e2e-password-123!');
  const [loginRequest] = await Promise.all([
    page.waitForRequest((request) => new URL(request.url()).pathname === '/api/v1/auth/login'),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);
  expect(new URL(loginRequest.url()).origin).toBe(new URL(page.url()).origin);
  await expect(page).toHaveURL(/\/analytics/);
  await expect(page.getByRole('heading', { name: 'Analytics Overview' })).toBeVisible();
}

test.beforeEach(async ({ page }, testInfo) => {
  const variant = testInfo.project.name.startsWith('narrow') ? 'narrow' : 'desktop';
  await login(page, `e2e-owner-${variant}@example.test`);
});

test('all supported dashboard journeys are navigable without mock or unavailable screens', async ({ page }) => {
  const journeys = [
    ['/analytics', 'Analytics Overview'],
    ['/notifications', 'Notifications'],
    ['/studio', 'Trigger Studio'],
    ['/subscribers', 'Subscribers'],
    ['/templates', 'Templates'],
    ['/rules', 'Routing Rules'],
    ['/api-keys', 'API Keys'],
    ['/settings', 'Settings'],
    ['/settings/billing', 'Billing & Entitlements'],
  ] as const;
  for (const [path, heading] of journeys) {
    if (new URL(page.url()).pathname !== path) await navigateInApp(page, path);
    await expect(page.getByRole('heading', { name: heading, exact: false }).first()).toBeVisible();
    await expect(page.getByText(/unavailable until|mock data/i)).toHaveCount(0);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);

  await navigateInApp(page, '/api-keys');
  await page.getByLabel('Key Name').fill(`browser-${Date.now()}`);
  await page.getByRole('button', { name: 'Create Key' }).click();
  await expect(page.getByText(/will not be shown again/i)).toBeVisible();
  await page.getByRole('button', { name: 'I saved it' }).click();
  await expect(page.getByText(/will not be shown again/i)).toHaveCount(0);
});

test('billing is owner-only in navigation, page state, and server authorization', async ({ page, context, request }, testInfo) => {
  await page.goto('/');
  const publicPlanActions = page.getByRole('button', { name: 'Coming soon' });
  await expect(publicPlanActions).toHaveCount(3);
  for (const action of await publicPlanActions.all()) await expect(action).toBeDisabled();
  await expect(page.locator('script[src*="checkout.razorpay.com"]')).toHaveCount(0);

  await page.goto('/settings/billing');
  await expect(page.getByRole('heading', { name: 'Free Tier' }).first()).toBeVisible();
  const planActions = page.getByRole('button', { name: 'Coming soon' });
  await expect(planActions).toHaveCount(3);
  for (const action of await planActions.all()) await expect(action).toBeDisabled();
  await expect(page.locator('script[src*="checkout.razorpay.com"]')).toHaveCount(0);

  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  const variant = testInfo.project.name.startsWith('narrow') ? 'narrow' : 'desktop';
  await login(page, `e2e-member-${variant}@example.test`);
  await expect(page.locator('a[href="/settings/billing"]')).toHaveCount(0);
  await page.goto('/settings/billing');
  await expect(page.getByText('Only the workspace owner can view billing.')).toBeVisible();
  const memberEmail = `e2e-member-${variant}@example.test`;
  const loginResponse = await request.post('/api/v1/auth/login', {
    data: { email: memberEmail, password: 'Varta-e2e-password-123!' },
    headers: { accept: 'application/json' },
  });
  expect(loginResponse.status()).toBe(200);
  const loginBody = await loginResponse.json() as {
    success?: unknown;
    data?: { accessToken?: unknown };
  };
  expect(loginBody).toMatchObject({
    success: true,
    data: { accessToken: expect.any(String) },
  });
  const accessToken = loginBody.data!.accessToken as string;

  const workspacesResponse = await request.get('/api/v1/workspaces', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(workspacesResponse.status()).toBe(200);
  const workspaceBody = await workspacesResponse.json() as {
    success?: unknown;
    data?: Array<{ id?: unknown }>;
  };
  expect(workspaceBody).toMatchObject({
    success: true,
    data: expect.arrayContaining([
      expect.objectContaining({ id: expect.any(String) }),
    ]),
  });
  const workspaceId = workspaceBody.data![0]!.id as string;

  const billingResponse = await request.get(`/api/v1/workspaces/${workspaceId}/billing`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(billingResponse.status()).toBe(403);
});

test('studio reports durable acceptance and notification detail shows persisted state', async ({ page }) => {
  await navigateInApp(page, '/studio');
  await expect(page.getByRole('checkbox', { name: /Smart timing/ })).toBeDisabled();
  await expect(page.getByLabel('Select Template')).toHaveValue(/.+/);
  await expect(page.getByLabel('Recipient Subscriber')).toHaveValue(/.+/);
  await page.getByRole('button', { name: /trigger notification/i }).click();
  await expect(page.getByText(/Pipeline accepted request/)).toBeVisible();
  await navigateInApp(page, '/notifications');
  await expect(page.getByRole('cell', { name: 'E2E Template' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Details' }).first().click();
  await expect(page.getByRole('heading', { name: 'Notification detail' })).toBeVisible();
});

test('guide is navigable and manual rules work while AI is disabled', async ({ page }) => {
  await page.getByText('Start here: send your first notification').click();
  await expect(page.getByRole('link', { name: 'Add a subscriber', exact: true })).toBeVisible();
  await navigateInApp(page, '/rules');
  await expect(page.getByText(/AI rule authoring is disabled/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate review-only proposal' })).toBeDisabled();
  await page.getByLabel('Rule Name').fill(`Browser manual rule ${Date.now()}`);
  await page.getByLabel('Rule AST (review before saving)').fill(JSON.stringify({ logic: 'AND', conditions: [], channels: ['IN_APP'] }));
  await page.getByRole('button', { name: 'Save reviewed rule' }).click();
  await expect(page.getByRole('heading', { name: /Browser manual rule/ }).first()).toBeVisible();
});

test('logout cancels a late WebSocket token and does not reconnect', async ({ page }) => {
  // A full navigation installs the delay before the dashboard mounts its socket hook.
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  let intercepted: () => void = () => {};
  const tokenRequested = new Promise<void>(resolve => { intercepted = resolve; });
  await page.route('**/ws-token', async route => {
    const response = await route.fetch();
    intercepted();
    await pending;
    await route.fulfill({ response }).catch(() => {});
  });
  let connections = 0;
  let trackConnections = false;
  page.on('websocket', () => { if (trackConnections) connections++; });
  await page.goto('/analytics');
  await tokenRequested;
  trackConnections = true;
  const openNavigation = page.getByRole('button', { name: 'Open navigation' });
  if (await openNavigation.isVisible()) await openNavigation.click();
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page).toHaveURL(/\/login/);
  release();
  await page.waitForTimeout(5500); // Exceeds the reconnect delay to exercise cleanup.
  expect(connections).toBe(0);
});
