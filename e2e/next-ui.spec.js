import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './auth-helper.js';

// Smoke tests for the new ("Next") UI toggle and core pages.

async function dismissAnyModals(page) {
  // In case the first-run Next UI pops the merge picker etc.
  const close = page.getByRole('button', { name: /Cancel|Close/ });
  if (await close.count().then(c => c > 0)) {
    await close.first().click({ trial: true }).catch(() => {});
  }
}

test('UI version toggle pill flips between Legacy and Next', async ({ page }) => {
  await loginAsAdmin(page, expect);

  // Default boot: Legacy UI is visible. Pill says "Legacy".
  const pill = page.getByRole('button', { name: /UI/ });
  await expect(pill).toBeVisible();
  await expect(pill).toContainText('Legacy');

  // Click pill → Next UI shell renders with sidebar items.
  await pill.click();
  await expect(pill).toContainText('Next');
  await expect(page.getByText('Workflow')).toBeVisible();
  // Sidebar renders the Time log nav link.
  await expect(page.getByText('Time log').first()).toBeVisible();

  // Click again → back to Legacy.
  await pill.click();
  await expect(pill).toContainText('Legacy');
});

test('?ui=next URL param forces Next UI on load', async ({ page }) => {
  await loginAsAdmin(page, expect);
  await page.goto('/?ui=next');
  const pill = page.getByRole('button', { name: /UI/ });
  await expect(pill).toContainText('Next');
  await expect(page.getByText('Workflow')).toBeVisible();
});

test('Next UI → Time log: can log an entry and see it in the list', async ({ page }) => {
  await loginAsAdmin(page, expect);
  await page.goto('/?ui=next#timelog');

  await expect(page.getByRole('heading', { name: 'Time log' })).toBeVisible();

  const itemInput = page.getByPlaceholder(/花時間在什麼上面/);
  await itemInput.fill('E2E coding');
  await page.getByRole('button', { name: /Log/ }).click();

  // Entry appears somewhere (list + summary). `.first()` is enough for a smoke test.
  await expect(page.getByText('E2E coding').first()).toBeVisible();
  // Hours column shows "1.00h" (default 1)
  await expect(page.getByText('1.00h').first()).toBeVisible();

  // Summary side panel reflects the entry
  await expect(page.getByText(/Overall · 1\.00h/)).toBeVisible();
});
