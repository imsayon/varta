import { expect, test, type Page, type Route } from '@playwright/test';

function barrier() {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  return { pending, release };
}

async function settingsFixture(page: Page) {
  await page.context().addCookies([{ name: 'refreshToken', value: 'synthetic-settings-cookie', domain: '127.0.0.1', path: '/', httpOnly: true }]);
  const workspaces = ['a', 'b'].map(id => ({ id, name: `Workspace ${id.toUpperCase()}`, slug: `workspace-${id}`, role: 'OWNER', settings: { defaultTimezone: id === 'a' ? 'Asia/Kolkata' : 'UTC' } }));
  const calls: Array<{ workspace: string; suffix: string; body: Record<string, unknown> }> = [];
  const fixture = {
    calls,
    get: async (route: Route, workspace: string, suffix: string) => {
      const data = suffix === '' ? workspaces.find(item => item.id === workspace)
        : suffix === '/providers' ? [{ channel: 'email', provider: 'resend', config: { apiKey: '********', fromAddress: `${workspace}@example.test` } }]
        : [];
      await route.fulfill({ json: { success: true, data } });
    },
    save: async (route: Route, workspace: string, suffix: string) => {
      await route.fulfill({ json: { success: true, data: suffix === '' ? { ...workspaces.find(item => item.id === workspace), ...route.request().postDataJSON() } : suffix === '/api-keys' ? { fullKey: 'synthetic-A-generated-secret' } : {} } });
    },
  };
  await page.routeWebSocket('**/ws?*', () => {});
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/refresh') return route.fulfill({ json: { success: true, data: { accessToken: 'synthetic-settings-token' } } });
    if (path === '/api/v1/auth/me') return route.fulfill({ json: { success: true, data: { id: 'settings-user', email: 'settings@example.test', emailVerified: true } } });
    if (path === '/api/v1/workspaces') return route.fulfill({ json: { success: true, data: workspaces } });
    const match = path.match(/^\/api\/v1\/workspaces\/(a|b)(.*)$/);
    if (!match) throw new Error(`Unexpected fixture request: ${path}`);
    const [, workspace, suffix] = match;
    if (suffix === '/ws-token') return route.fulfill({ json: { success: true, data: { token: workspace } } });
    if (suffix === '/notifications') return route.fulfill({ json: { success: true, data: [] } });
    if (route.request().method() === 'GET') return fixture.get(route, workspace, suffix);
    calls.push({ workspace, suffix, body: route.request().postDataJSON() });
    return fixture.save(route, workspace, suffix);
  });
  return fixture;
}

async function switchWorkspace(page: Page) {
  const openNavigation = page.getByRole('button', { name: 'Open navigation' });
  if (await openNavigation.isVisible()) await openNavigation.click();
  await page.getByRole('button', { name: 'Select workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Workspace B', exact: true }).click();
  const closeNavigation = page.getByRole('button', { name: 'Close navigation', exact: true });
  if (await closeNavigation.isVisible()) await closeNavigation.click({ position: { x: page.viewportSize()!.width - 5, y: 5 } });
}

test('ordinary settings save omits unchanged secret and accepts an explicit replacement', async ({ page }) => {
  const fixture = await settingsFixture(page);
  await page.goto('/settings');
  await expect(page.getByLabel('From Address', { exact: true })).toHaveValue('a@example.test');
  await expect(page.getByLabel('Resend API Key', { exact: true })).toHaveValue('');
  await page.getByLabel('Default Timezone').fill('Europe/London');
  await page.getByRole('button', { name: 'Save Configuration', exact: true }).click();
  await expect.poll(() => fixture.calls.filter(call => call.suffix === '/providers/email').length).toBe(1);
  expect(fixture.calls[1].body).toMatchObject({ config: { fromAddress: 'a@example.test' } });
  expect(fixture.calls[1].body.config).not.toHaveProperty('apiKey');
  await expect(page.getByRole('button', { name: 'Save Configuration', exact: true })).toBeEnabled();
  await page.getByLabel('Resend API Key', { exact: true }).fill('synthetic-replacement');
  await page.getByRole('button', { name: 'Save Configuration', exact: true }).click();
  await expect.poll(() => fixture.calls.filter(call => call.suffix === '/providers/email').length).toBe(2);
  expect(fixture.calls[3].body).toMatchObject({ config: { apiKey: 'synthetic-replacement', fromAddress: 'a@example.test' } });
});

for (const failedSection of ['', '/providers', '/api-keys']) {
  test(`switching workspace isolates a failed ${failedSection || 'workspace'} read`, async ({ page }) => {
    const fixture = await settingsFixture(page);
    const get = fixture.get;
    fixture.get = async (route, workspace, suffix) => {
      if (workspace === 'b' && suffix === failedSection) return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic settings unavailable' } } });
      await get(route, workspace, suffix);
    };
    await page.goto('/settings');
    await expect(page.getByLabel('Workspace Name')).toHaveValue('Workspace A');
    await page.getByLabel('Resend API Key', { exact: true }).fill('a-unsaved-secret');
    await page.getByLabel('Generate API Key', { exact: true }).fill('A unsaved key');
    await switchWorkspace(page);
    await expect(page.getByLabel('Workspace Name')).not.toHaveValue('Workspace A');
    await expect(page.getByLabel('Resend API Key', { exact: true })).not.toHaveValue('a-unsaved-secret');
    await expect(page.getByLabel('Generate API Key', { exact: true })).toHaveValue('');
    if (failedSection === '') {
      await expect(page.getByRole('button', { name: 'Save Configuration', exact: true })).toBeDisabled();
    } else {
      await expect(page.getByLabel('Workspace Name')).toHaveValue('Workspace B');
      if (failedSection === '/providers') {
        await expect(page.getByLabel('From Address', { exact: true })).toHaveValue('');
        await expect(page.getByLabel('Resend API Key', { exact: true })).toBeDisabled();
        await page.getByRole('button', { name: 'Save Configuration', exact: true }).click();
        await expect.poll(() => fixture.calls.length).toBe(1);
        expect(fixture.calls[0]).toMatchObject({ workspace: 'b', suffix: '', body: { name: 'Workspace B' } });
      } else await expect(page.getByRole('button', { name: 'Generate Key', exact: true })).toBeDisabled();
    }
    expect(fixture.calls.every(call => call.workspace !== 'b' || call.suffix === '')).toBe(true);
  });
}

test('a delayed old save cannot switch back or submit provider fields after a workspace switch', async ({ page }) => {
  const fixture = await settingsFixture(page);
  const pending = barrier();
  const save = fixture.save;
  fixture.save = async (...args) => { await pending.pending; await save(...args).catch(() => {}); };
  await page.goto('/settings');
  await expect(page.getByLabel('Workspace Name')).toHaveValue('Workspace A');
  await page.getByRole('button', { name: 'Save Configuration', exact: true }).click();
  await expect.poll(() => fixture.calls.length).toBe(1);
  await switchWorkspace(page);
  await expect(page.getByLabel('Workspace Name')).toHaveValue('Workspace B');
  pending.release();
  await expect(page.getByLabel('From Address', { exact: true })).toHaveValue('b@example.test');
  await expect(page.getByRole('button', { name: 'Save Configuration', exact: true })).toBeEnabled();
  expect(fixture.calls).toHaveLength(1);
});


test('late old workspace settings cannot repaint the active workspace', async ({ page }) => {
  const fixture = await settingsFixture(page);
  const pending = barrier();
  const get = fixture.get;
  let requested = false;
  fixture.get = async (route, workspace, suffix) => {
    if (workspace === 'a' && suffix === '') { requested = true; await pending.pending; }
    await get(route, workspace, suffix).catch(() => {});
  };
  await page.goto('/settings');
  await expect.poll(() => requested).toBe(true);
  await switchWorkspace(page);
  await expect(page.getByLabel('Workspace Name')).toHaveValue('Workspace B');
  pending.release();
  await expect(page.getByLabel('From Address', { exact: true })).toHaveValue('b@example.test');
  await page.getByRole('button', { name: 'Save Configuration', exact: true }).click();
  await expect.poll(() => fixture.calls.length).toBe(2);
  expect(fixture.calls[0]).toMatchObject({ workspace: 'b', body: { name: 'Workspace B', settings: { defaultTimezone: 'UTC' } } });
  expect(fixture.calls[1]).toMatchObject({ workspace: 'b', body: { config: { fromAddress: 'b@example.test' } } });
});

test('switching workspace clears the generated API key and supports retry after a failed provider load', async ({ page }) => {
  const fixture = await settingsFixture(page);
  const get = fixture.get;
  let fail = true;
  fixture.get = async (route, workspace, suffix) => {
    if (workspace === 'b' && suffix === '/providers' && fail) return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic unavailable' } } });
    await get(route, workspace, suffix);
  };
  await page.goto('/settings');
  await expect(page.getByLabel('Workspace Name')).toHaveValue('Workspace A');
  await page.getByLabel('Generate API Key', { exact: true }).fill('Fixture key');
  await page.getByRole('button', { name: 'Generate Key', exact: true }).click();
  await expect(page.getByText('synthetic-A-generated-secret', { exact: true })).toBeVisible();
  await switchWorkspace(page);
  await expect(page.getByLabel('Workspace Name')).toHaveValue('Workspace B');
  await expect(page.getByText('synthetic-A-generated-secret', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('From Address', { exact: true })).toBeDisabled();
  fail = false;
  await page.getByRole('button', { name: 'Retry loading settings', exact: true }).click();
  await expect(page.getByLabel('From Address', { exact: true })).toHaveValue('b@example.test');
  await expect(page.getByLabel('From Address', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save Configuration', exact: true }).click();
  await expect.poll(() => fixture.calls.length).toBe(3);
  expect(fixture.calls[2]).toMatchObject({ workspace: 'b', body: { config: { fromAddress: 'b@example.test' } } });
});
