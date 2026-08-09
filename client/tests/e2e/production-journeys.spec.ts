import { expect, test } from '@playwright/test';

async function navigateInApp(page: import('@playwright/test').Page, path: string) {
  await page.locator(`a[href="${path}"]`).first().evaluate((link: HTMLAnchorElement) => link.click());
  await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('e2e-owner@example.test');
  await page.getByLabel('Password').fill('Varta-e2e-password-123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/analytics/);
  await expect(page.getByRole('heading', { name: 'Analytics Overview' })).toBeVisible();
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

test('studio reports durable acceptance and notification detail shows persisted state', async ({ page }) => {
  await navigateInApp(page, '/studio');
  await expect(page.getByLabel('Select Template')).toHaveValue(/.+/);
  await expect(page.getByLabel('Recipient Subscriber')).toHaveValue(/.+/);
  await page.getByRole('button', { name: /trigger notification/i }).click();
  await expect(page.getByText(/Pipeline accepted request/)).toBeVisible();
  await navigateInApp(page, '/notifications');
  await expect(page.getByRole('cell', { name: 'E2E Template' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Details' }).first().click();
  await expect(page.getByRole('heading', { name: 'Notification detail' })).toBeVisible();
});
