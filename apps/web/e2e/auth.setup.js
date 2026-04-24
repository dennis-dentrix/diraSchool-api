import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUTH_FILE = path.join(__dirname, '.auth/user.json');

setup('authenticate as school admin', async ({ page }) => {
  const email    = process.env.TEST_EMAIL    || 'admin@diraschool.com';
  const password = process.env.TEST_PASSWORD || 'TestAdmin@2025';

  await page.goto('/login');
  await expect(page.getByLabel(/email/i)).toBeVisible();

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /login|sign in/i }).click();

  // Wait for dashboard redirect — confirms auth cookie is set
  await page.waitForURL('**/dashboard', { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
