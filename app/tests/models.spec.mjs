import { expect, test } from '@playwright/test';
import { PAGE_PILL, press } from './helpers.mjs';

const showingCount = async (page) => {
  const text = (await page.locator('#showing').textContent()) ?? '';
  const m = text.match(/^Showing (\d+) of 109$/);
  expect(m, `unexpected "${text}"`).not.toBeNull();
  return Number(m[1]);
};

test.beforeEach(async ({ page }) => {
  await page.goto('/models.html?mock=1');
  await expect(page.locator('#showing')).toHaveText('Showing 109 of 109');
});

test('brand Marshall narrows the list and every row carries a Marshall pill', async ({ page }, ti) => {
  await press(page.locator('[data-filter="brand"][data-value="Marshall"]'), ti);
  await expect(page.locator('#showing')).not.toHaveText('Showing 109 of 109');
  const n = await showingCount(page);
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(109);
  const rows = page.getByTestId('model-row');
  await expect(rows).toHaveCount(n);
  for (let i = 0; i < n; i++) {
    await expect(rows.nth(i).getByTestId('brand-pill').filter({ hasText: /^Marshall$/ })).toHaveCount(1);
  }
  await expect(page).toHaveURL(/[?&]brand=Marshall/);
  await expect(page.locator('[data-filter="brand"][data-value="Marshall"]')).toHaveAttribute('aria-pressed', 'true');
});

test('master volume "No" filters to no-master-volume models', async ({ page }, ti) => {
  await press(page.locator('[data-filter="mv"][data-value="no"]'), ti);
  await expect(page.locator('#showing')).not.toHaveText('Showing 109 of 109');
  const n = await showingCount(page);
  const rows = page.getByTestId('model-row');
  await expect(rows).toHaveCount(n);
  for (let i = 0; i < n; i++) await expect(rows.nth(i)).toContainText('Master volume: No');
  await expect(page).toHaveURL(/[?&]mv=no/);
});

test('filter by name', async ({ page }, ti) => {
  await press(page.getByLabel('Filter by name'), ti);
  await page.keyboard.type('IIC');
  await expect(page.locator('#showing')).not.toHaveText('Showing 109 of 109');
  const n = await showingCount(page);
  expect(n).toBeGreaterThan(0);
  const rows = page.getByTestId('model-row');
  for (let i = 0; i < n; i++) await expect(rows.nth(i)).toContainText(/IIC/i);
  await expect(page).toHaveURL(/[?&]q=IIC/);
});

test('a stub row links to its target', async ({ page }, ti) => {
  const stub = page.locator('[data-testid="model-row"][data-stub="true"][data-model-id="brit-super"]');
  await expect(stub).toContainText('See Brit AFS100 and Brit Super');
  await press(stub, ti);
  await expect(page).toHaveURL(/model\.html\?.*id=brit-afs100-and-brit-super/);
  await expect(page).toHaveURL(/[?&]mock=1/);
  await expect(page.getByTestId('model-name')).toHaveText('Brit AFS100 and Brit Super');
});

test('tapping a row opens the detail with a spec table and page pills', async ({ page }, ti) => {
  await press(page.locator('[data-testid="model-row"][data-model-id="1959slp"]'), ti);
  await expect(page.getByTestId('model-name')).toHaveText('1959SLP');
  const table = page.getByTestId('spec-table');
  await expect(table).toBeVisible();
  await expect(table.getByRole('row', { name: /Power tubes/ })).toContainText('EL34');
  await expect(table.getByRole('row', { name: /Master volume/ })).toContainText('No');
  await expect(page.getByTestId('model-pages')).toHaveText('Pages 28–31 in the guide.');
  const pills = page.locator('main .pill-page');
  expect(await pills.count()).toBeGreaterThanOrEqual(3);
  for (const t of await pills.allTextContents()) expect(t.trim()).toMatch(PAGE_PILL);
});

test('unknown model id', async ({ page }, ti) => {
  await page.goto('/model.html?mock=1&id=no-such-amp');
  await expect(page.getByRole('heading', { name: 'No model with that id.' })).toBeVisible();
  await press(page.getByRole('link', { name: 'Back to Models' }), ti);
  await expect(page.locator('#showing')).toHaveText('Showing 109 of 109');
});
