import { expect, test } from '@playwright/test';

test('[lead-trip-failover] a simulated trip reaches the alarm queue and can be acknowledged', async ({ page, request }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('LIVE SITE DATA')).toBeVisible();
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('bms-session')!) as {
    accessToken: string; currentSiteId: string;
  });
  const alarmUrl = `http://localhost:3000/api/v1/sites/${session.currentSiteId}/alarms?limit=200`;
  const openFaults = async () => {
    const response = await request.get(alarmUrl, { headers: { Authorization: `Bearer ${session.accessToken}` } });
    const data = await response.json() as { items: Array<{ alarmCode: string; clearedAt: string | null }> };
    return data.items.filter((alarm) => alarm.alarmCode === 'POINT_FAULT' && !alarm.clearedAt).length;
  };
  const state = await (await request.get('http://localhost:8000/sim/state')).json() as { faults: string[] };
  for (const id of state.faults) await request.delete(`http://localhost:8000/sim/faults/${id}`);
  await request.post('http://localhost:8000/sim/scenarios/normal-day/start', { data: {} });
  await request.post('http://localhost:8000/sim/clock', { data: { scale: 60 } });
  await expect.poll(openFaults, { timeout: 20_000 }).toBe(0);
  const start = await request.post('http://localhost:8000/sim/scenarios/lead-chiller-trip/start', { data: {} });
  expect(start.ok()).toBeTruthy();
  const fault = await (await request.post('http://localhost:8000/sim/faults', {
    data: { type: 'lead-chiller-trip' },
  })).json() as { id: string };
  await request.post('http://localhost:8000/sim/clock', { data: { scale: 60 } });
  try {
    await page.getByRole('link', { name: /Alarms/ }).first().click();
    const card = page.getByRole('article').filter({ hasText: 'Chiller 1' }).first();
    await expect(card).toBeVisible({ timeout: 45_000 });
    await expect(card).toContainText('POINT_FAULT');
    await card.getByRole('button', { name: 'Acknowledge' }).click();
    await expect(card).toContainText(/acknowledged/i);
  } finally {
    await request.delete(`http://localhost:8000/sim/faults/${fault.id}`);
    await request.post('http://localhost:8000/sim/scenarios/normal-day/start', { data: {} });
    try { await expect.poll(openFaults, { timeout: 20_000 }).toBe(0); }
    finally { await request.post('http://localhost:8000/sim/clock', { data: { scale: 1 } }); }
  }
});
