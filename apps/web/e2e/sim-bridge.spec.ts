import { expect, test } from '@playwright/test';

test('[live-value] Sim Console changes appear in the operator app', async ({ page, request }) => {
  const previous = await (await request.get('http://localhost:8000/sim/state')).json() as {
    outdoorDbtC: number; relativeHumidityPct: number; occupancyMultiplier: number;
  };
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('LIVE SITE DATA')).toBeVisible();
  const power = page.locator('.overview-pulse-stat').filter({ hasText: 'Plant power' }).locator('strong');
  await expect(power).not.toHaveText('—');
  const before = await power.textContent();

  const consolePage = await page.context().newPage();
  try {
    await consolePage.goto('http://localhost:5174');
    await expect(consolePage.getByRole('heading', { name: /Sim Console/ })).toBeVisible();
    await consolePage.getByLabel(/Outdoor DBT/).press('End');
    await consolePage.getByRole('button', { name: 'Apply environment' }).click();
    await consolePage.getByRole('button', { name: '600×' }).click();
    await expect.poll(async () => power.textContent(), { timeout: 30_000 }).not.toBe(before);
    await page.getByRole('link', { name: /Explore building/ }).click();
    await expect(page.getByText(/°C · .* assets/).first()).toBeVisible();
  } finally {
    await request.post('http://localhost:8000/sim/clock', { data: { scale: 1 } });
    await request.post('http://localhost:8000/sim/env', { data: {
      outdoor_dbt: previous.outdoorDbtC, rh: previous.relativeHumidityPct,
      occupancy_mult: previous.occupancyMultiplier,
    } });
    await consolePage.close();
  }
});
