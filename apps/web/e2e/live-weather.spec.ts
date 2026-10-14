import { expect, test } from '@playwright/test';

test('Sim Console environment changes update the outdoor strip', async ({ page, request }) => {
  const before = await (await request.get('http://localhost:8000/sim/state')).json() as {
    outdoorDbtC: number; relativeHumidityPct: number;
  };
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const strip = page.getByLabel('Outdoor conditions');
  await expect(strip).toBeVisible();
  try {
    await request.post('http://localhost:8000/sim/env', { data: {
      outdoor_dbt: 41.5, rh: 50,
    } });
    await expect(strip).toContainText('41.5°', { timeout: 15_000 });
    await expect(strip).toContainText('50% RH');
  } finally {
    await request.post('http://localhost:8000/sim/env', { data: {
      outdoor_dbt: before.outdoorDbtC, rh: before.relativeHumidityPct,
    } });
  }
});
