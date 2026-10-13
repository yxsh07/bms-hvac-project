import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('opens the building twin and navigates its floors', async ({ page }) => {
  await page.goto(process.env.DEMO_URL ?? 'http://localhost:5173/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Open main menu' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Building twin' }).click();

  await expect(page.getByRole('heading', { name: 'Building twin' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Basement 1/ })).toBeVisible();
  await page.getByRole('button', { name: /Basement 1/ }).click();
  await expect(page.getByRole('button', { name: /Basement 1/ })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Floor plans' }).click();
  await expect(page.getByRole('img', { name: 'Basement 1 schematic plan' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Ground Floor schematic plan' })).toHaveCount(0);
  await page.getByRole('button', { name: '3D view' }).click();
  await expect(page.getByRole('region', { name: '3D building view' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: /Basement 1/ }).click();

  await mkdir('../../docs/screenshots/building', { recursive: true });
  for (const [name, width, height] of [
    ['390', 390, 820],
    ['820', 820, 1180],
    ['1180x820', 1180, 820],
    ['1440', 1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `../../docs/screenshots/building/${name}.png`, fullPage: true });
  }
});
