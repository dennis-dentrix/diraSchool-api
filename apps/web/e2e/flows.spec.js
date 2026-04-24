/**
 * Core workflow e2e tests.
 *
 * Requires a running dev server + seeded DB with the test school admin account.
 * Set TEST_EMAIL / TEST_PASSWORD env vars, or defaults are used.
 *
 * Run: npx playwright test e2e/flows.spec.js
 */
import { test, expect } from '@playwright/test';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Returns a unique suffix based on current timestamp. */
const uid = () => Date.now().toString().slice(-6);

/** Waits for and dismisses any toast notification matching text. */
async function expectToast(page, pattern) {
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: pattern })).toBeVisible({
    timeout: 10_000,
  });
}

// ── 1. Full enrollment flow ───────────────────────────────────────────────────

test('enrollment: login → enroll student → verify in list', async ({ page }) => {
  const admNumber = `TST-${uid()}`;
  const firstName = 'Playwright';
  const lastName  = `Student${uid()}`;

  // Navigate to Students
  await page.goto('/students');
  await expect(page.getByRole('heading', { name: /students/i })).toBeVisible();

  // Open enrollment dialog
  await page.getByRole('button', { name: /enroll student/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Fill required fields
  await page.getByLabel(/first name/i).first().fill(firstName);
  await page.getByLabel(/last name/i).first().fill(lastName);
  await page.getByLabel(/admission no/i).fill(admNumber);

  // Gender select
  const genderTrigger = page.getByRole('combobox').filter({ hasText: /select/i }).first();
  await genderTrigger.click();
  await page.getByRole('option', { name: /male/i }).first().click();

  // Class select — pick first available class
  const classTrigger = page.getByRole('combobox').filter({ hasText: /select class/i });
  await classTrigger.click();
  await page.getByRole('option').first().click();

  // Submit
  await page.getByRole('button', { name: /enroll student/i }).last().click();

  // Confirm toast
  await expectToast(page, /enrolled successfully/i);

  // Dialog should close
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

  // Student should appear in the table
  await expect(page.getByText(admNumber)).toBeVisible({ timeout: 8_000 });
});

// ── 2. Attendance entry flow ──────────────────────────────────────────────────

test('attendance: select class → mark students → submit → verify saved', async ({ page }) => {
  await page.goto('/attendance');
  await expect(page.getByRole('heading', { name: /attendance/i })).toBeVisible();

  // Select a class — the page should show a class selector or auto-load
  const classSelect = page.getByRole('combobox').first();
  if (await classSelect.isVisible()) {
    await classSelect.click();
    await page.getByRole('option').first().click();
  }

  // Wait for the student list to load
  await page.waitForSelector('[data-testid="attendance-row"], .attendance-row, table tbody tr', {
    timeout: 10_000,
  }).catch(() => null);

  // Mark first student as present (toggle or click present radio/button)
  const presentButtons = page.getByRole('button', { name: /present/i });
  const presentCount = await presentButtons.count();
  if (presentCount > 0) {
    await presentButtons.first().click();
  } else {
    // Fallback: click first checkbox in the table
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    if (await firstCheckbox.isVisible()) await firstCheckbox.check();
  }

  // Submit the register
  const submitBtn = page.getByRole('button', { name: /submit|save/i });
  await expect(submitBtn).toBeVisible({ timeout: 5_000 });
  await submitBtn.click();

  // Expect success feedback
  await expectToast(page, /saved|submitted|recorded/i);
});

// ── 3. Fee payment flow — receipt numbers must be unique ─────────────────────

test('fee payment: record two payments → receipt numbers differ', async ({ page }) => {
  const receipts = [];

  for (let i = 0; i < 2; i++) {
    await page.goto('/fees/payments');
    await expect(page.getByRole('heading', { name: /payments/i })).toBeVisible();

    // Open record payment dialog
    await page.getByRole('button', { name: /record payment/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select first student in the combobox/select
    const studentSelect = page.getByRole('combobox').first();
    await studentSelect.click();
    await page.getByRole('option').first().click();

    // Fill amount
    const amountInput = page.getByLabel(/amount/i);
    await amountInput.fill('500');

    // Method — pick first option if a select is shown
    const methodSelect = page.getByRole('combobox').filter({ hasText: /cash|mpesa|bank|method/i });
    if (await methodSelect.isVisible()) {
      await methodSelect.click();
      await page.getByRole('option').first().click();
    }

    await page.getByRole('button', { name: /record|save/i }).last().click();
    await expectToast(page, /payment recorded|success/i);

    // Close dialog if still open
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible()) {
      await page.keyboard.press('Escape');
    }

    // Grab the most recent receipt number from the payments table
    await page.waitForSelector('table tbody tr', { timeout: 8_000 });
    const firstRow = page.locator('table tbody tr').first();
    const receiptText = await firstRow.textContent();
    const match = receiptText?.match(/RCT-\d{4}-\d{5}/);
    if (match) receipts.push(match[0]);
  }

  // Both receipts should be captured and different
  expect(receipts.length).toBe(2);
  expect(receipts[0]).not.toBe(receipts[1]);
});

// ── 4. Report card flow ───────────────────────────────────────────────────────

test('report card: open card → generate PDF → status becomes queued', async ({ page }) => {
  await page.goto('/report-cards');
  await expect(page.getByRole('heading', { name: /report card/i })).toBeVisible();

  // Click into the first report card in the list
  const firstLink = page.getByRole('link').filter({ hasText: /view|open/i }).first();
  const firstRow = page.locator('table tbody tr').first();

  if (await firstLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await firstLink.click();
  } else if (await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await firstRow.click();
  } else {
    test.skip(true, 'No report cards in list — seed data required');
    return;
  }

  await page.waitForURL('**/report-cards/**', { timeout: 8_000 });

  // Check current PDF status
  const generateBtn = page.getByRole('button', { name: /generate pdf/i });
  const alreadyQueued = page.getByText(/queued|processing/i);

  if (await alreadyQueued.isVisible({ timeout: 2_000 }).catch(() => false)) {
    // Already in a queued/processing state — test passes
    return;
  }

  // Click Generate PDF
  await expect(generateBtn).toBeVisible({ timeout: 5_000 });
  await generateBtn.click();

  // Confirm request was accepted via toast
  await expectToast(page, /pdf generation queued|generating|queued/i);

  // Status card should transition to queued or processing
  await expect(page.getByText(/queued|processing/i)).toBeVisible({ timeout: 10_000 });
});
