import { test, expect } from '@playwright/test';

test('overview leads to the building and asset workspace', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'SimSite Hospital' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Site pulse' }).getByText('Assets monitored')).toBeVisible();

  await page.getByRole('link', { name: /Explore building/ }).click();
  await expect(page.getByRole('heading', { name: 'Building twin' })).toBeVisible();

  await page.getByRole('button', { name: 'Open main menu' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Assets' }).click();
  await expect(page.getByRole('textbox', { name: 'Search assets' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search assets' }).fill('Chiller');
  await expect(page.getByText('Chiller 1', { exact: true }).first()).toBeVisible();
});
