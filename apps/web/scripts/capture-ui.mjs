import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.DEMO_URL ?? 'http://localhost:5173';
const output = process.env.UI_CAPTURE_DIR ?? '../../docs/screenshots/interface-design';
await mkdir(output, { recursive: true });

const browser = await chromium.launch();
try {
  for (const [label, width, height] of [['mobile', 390, 820], ['tablet', 820, 820], ['laptop', 1180, 820], ['desktop', 1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(base);
    await page.screenshot({ path: `${output}/${label}-login.png`, fullPage: true });
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: 'Open main menu' }).waitFor();
    for (const [name, route] of [['overview', '/'], ['assets', '/assets'], ['building', '/building'], ['plant', '/plant'], ['alarms', '/alarms'], ['setpoints', '/setpoints'], ['live', '/live'], ['controllers', '/controllers'], ['reports', '/reports'], ['audit', '/audit'], ['users', '/users'], ['settings', '/settings']]) {
      await page.goto(`${base}${route}`);
      await page.locator('main').waitFor();
      await page.waitForTimeout(name === 'building' ? 1200 : 200);
      await page.screenshot({ path: `${output}/${label}-${name}.png`, fullPage: true });
    }
    await page.close();
  }
} finally {
  await browser.close();
}
