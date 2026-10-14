import { expect, test } from '@playwright/test';

test('overview uses the active site floors and live alarm count', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('LIVE SITE DATA')).toBeVisible();
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('bms-session')!) as {
    accessToken: string; currentSiteId: string;
  });
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const base = `http://localhost:3000/api/v1/sites/${session.currentSiteId}`;
  const ontology = await (await request.get(`${base}/ontology`, { headers })).json() as {
    site: { floors: Array<{ name: string; zones: Array<{ assetIds: string[] }> }> };
  };
  const alarmPage = await (await request.get(`${base}/alarms?limit=200`, { headers })).json() as {
    items: Array<{ clearedAt: string | null }>;
  };
  await expect(page.locator('.overview-floor')).toHaveCount(ontology.site.floors.length);
  for (const floor of ontology.site.floors) {
    const count = floor.zones.reduce((total, zone) => total + zone.assetIds.length, 0);
    await expect(page.locator('.overview-floor').filter({ hasText: floor.name })).toContainText(`${count} assets`);
  }
  const openCount = alarmPage.items.filter((alarm) => !alarm.clearedAt).length;
  await expect(page.locator('.overview-attention')).toContainText(openCount === 0
    ? 'No open alarms at this site' : `${openCount} open alarm${openCount === 1 ? '' : 's'} at this site`);
});
