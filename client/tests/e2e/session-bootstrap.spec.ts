import { expect, test } from '@playwright/test';

test('cold refresh verifies identity before mounting workspace requests', async ({ page }) => {
  let releaseIdentity!: () => void;
  const identityPending = new Promise<void>(resolve => { releaseIdentity = resolve; });
  let identityRequested!: () => void;
  const identityStarted = new Promise<void>(resolve => { identityRequested = resolve; });
  let socketConnections = 0;
  let workspaceRequests = 0;
  await page.context().addCookies([{ name: 'refreshToken', value: 'synthetic-bootstrap-cookie', domain: '127.0.0.1', path: '/', httpOnly: true }]);
  await page.routeWebSocket('**/ws?*', () => { socketConnections++; });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/refresh') return route.fulfill({ json: { success: true, data: { accessToken: 'synthetic-bootstrap-token' } } });
    if (path === '/api/v1/auth/me') {
      expect(route.request().headers().authorization).toBe('Bearer synthetic-bootstrap-token');
      identityRequested();
      await identityPending;
      return route.fulfill({ json: { success: true, data: { id: 'bootstrap-user', email: 'bootstrap@example.test', emailVerified: true } } }).catch(() => {});
    }
    if (path === '/api/v1/workspaces') {
      workspaceRequests++;
      return route.fulfill({ json: { success: true, data: [{ id: 'bootstrap-workspace', name: 'Bootstrap Workspace', role: 'OWNER', settings: {} }] } });
    }
    if (path.endsWith('/ws-token')) return route.fulfill({ json: { success: true, data: { token: 'synthetic-socket-token' } } });
    if (path.endsWith('/notifications')) return route.fulfill({ json: { success: true, data: [] } });
    if (path.endsWith('/bootstrap-workspace')) return route.fulfill({ json: { success: true, data: { id: 'bootstrap-workspace', name: 'Bootstrap Workspace', settings: {} } } });
    if (path.endsWith('/providers') || path.endsWith('/api-keys')) return route.fulfill({ json: { success: true, data: [] } });
    throw new Error(`Unexpected bootstrap request: ${path}`);
  });
  await page.goto('/settings');
  await identityStarted;
  try {
    const earlyWorkspace = await page.waitForRequest(request => new URL(request.url()).pathname === '/api/v1/workspaces', { timeout: 1000 }).then(() => true, () => false);
    expect(earlyWorkspace).toBe(false);
    expect(workspaceRequests).toBe(0);
    await expect(page.getByRole('banner')).toHaveCount(0);
  } finally {
    releaseIdentity();
  }
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByLabel('Workspace Name')).toHaveValue('Bootstrap Workspace');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect.poll(() => socketConnections).toBe(1);
});
