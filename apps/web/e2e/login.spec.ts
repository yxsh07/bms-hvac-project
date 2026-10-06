import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows login page when not authenticated', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('BMS Digital Twin');
    await expect(page.locator('text=Sign in to continue')).toBeVisible();
  });

  test('allows login with demo credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'engineer@bms.local');
    await page.fill('input[type="password"]', 'eng123');
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=BMS Twin')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid@bms.local');
    await page.fill('input[type="password"]', 'wrong');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('shows demo account buttons', async ({ page }) => {
    await expect(page.locator('text=Demo accounts:')).toBeVisible();
    await expect(page.locator('text=HVAC Engineer')).toBeVisible();
    await expect(page.locator('text=Administrator')).toBeVisible();
  });

  test('clicking demo account fills credentials', async ({ page }) => {
    await page.click('text=HVAC Engineer');
    await expect(page.locator('input[type="email"]')).toHaveValue('engineer@bms.local');
    await expect(page.locator('input[type="password"]')).toHaveValue('eng123');
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'engineer@bms.local');
    await page.fill('input[type="password"]', 'eng123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('shows header with site selector', async ({ page }) => {
    await expect(page.locator('text=SimSite Hospital')).toBeVisible();
    await expect(page.locator('text=WB')).toBeVisible();
    await expect(page.locator('text=DB')).toBeVisible();
    await expect(page.locator('text=RH')).toBeVisible();
  });

  test('shows asset browser with assets', async ({ page }) => {
    await expect(page.locator('text=Chiller 1')).toBeVisible();
    await expect(page.locator('text=AHU-1')).toBeVisible();
  });

  test('can filter assets by search', async ({ page }) => {
    await page.fill('input[placeholder="Search assets..."]', 'Chiller');
    await expect(page.locator('text=Chiller 1')).toBeVisible();
    await expect(page.locator('text=AHU-1')).not.toBeVisible();
  });

  test('can filter assets by type', async ({ page }) => {
    await page.selectOption('select[aria-label="Type"]', 'ahu');
    await expect(page.locator('text=AHU-1')).toBeVisible();
    await expect(page.locator('text=Chiller 1')).not.toBeVisible();
  });

  test('shows asset detail when asset is selected', async ({ page }) => {
    await page.click('text=Chiller 1');
    await expect(page.locator('text=Chiller 1')).toBeVisible();
    await expect(page.locator('text=Run Status')).toBeVisible();
  });

  test('can navigate tabs', async ({ page }) => {
    await expect(page.locator('button[role="tab"]:has-text("Assets")')).toHaveAttribute('aria-selected', 'true');
    
    await page.click('button[role="tab"]:has-text("Plant Schematic")');
    await expect(page.locator('button[role="tab"]:has-text("Plant Schematic")')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('text=Plant Schematic (L2)')).toBeVisible();
    
    await page.click('button[role="tab"]:has-text("Building")');
    await expect(page.locator('text=Building View (L1)')).toBeVisible();
  });

  test('shows breadcrumb', async ({ page }) => {
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Assets')).toBeVisible();
  });

  test('shows user menu with role', async ({ page }) => {
    await page.click('button[aria-label*="HVAC Engineer"]');
    await expect(page.locator('text=Sign out')).toBeVisible();
  });
});

test.describe('Asset Detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'engineer@bms.local');
    await page.fill('input[type="password"]', 'eng123');
    await page.click('button[type="submit"]');
    await page.click('text=Chiller 1');
  });

  test('shows asset header with type badge', async ({ page }) => {
    await expect(page.locator('text=Chiller 1')).toBeVisible();
    await expect(page.locator('text=chiller')).toBeVisible();
  });

  test('shows point groups with correct classifications', async ({ page }) => {
    await expect(page.locator('text=Status')).toBeVisible();
    await expect(page.locator('text=Alarm')).toBeVisible();
    await expect(page.locator('text=Temperature')).toBeVisible();
    await expect(page.locator('text=Power')).toBeVisible();
  });

  test('shows point values with units', async ({ page }) => {
    await expect(page.locator('text=°C')).toBeVisible();
    await expect(page.locator('text=kW')).toBeVisible();
    await expect(page.locator('text=%')).toBeVisible();
  });
});

test.describe('Responsive', () => {
  test('tablet landscape viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('/');
    await page.fill('input[type="email"]', 'engineer@bms.local');
    await page.fill('input[type="password"]', 'eng123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=BMS Twin')).toBeVisible();
    await expect(page.locator('text=SimSite Hospital')).toBeVisible();
  });

  test('tablet portrait viewport', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('/');
    await page.fill('input[type="email"]', 'engineer@bms.local');
    await page.fill('input[type="password"]', 'eng123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=BMS Twin')).toBeVisible();
  });

  test('mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.fill('input[type="email"]', 'engineer@bms.local');
    await page.fill('input[type="password"]', 'eng123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=BMS Twin')).toBeVisible();
  });
});