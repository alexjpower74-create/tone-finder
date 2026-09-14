import { expect, test } from '@playwright/test';
import { GK_LABEL, GUESS_NOTE, NO_SUPPORT, PAGE_PILL, press, tapExample, typeQuery, waitForAnswer } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html?mock=1');
  await expect(page.getByTestId('demo-pill')).toHaveText('Demo data');
});

async function expectCitedCards(page) {
  const cards = page.getByTestId('suggestion');
  await expect(cards.first()).toBeVisible();
  const n = await cards.count();
  expect(n).toBeGreaterThanOrEqual(1);
  expect(n).toBeLessThanOrEqual(4);
  for (let i = 0; i < n; i++) {
    const quotes = cards.nth(i).locator('.quote').filter({ has: page.locator('q') });
    expect(await quotes.count(), `card ${i + 1} has no quote`).toBeGreaterThanOrEqual(1);
    const pills = cards.nth(i).getByTestId('quote').locator('.pill-page');
    expect(await pills.count(), `card ${i + 1} has no page pill`).toBeGreaterThanOrEqual(1);
    for (const text of await pills.allTextContents()) expect(text.trim()).toMatch(PAGE_PILL);
  }
  return n;
}

test('typing a tone gives 1–4 cited cards, and ?q= survives a reload', async ({ page }, ti) => {
  await typeQuery(page, ti, 'Van Halen brown sound');
  const n = await expectCitedCards(page);
  await expect(page.getByTestId('understood')).toContainText('Found in the guide: van halen, brown sound');
  await expect(page).toHaveURL(/[?&]q=Van(\+|%20)Halen(\+|%20)brown(\+|%20)sound/);
  await expect(page).toHaveURL(/[?&]mock=1/);

  await page.reload();
  await expect(page.getByLabel('What tone are you after?')).toHaveValue('Van Halen brown sound');
  await expect(page.getByTestId('suggestion')).toHaveCount(n);
  await expectCitedCards(page);
});

test('tapping an example chip shows its answer', async ({ page }, ti) => {
  await tapExample(page, ti, 'Robben Ford');
  await expect(page.getByLabel('What tone are you after?')).toHaveValue('Robben Ford');
  await expectCitedCards(page);
  await expect(page.getByTestId('suggestion').first().locator('.unit-name')).toHaveText('Bludojai');
});

test('no support: exact heading and zero cards', async ({ page }, ti) => {
  await typeQuery(page, ti, 'banjo through a toaster');
  const heading = page.getByRole('heading', { name: NO_SUPPORT, exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText(NO_SUPPORT);
  await expect(page.getByTestId('suggestion')).toHaveCount(0);
  await expect(page.getByTestId('no-support')).toContainText('Not in the guide: banjo');
});

test('guesses look like guesses; guide knobs carry page pills and a direction nudge', async ({ page }, ti) => {
  await tapExample(page, ti, 'Van Halen brown sound');
  const allGuess = page.locator('[data-testid="suggestion"][data-model-id="brit-brown-and-fas-brown"]');
  await expect(allGuess).toBeVisible();
  const dials = allGuess.getByTestId('dial');
  await expect(dials).toHaveCount(7);
  for (let i = 0; i < 7; i++) {
    const dial = dials.nth(i);
    await expect(dial).toHaveAttribute('data-kind', 'guess');
    await expect(dial.getByRole('img')).toHaveAttribute('aria-label', new RegExp(`\\d, ${GUESS_NOTE}$`));
    await expect(dial.getByText('guess', { exact: true })).toBeVisible();
    const ring = await dial.locator('.dial-arc, .dial-track').first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { dash: cs.strokeDasharray, stroke: cs.stroke };
    });
    expect(ring.dash, 'guess ring must be dashed').not.toBe('none');
    expect(ring.stroke).toMatch(/255, 194, 77/);
    await expect(dial.locator('.pill-page')).toHaveCount(0);
  }
  await expect(allGuess.getByTestId('guess-note')).toBeVisible();
  await expect(allGuess.getByTestId('guess-note')).toHaveText(GUESS_NOTE);

  // The guide card in the same answer: solid teal rings, never the guess note on a guide dial.
  const guideDial = page.locator('[data-model-id="1959slp"] [data-testid="dial"][data-kind="guide"]').first();
  await expect(guideDial).toBeVisible();
  const solid = await guideDial.locator('.dial-arc').evaluate((el) => getComputedStyle(el).strokeDasharray);
  expect(solid).toBe('none');
  await expect(guideDial.getByRole('img')).not.toHaveAttribute('aria-label', new RegExp(GUESS_NOTE));

  await typeQuery(page, ti, 'JTM 45');
  const card = page.locator('[data-testid="suggestion"][data-model-id="brit-jm45"]');
  await expect(card).toBeVisible();
  const guide = card.locator('[data-testid="dial"][data-kind="guide"]');
  expect(await guide.count()).toBeGreaterThanOrEqual(1);
  for (let i = 0; i < (await guide.count()); i++) {
    await expect(guide.nth(i).locator('.pill-page')).toHaveText(PAGE_PILL);
  }
  const nudge = card.getByTestId('nudge');
  await expect(nudge).toBeVisible();
  await expect(nudge).toContainText(/^Bass nudged down: /);
  await expect(nudge.locator('.pill-page')).toHaveText(PAGE_PILL);
});

test('general knowledge is labelled and the AI drops list Brown Sound Deluxe', async ({ page }, ti) => {
  await tapExample(page, ti, 'the rhythm tone on Master of Puppets');
  const gk = page.getByTestId('general-knowledge');
  await expect(gk).toBeVisible();
  await expect(gk.getByRole('heading')).toHaveText(GK_LABEL);
  await expect(page.getByTestId('understood')).toContainText('Words the AI added: metallica');
  await expect(page.getByTestId('source-pill').first()).toHaveText('AI pick · quotes checked');

  const drops = page.getByTestId('ai-drops');
  await expect(drops.locator('summary')).toHaveText(/The AI suggested 2 things we couldn't find in the guide/);
  await expect(drops.getByText('Brown Sound Deluxe: not an Axe-Fx II model in the guide')).toBeHidden();
  await press(drops.locator('summary'), ti);
  await expect(drops.getByText('Brown Sound Deluxe: not an Axe-Fx II model in the guide')).toBeVisible();

  // With AI help switched off the guide alone can't support it.
  await press(page.locator('label.switch'), ti);
  await expect(page.getByTestId('ai-status')).toContainText('AI help: off');
  await expect(page.getByRole('heading', { name: NO_SUPPORT, exact: true })).toBeVisible();
  await expect(page.getByTestId('general-knowledge')).toHaveCount(0);
});

test('Ares: planted flag callout and both release-note sources', async ({ page }, ti) => {
  await tapExample(page, ti, 'AC30 chime');
  await waitForAnswer(page);
  const flag = page.getByTestId('ares-flag');
  await expect(flag).toHaveCount(1);
  await expect(flag).toBeVisible();
  await expect(flag).toContainText('Transformer Grind');
  await expect(flag).toContainText('SAMPLE (test only):');
  await expect(flag).toContainText('Speaker Compression (Spkr Comp)');

  const sources = page.getByTestId('ares-sources');
  const urls = [
    'https://forum.fractalaudio.com/threads/axe-fx-ii-quantum-rev-9-00-firmware-release.131649/',
    'https://forum.fractalaudio.com/threads/axe-fx-ii-ares-rev-1-00-firmware-release.148248/',
  ];
  for (const url of urls) await expect(sources.getByRole('link', { name: url })).toBeHidden();
  await press(sources.locator('summary'), ti);
  for (const url of urls) await expect(sources.getByRole('link', { name: url })).toBeVisible();
});
