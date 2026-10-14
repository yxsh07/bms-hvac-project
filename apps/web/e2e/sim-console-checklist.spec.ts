import { expect, test } from '@playwright/test';

test('Sim Console shows recorded Test Checklist results', async ({ page, request }) => {
  const result = await request.post('http://localhost:8000/sim/checklist', { data: {
    featureId: 'live-value', status: 'pass', runId: 'browser-checklist',
    evidence: 'Sim Console to BMS Twin browser path',
  } });
  expect(result.ok()).toBeTruthy();
  await page.goto('http://localhost:5174');
  const row = page.getByText('A live plant value appears through ingest + quality').locator('..');
  await expect(row).toContainText('pass');
});
