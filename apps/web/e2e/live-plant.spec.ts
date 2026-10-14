import { expect, test } from '@playwright/test';

test('plant schematic loads site topology, live equipment, navigation and what-if', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const layoutResponse = page.waitForResponse((response) => response.url().includes('/plant-layout') && response.ok());
  await page.getByRole('link', { name: /Plant schematic/ }).first().click();
  const layout = await (await layoutResponse).json() as { nodes: unknown[]; edges: unknown[]; viewBox: number[] };
  expect(layout.edges.length).toBeGreaterThan(5);
  const svg = page.getByRole('img', { name: 'Live plant topology' });
  await expect(svg).toBeVisible();
  await expect(svg.locator('g[role="button"]')).toHaveCount(layout.nodes.length - 2);
  const before = await svg.getAttribute('viewBox');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(svg).not.toHaveAttribute('viewBox', before!);
  await page.getByRole('button', { name: 'Fit' }).click();
  await expect(svg).toHaveAttribute('viewBox', layout.viewBox.join(' '));
  const other = svg.locator('g[role="button"]').nth(1);
  const selectedName = (await other.getAttribute('aria-label'))!.replace('Select ', '');
  await other.click();
  await expect(page.getByRole('heading', { name: selectedName })).toBeVisible();
  await page.getByRole('button', { name: 'Run what-if' }).click();
  await expect(page.getByText('indicative, 3-day calibration').first()).toBeVisible();
  await expect(page.getByTestId('whatif-kw-predicted')).toBeVisible();
});
