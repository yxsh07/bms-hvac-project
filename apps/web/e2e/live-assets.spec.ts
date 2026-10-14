import { expect, test } from '@playwright/test';

test('equipment view binds the selected site asset and live point roles', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const rolesResponse = page.waitForResponse((response) => response.url().includes('/point-roles') && response.ok());
  const assetResponse = page.waitForResponse((response) => /\/assets\/[^/]+$/.test(response.url()) && response.ok());
  await page.getByRole('link', { name: /Assets/ }).first().click();
  const roles = await (await rolesResponse).json() as { byType: Record<string, Record<string, string>> };
  const asset = await (await assetResponse).json() as { name: string; type: string; points: Array<{ abbr: string; display: string }> };
  await expect(page.getByRole('heading', { name: asset.name })).toBeVisible();
  const mapped = Object.values(roles.byType[asset.type] ?? {});
  const point = asset.points.find((entry) => mapped.includes(entry.abbr));
  expect(point).toBeDefined();
  await expect(page.getByText(point!.display, { exact: true })).toBeVisible();
  await expect(page.getByText('readings received')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request set-point change' })).toHaveAttribute('href', '/setpoints');
});
