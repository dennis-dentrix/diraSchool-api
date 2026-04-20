import { test, expect } from '@playwright/test';

test('landing page renders primary CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /start free trial/i })).toBeVisible();
});

test('login page renders form fields', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
});
