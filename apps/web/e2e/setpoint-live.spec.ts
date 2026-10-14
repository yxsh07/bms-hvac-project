import { expect, test } from '@playwright/test';

const API = 'http://localhost:3000/api/v1';
const SITE = 'simsite-hospital';

test('engineer proposes and a manager approves a gateway-backed set point', async ({ browser, request }) => {
  const login = await request.post(`${API}/auth/login`, { data: {
    email: 'engineer@example.com', password: 'Engineer123!',
  } });
  expect(login.ok()).toBeTruthy();
  const { accessToken } = await login.json() as { accessToken: string };
  const writable = await request.get(`${API}/sites/${SITE}/setpoints`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(writable.ok()).toBeTruthy();
  const points = await writable.json() as Array<{
    assetId: string; field: string; safeMin: number; safeMax: number; liveRequest: unknown;
  }>;
  const point = points.find((item) => !item.liveRequest && item.safeMax > item.safeMin);
  expect(point, 'a writable point without a live request').toBeDefined();
  if (!point) return;

  const reason = `Browser workflow ${Date.now()}`;
  const engineerContext = await browser.newContext();
  const managerContext = await browser.newContext();
  try {
    const engineer = await engineerContext.newPage();
    await engineer.goto('/setpoints');
    await engineer.getByRole('button', { name: 'Sign in' }).click();
    await expect(engineer.getByRole('heading', { name: 'Set-point requests' })).toBeVisible();
    await engineer.getByLabel('Writable point').selectOption(`${point.assetId}:${point.field}`);
    await engineer.getByLabel('Proposed value').fill(String((point.safeMin + point.safeMax) / 2));
    await engineer.getByLabel('Reason').fill(reason);
    await engineer.getByRole('button', { name: 'Submit proposal' }).click();
    await expect(engineer.getByRole('status')).toContainText('Proposal submitted');

    const manager = await managerContext.newPage();
    await manager.goto('/setpoints');
    await manager.getByRole('button', { name: /Facility Manager/ }).click();
    await manager.getByRole('button', { name: 'Sign in' }).click();
    await expect(manager.getByRole('heading', { name: 'Set-point requests' })).toBeVisible();
    await manager.getByText(reason).locator('..').getByRole('button', { name: 'Approve' }).click();
    await expect(manager.getByRole('status')).toContainText('Request approved');

    await expect.poll(async () => {
      const runs = await request.get(`${API}/sites/${SITE}/setpoint-requests`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const page = await runs.json() as { items: Array<{ justification: string; state: string }> };
      return page.items.find((item) => item.justification === reason)?.state;
    }, { timeout: 30_000 }).toBe('APPLIED');

    const managerLogin = await request.post(`${API}/auth/login`, { data: {
      email: 'facility@example.com', password: 'Facility123!',
    } });
    const managerToken = (await managerLogin.json() as { accessToken: string }).accessToken;
    const headers = { Authorization: `Bearer ${managerToken}` };
    const runs = await request.get(`${API}/sites/${SITE}/setpoint-requests`, { headers });
    const runPage = await runs.json() as { items: Array<{ id: string; justification: string }> };
    const id = runPage.items.find((item) => item.justification === reason)?.id;
    expect(id).toBeTruthy();
    const audit = await request.get(`${API}/sites/${SITE}/audit?eventType=setpoint.applied`, { headers });
    const auditPage = await audit.json() as { items: Array<{ resource: string }> };
    expect(auditPage.items.some((entry) => entry.resource === `setpoint-request:${id}`)).toBeTruthy();
    const verified = await request.get(`${API}/sites/${SITE}/audit/verify`, { headers });
    expect((await verified.json() as { valid: boolean }).valid).toBe(true);
  } finally {
    await engineerContext.close();
    await managerContext.close();
  }
});
