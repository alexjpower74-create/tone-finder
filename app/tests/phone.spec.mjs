// Phone results (lead round 2, D): contained chip row, and the first card on screen after a search.
import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, isTouch, NO_SUPPORT, press, typeQuery } from './helpers.mjs';

test.beforeEach(async ({ page }, ti) => {
  test.skip(!isTouch(ti), 'phone layout (390 px, touch)');
  await page.goto('/index.html?mock=1');
});

const hitsItself = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return Boolean(hit) && (hit === el || el.contains(hit));
  });

test('type + Enter: focus moves to the summary and the first card title is on screen', async ({ page }, ti) => {
  await typeQuery(page, ti, 'Van Halen brown sound');
  const title = page.getByTestId('suggestion').first().locator('.unit-name');
  await expect(title).toHaveText('Brit Brown');
  await expect(page.locator('#status')).toBeFocused();
  // The summary line was brought to the top (without it, it sits below the ask panel).
  await expect.poll(() => page.locator('#status').evaluate((el) => el.getBoundingClientRect().top)).toBeLessThan(40);
  await expect.poll(() => hitsItself(title)).toBe(true);
});

test('no support: focus moves to the heading and it is on screen', async ({ page }, ti) => {
  await typeQuery(page, ti, 'banjo through a toaster');
  const heading = page.getByRole('heading', { name: NO_SUPPORT, exact: true });
  await expect(heading).toBeFocused();
  await expect.poll(() => hitsItself(heading)).toBe(true);
});

test('example chips sit in one row that scrolls; the page does not', async ({ page }, ti) => {
  const row = page.locator('#examples');
  const geo = await row.evaluate((el) => ({
    scroll: el.scrollWidth,
    client: el.clientWidth,
    rows: new Set([...el.children].map((c) => Math.round(c.getBoundingClientRect().top))).size,
  }));
  expect(geo.rows).toBe(1);
  expect(geo.scroll).toBeGreaterThan(geo.client);
  await expectNoHorizontalScroll(page);

  // The last chip starts out of the row's view; tapping it scrolls the row, not the page.
  await press(page.getByRole('button', { name: 'djent', exact: true }), ti);
  expect(await row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await expect(page.getByTestId('suggestion').first().locator('.unit-name')).toHaveText('Thordendal');
  await expectNoHorizontalScroll(page);
});
