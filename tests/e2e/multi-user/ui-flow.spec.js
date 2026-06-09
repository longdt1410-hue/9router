import { test, expect } from '@playwright/test';
import { uniqueUsername } from './helpers.js';

test.describe('User Portal UI Flow', () => {
  test('register new user via UI', async ({ page }) => {
    const username = uniqueUsername('ui_reg');
    const password = 'uipass123';

    await page.goto('/user-portal/register');

    // Fill registration form
    await page.fill('input[placeholder="Choose a username"]', username);
    await page.fill('input[placeholder="Choose a password"]', password);
    await page.fill('input[placeholder="Confirm your password"]', password);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('**/user-portal/dashboard', { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('login via UI', async ({ page, request }) => {
    const username = uniqueUsername('ui_login');
    const password = 'uipass123';

    // Register via API first
    const regRes = await request.post('/api/multi/register', {
      data: { username, password },
    });
    expect(regRes.status()).toBe(201);

    // Navigate to login page
    await page.goto('/user-portal/login');

    // Fill login form
    await page.fill('input[placeholder="Enter username"]', username);
    await page.fill('input[placeholder="Enter password"]', password);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('**/user-portal/dashboard', { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('dashboard loads after login', async ({ page, request }) => {
    const username = uniqueUsername('ui_dash');
    const password = 'uipass123';

    // Register via API
    const regRes = await request.post('/api/multi/register', {
      data: { username, password },
    });
    expect(regRes.status()).toBe(201);
    const regData = await regRes.json();
    const token = regData.token;

    // Navigate to login page first to set localStorage on the correct origin
    await page.goto('/user-portal/login');
    await page.evaluate((t) => {
      localStorage.setItem('multi_user_token', t);
    }, token);

    // Now navigate to dashboard
    await page.goto('/user-portal/dashboard');

    // Dashboard should load with profile info
    await expect(page.locator('h1')).toContainText('Dashboard', { timeout: 15000 });
    // Should show the username somewhere on the page
    await expect(page.getByRole('main').getByText(username)).toBeVisible({ timeout: 10000 });
  });

  test('keys page - create a key via UI', async ({ page, request }) => {
    const username = uniqueUsername('ui_keys');
    const password = 'uipass123';

    // Register via API
    const regRes = await request.post('/api/multi/register', {
      data: { username, password },
    });
    expect(regRes.status()).toBe(201);
    const regData = await regRes.json();
    const token = regData.token;

    // Navigate to login page first to set localStorage on the correct origin
    await page.goto('/user-portal/login');
    await page.evaluate((t) => {
      localStorage.setItem('multi_user_token', t);
    }, token);

    // Navigate to keys page
    await page.goto('/user-portal/keys');

    // Wait for keys page to load
    await expect(page.locator('h1')).toContainText('API Keys', { timeout: 15000 });

    // Fill in key name and create
    await page.fill('input[placeholder*="Key name"]', 'My Test Key');
    await page.click('button:has-text("Create")');

    // Should show the created key
    await expect(page.locator('text=My Test Key')).toBeVisible({ timeout: 10000 });
  });

  test('login page shows error for invalid credentials', async ({ page }) => {
    await page.goto('/user-portal/login');

    // Fill with invalid credentials
    await page.fill('input[placeholder="Enter username"]', 'nonexistent_user');
    await page.fill('input[placeholder="Enter password"]', 'wrongpass');

    // Submit
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 10000 });
  });

  test('navigation from login to register page', async ({ page }) => {
    await page.goto('/user-portal/login');

    // Click on register link
    await page.click('a[href="/user-portal/register"]');

    // Should be on register page
    await expect(page.locator('h1')).toContainText('Create Account');
  });
});
