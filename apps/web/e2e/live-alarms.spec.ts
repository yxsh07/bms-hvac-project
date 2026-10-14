import { expect, test } from '@playwright/test';

test('[lead-trip-failover] a simulated trip reaches the alarm queue and can be acknowledged', async ({ page, request }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const start = await request.post('http://localhost:8000/sim/scenarios/lead-chiller-trip/start', { data: {} });
  expect(start.ok()).toBeTruthy();
  const fault = await (await request.post('http://localhost:8000/sim/faults', {
    data: { type: 'lead-chiller-trip' },
  })).json() as { id: string };
  await request.post('http://localhost:8000/sim/clock', { data: { scale: 600 } });
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
    await request.post('http://localhost:8000/sim/clock', { data: { scale: 1 } });
  }
});
