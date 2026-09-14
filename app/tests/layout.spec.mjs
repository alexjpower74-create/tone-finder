// Tap targets (hit-tested) and horizontal scroll on every page.
import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectTapTargets, press, tapExample, waitForAnswer } from './helpers.mjs';

async function openAllDetails(page, ti) {
  const summaries = page.locator('details:not([open]) > summary');
  while (await summaries.count()) await press(summaries.first(), ti);
}

const PAGES = [
  {
    name: 'Ask with results',
    open: async (page, ti) => {
      await page.goto('/index.html?mock=1');
      await tapExample(page, ti, 'the rhythm tone on Master of Puppets');
      await waitForAnswer(page);
      await openAllDetails(page, ti);
    },
  },
  {
    name: 'Ask with the Ares flag',
    open: async (page, ti) => {
      await page.goto('/index.html?mock=1');
      await tapExample(page, ti, 'AC30 chime');
      await expect(page.getByTestId('ares-flag')).toBeVisible();
      await openAllDetails(page, ti);
    },
  },
  {
    name: 'Ask with no support',
    open: async (page) => {
      await page.goto('/index.html?mock=1&q=banjo%20through%20a%20toaster');
      await waitForAnswer(page);
    },
  },
  {
    name: 'Models',
    open: async (page) => {
      await page.goto('/models.html?mock=1');
      await expect(page.getByTestId('model-row')).toHaveCount(109);
    },
  },
  {
    name: 'Model detail',
    open: async (page) => {
      await page.goto('/model.html?mock=1&id=usa-iic-plus-and-usa-iic-plus-plus');
      await expect(page.getByTestId('spec-table')).toBeVisible();
    },
  },
  {
    name: 'Binder with a pick',
    open: async (page, ti) => {
      await page.goto('/index.html?mock=1');
      await tapExample(page, ti, 'Van Halen brown sound');
      await press(page.getByRole('button', { name: 'Add to binder' }).first(), ti);
      await press(page.getByRole('navigation').getByRole('link', { name: 'Binder' }), ti);
      await expect(page.getByTestId('pick')).toHaveCount(1);
    },
  },
];

for (const p of PAGES) {
  test(`${p.name}: every button, chip and pill is ≥ 44 px and hit-tests to itself`, async ({ page }, ti) => {
    await p.open(page, ti);
    await expectTapTargets(page);
  });

  test(`${p.name}: no horizontal scroll`, async ({ page }, ti) => {
    await p.open(page, ti);
    await expectNoHorizontalScroll(page);
  });
}
