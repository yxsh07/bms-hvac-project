import { expect, test } from '@playwright/test';

test('shows simulator telemetry through the running API', async ({ page }) => {
  await page.goto(process.env.DEMO_URL ?? 'http://localhost:5173/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Open main menu' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Live telemetry' }).click();

  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByRole('combobox', { name: /Asset/ })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await expect(page.getByText(/coverage [1-9]/)).toBeVisible();
});
