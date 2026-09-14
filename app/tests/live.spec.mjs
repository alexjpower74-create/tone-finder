// The Ask journey against a real Worker. Skipped unless TF_LIVE_API is set (the lead runs it in QA):
//   TF_LIVE_API=http://127.0.0.1:8308 TF_APP_PORT=8309 npx playwright test -c app/playwright.config.mjs live
import { expect, test } from '@playwright/test';
import { NO_SUPPORT, PAGE_PILL, typeQuery } from './helpers.mjs';

const API = process.env.TF_LIVE_API;

test.skip(!API, 'TF_LIVE_API is not set');

test.beforeEach(async ({ page }) => {
  await page.goto(`/index.html?api=${encodeURIComponent(API)}`);
  await expect(page.getByTestId('demo-pill')).toHaveCount(0);
});

test('live: Van Halen brown sound gives cited cards and survives a reload', async ({ page }, ti) => {
  await typeQuery(page, ti, 'Van Halen brown sound');
  const cards = page.getByTestId('suggestion');
  await expect(cards.first()).toBeVisible({ timeout: 60_000 });
  const n = await cards.count();
  expect(n).toBeGreaterThanOrEqual(1);
  expect(n).toBeLessThanOrEqual(4);
  for (let i = 0; i < n; i++) {
    const pills = cards.nth(i).getByTestId('quote').locator('.pill-page');
    expect(await pills.count()).toBeGreaterThanOrEqual(1);
    for (const t of await pills.allTextContents()) expect(t.trim()).toMatch(PAGE_PILL);
  }
  await page.reload();
  await expect(page.getByLabel('What tone are you after?')).toHaveValue('Van Halen brown sound');
  await expect(page.getByTestId('suggestion')).toHaveCount(n, { timeout: 60_000 });
  await expect(page).toHaveURL(/[?&]api=/);
});

test('live: banjo through a toaster has no guide support', async ({ page }, ti) => {
  await typeQuery(page, ti, 'banjo through a toaster');
  await expect(page.getByRole('heading', { name: NO_SUPPORT, exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('suggestion')).toHaveCount(0);
});
