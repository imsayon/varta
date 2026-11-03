import { expect, test, type Page, type Route, type WebSocketRoute } from '@playwright/test';

function barrier() {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  return { pending, release };
}

async function feedFixture(page: Page) {
  await page.context().addCookies([{ name: 'refreshToken', value: 'synthetic-feed-cookie', domain: '127.0.0.1', path: '/', httpOnly: true }]);
  const workspaces = ['a', 'b'].map(id => ({ id, name: `Workspace ${id.toUpperCase()}`, role: 'OWNER', settings: {} }));
  const rows = {
    a: ['shared', 'second'].map(id => ({ id, createdAt: '2026-11-01T12:00:00Z', readAt: null as string | null, status: 'DELIVERED', template: { name: `A ${id}` } })),
    b: [{ id: 'shared', createdAt: '2026-11-01T12:00:00Z', readAt: null as string | null, status: 'DELIVERED', template: { name: 'B shared' } }],
  };
  const calls: string[] = [];
  const sockets: WebSocketRoute[] = [];
  const socketMessages: Array<string | Buffer> = [];
  const fixture = {
    rows, calls, sockets, socketMessages,
    patch: async (route: Route, workspace: 'a' | 'b', id: string) => {
      rows[workspace].find(row => row.id === id)!.readAt = new Date().toISOString();
      await route.fulfill({ json: { success: true, data: {} } });
    },
    get: async (route: Route, workspace: 'a' | 'b') => {
      await route.fulfill({ json: { success: true, data: rows[workspace] } });
    },
  };
  await page.routeWebSocket('**/ws?*', socket => {
    sockets.push(socket);
    socket.onMessage(message => { socketMessages.push(message); });
  });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/refresh') return route.fulfill({ json: { success: true, data: { accessToken: 'synthetic-feed-token' } } });
    if (path === '/api/v1/auth/me') return route.fulfill({ json: { success: true, data: { id: 'feed-user', email: 'feed@example.test' } } });
    if (path === '/api/v1/workspaces') return route.fulfill({ json: { success: true, data: workspaces } });
    const match = path.match(/^\/api\/v1\/workspaces\/(a|b)(.*)$/);
    if (!match) throw new Error(`Unexpected fixture request: ${path}`);
    const workspace = match[1] as 'a' | 'b';
    const suffix = match[2];
    if (suffix === '/ws-token') return route.fulfill({ json: { success: true, data: { token: workspace } } });
    if (suffix === '/notifications') return fixture.get(route, workspace);
    const read = suffix.match(/^\/notifications\/(.+)\/read$/);
    if (read && route.request().method() === 'PATCH') {
      calls.push(`${workspace}:${read[1]}`);
      return fixture.patch(route, workspace, read[1]);
    }
    if (suffix === '') return route.fulfill({ json: { success: true, data: workspaces.find(item => item.id === workspace) } });
    if (suffix === '/api-keys' || suffix === '/providers') return route.fulfill({ json: { success: true, data: [] } });
    throw new Error(`Unexpected fixture request: ${path}`);
  });
  return fixture;
}

async function openFeed(page: Page, unread: number) {
  await expect(page.getByRole('button', { name: `Notifications, ${unread} unread`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Notifications, ${unread} unread`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Real-time Feed' })).toBeVisible();
}

async function switchWorkspace(page: Page, name: string) {
  const closeFeed = page.getByRole('button', { name: 'Close notifications' });
  if (await closeFeed.isVisible()) await closeFeed.click();
  const openNavigation = page.getByRole('button', { name: 'Open navigation' });
  if (await openNavigation.isVisible()) await openNavigation.click();
  await page.getByRole('button', { name: 'Select workspace', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
  const closeNavigation = page.getByRole('button', { name: 'Close navigation', exact: true });
  if (await closeNavigation.isVisible()) await closeNavigation.click({ position: { x: page.viewportSize()!.width - 5, y: 5 } });
}

test('mixed read persistence keeps failed badges through reload and supports keyboard retry', async ({ page }) => {
  const fixture = await feedFixture(page);
  const persist = fixture.patch;
  let fail = true;
  fixture.patch = async (route, workspace, id) => {
    if (fail && id === 'second') return route.fulfill({ status: 503, json: { success: false, error: { code: 'UNAVAILABLE', message: 'Synthetic unavailable' } } });
    await persist(route, workspace, id);
  };
  await page.goto('/settings');
  await openFeed(page, 2);
  await page.getByRole('button', { name: 'Clear Badge', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('alert')).toContainText(/could not|failed|couldn.t/i);
  const retry = page.getByRole('button', { name: /retry/i });
  await expect(retry).toBeEnabled();
  expect(fixture.rows.a.map(row => Boolean(row.readAt))).toEqual([true, false]);
  await page.reload();
  await openFeed(page, 1);
  // Reload reconciles durable truth even though the transient error message is gone.
  await page.getByRole('button', { name: 'Clear Badge', exact: true }).click();
  await expect(page.getByRole('banner').getByRole('alert')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Close notifications', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(retry).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Notifications, 0 unread', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('alert')).toHaveCount(0);
  expect(fixture.calls).toEqual(['a:shared', 'a:second', 'a:second', 'a:second']);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Notifications, 0 unread', exact: true })).toBeVisible();
});

test('all successful reads persist and do not clear notifications arriving during the batch', async ({ page }) => {
  const fixture = await feedFixture(page);
  const pending = barrier();
  const persist = fixture.patch;
  fixture.patch = async (...args) => { await pending.pending; await persist(...args); };
  await page.goto('/settings');
  await openFeed(page, 2);
  await page.getByRole('button', { name: 'Clear Badge', exact: true }).click();
  await expect.poll(() => fixture.calls.length).toBe(2);
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
  await expect.poll(() => fixture.sockets.length).toBe(1);
  fixture.rows.a.push({ ...fixture.rows.a[0], id: 'new', template: { name: 'New arrival' } });
  fixture.sockets[0].send(JSON.stringify({ type: 'notification', data: { id: 'new', title: 'New arrival' } }));
  await expect(page.getByText('New arrival', { exact: true })).toBeVisible();
  pending.release();
  await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear Badge', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Notifications, 0 unread', exact: true })).toBeVisible();
  expect(fixture.calls).toEqual(['a:shared', 'a:second', 'a:new']);
  fixture.sockets[0].send(JSON.stringify({ type: 'notification', data: { id: 'shared', title: 'Repeated event' } }));
  await expect(page.getByText('Repeated event', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications, 0 unread', exact: true })).toBeVisible();
  expect(fixture.socketMessages).toEqual([]); // Workspace feed read actions are not subscriber transport ACKs.
});

test('aborted reads remain unread and retryable', async ({ page }) => {
  const fixture = await feedFixture(page);
  fixture.patch = async route => route.abort('aborted');
  await page.goto('/settings');
  await openFeed(page, 2);
  await page.getByRole('button', { name: 'Clear Badge', exact: true }).click();
  await expect(page.getByRole('banner').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications, 2 unread', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /retry/i })).toBeEnabled();
  expect(fixture.rows.a.every(row => !row.readAt)).toBe(true);
});

test('workspace switch cancels old reads without clearing shared IDs or restoring errors', async ({ page }) => {
  const fixture = await feedFixture(page);
  const pending = barrier();
  fixture.patch = async route => {
    await pending.pending;
    await route.fulfill({ status: 503, json: { success: false, error: { message: 'Old workspace failure' } } }).catch(() => {});
  };
  await page.goto('/settings');
  await openFeed(page, 2);
  await page.getByRole('button', { name: 'Clear Badge', exact: true }).click();
  await expect.poll(() => fixture.calls.length).toBe(2);
  await switchWorkspace(page, 'Workspace B');
  await openFeed(page, 1);
  pending.release();
  await expect(page.getByText('B shared', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('alert')).toHaveCount(0);
  expect(fixture.rows.b[0].readAt).toBeNull();
});

test('reselecting the same workspace cancels reads without leaving the action disabled', async ({ page }) => {
  const fixture = await feedFixture(page);
  const pending = barrier();
  fixture.patch = async route => {
    await pending.pending;
    await route.fulfill({ status: 503, json: { success: false, error: { message: 'Cancelled request' } } }).catch(() => {});
  };
  await page.goto('/settings');
  await openFeed(page, 2);
  await page.getByRole('button', { name: 'Clear Badge', exact: true }).click();
  await expect.poll(() => fixture.calls.length).toBe(2);
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
  await switchWorkspace(page, 'Workspace A');
  await openFeed(page, 2);
  await expect(page.getByRole('button', { name: 'Clear Badge', exact: true })).toBeEnabled();
  pending.release();
  await expect(page.getByRole('banner').getByRole('alert')).toHaveCount(0);
});

test('late old-workspace feed response cannot replace the new workspace feed', async ({ page }) => {
  const fixture = await feedFixture(page);
  const pending = barrier();
  const originalGet = fixture.get;
  let requested = false;
  fixture.get = async (route, workspace) => {
    if (workspace === 'a') { requested = true; await pending.pending; }
    await originalGet(route, workspace).catch(() => {});
  };
  await page.goto('/settings');
  await expect.poll(() => requested).toBe(true);
  await switchWorkspace(page, 'Workspace B');
  await openFeed(page, 1);
  pending.release();
  await expect(page.getByText('B shared', { exact: true })).toBeVisible();
  await expect(page.getByText('A second', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
});

test('reconnect reconciles persisted reads after an ambiguous failed response', async ({ page }) => {
  const fixture = await feedFixture(page);
  fixture.patch = async (route, workspace, id) => {
    fixture.rows[workspace].find(row => row.id === id)!.readAt = new Date().toISOString();
    await route.abort('connectionreset');
  };
  await page.goto('/settings');
  await openFeed(page, 2);
  await page.getByRole('button', { name: 'Clear Badge', exact: true }).click();
  await expect(page.getByRole('banner').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications, 2 unread', exact: true })).toBeVisible();
  await expect.poll(() => fixture.sockets.length).toBe(1);
  fixture.sockets[0].close();
  await expect.poll(() => fixture.sockets.length, { timeout: 10_000 }).toBe(2);
  await expect(page.getByRole('button', { name: 'Notifications, 0 unread', exact: true })).toBeVisible();
});

test('a full stale feed response preserves a newer realtime unread notification', async ({ page }) => {
  const fixture = await feedFixture(page);
  fixture.rows.a.splice(0, fixture.rows.a.length, ...Array.from({ length: 50 }, (_, index) => ({
    ...fixture.rows.a[0], id: `old-${index}`, readAt: '2026-11-01T12:00:00Z', template: { name: `Old ${index}` },
  })));
  const pending = barrier();
  let requested = 0;
  let completed = 0;
  fixture.get = async (route, workspace) => {
    const body = JSON.stringify({ success: true, data: fixture.rows[workspace] });
    requested++;
    await pending.pending;
    await route.fulfill({ contentType: 'application/json', body }).catch(() => {});
    completed++;
  };
  await page.goto('/settings');
  await expect(page.getByRole('banner').getByRole('status')).toHaveText('Live');
  await expect.poll(() => requested).toBeGreaterThan(0);
  fixture.sockets[0].send(JSON.stringify({ type: 'notification', data: { id: 'newest', title: 'Newest realtime arrival' } }));
  await openFeed(page, 1);
  await expect(page.getByText('Newest realtime arrival', { exact: true })).toBeVisible();
  pending.release();
  await expect.poll(() => completed).toBe(requested);
  await expect(page.getByText('Newest realtime arrival', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
});

test('a stale reconciliation response cannot undo successfully persisted reads', async ({ page }) => {
  const fixture = await feedFixture(page);
  await page.goto('/settings');
  await openFeed(page, 2);
  const pending = barrier();
  const responseCompleted = barrier();
  let requested = false;
  fixture.get = async (route, workspace) => {
    const body = JSON.stringify({ success: true, data: fixture.rows[workspace] });
    requested = true;
    await pending.pending;
    await route.fulfill({ contentType: 'application/json', body });
    responseCompleted.release();
  };
  fixture.sockets[0].close();
  await expect.poll(() => requested).toBe(true);
  await page.getByRole('button', { name: 'Clear Badge', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Notifications, 0 unread', exact: true })).toBeVisible();
  pending.release();
  await responseCompleted.pending;
  await expect(page.getByRole('button', { name: 'Notifications, 0 unread', exact: true })).toBeVisible();
  expect(fixture.rows.a.every(row => Boolean(row.readAt))).toBe(true);
});

for (const width of [360, 390, 393]) {
  test(`notification panel and retry error fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 851 });
    const fixture = await feedFixture(page);
    fixture.patch = async route => route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic unavailable' } } });
    await page.goto('/settings');
    await openFeed(page, 2);
    await page.getByRole('button', { name: 'Clear Badge', exact: true }).click();
    const alert = page.getByRole('banner').getByRole('alert');
    await expect(alert).toBeVisible();
    const panel = page.getByRole('heading', { name: 'Real-time Feed' }).locator('../../..');
    await expect.poll(async () => (await panel.boundingBox())!.x).toBeGreaterThanOrEqual(0);
    for (const item of [panel, alert, page.getByRole('button', { name: 'Retry marking as read', exact: true })]) {
      const box = await item.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await page.getByRole('button', { name: 'Close notifications', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Retry marking as read', exact: true })).toBeFocused();
  });
}
