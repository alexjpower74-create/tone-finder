// Every dial with a page pill shows the sentence it comes from, and that sentence states the knob's value
// (docs/API.md §4.3, §8). Lead fix after Onyx's review: "Master 10 · p. 12" sat next to the taper note only.
import { expect, test } from '@playwright/test';
import { readFixture } from './fixtures.mjs';
import { typeQuery } from './helpers.mjs';
import { checkAnswer } from './shape.mjs';
import { quoteSupportsKnob } from '../../core/knobs.js';
import { parseControlHints } from '../../core/labels.js';

const models = readFixture('models.json').models;
const hintsFor = (id) => parseControlHints(models.find((m) => m.id === id)?.controls?.quote);

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html?mock=1');
});

test('each guide dial has its own sentence displayed, with the same page, stating the value', async ({ page }, ti) => {
  let dials = 0;
  let rules = 0;
  for (const query of ['JTM 45', 'Plexi crunch']) {
    await typeQuery(page, ti, query);
    await expect(page.locator('#status')).toContainText(query);
    const cards = page.locator('[data-testid="suggestion"]');
    for (let c = 0; c < (await cards.count()); c++) {
      const card = cards.nth(c);
      const id = await card.getAttribute('data-model-id');
      const guide = card.locator('[data-testid="dial"][data-kind="guide"], [data-testid="dial"][data-kind="guide_rule"]');
      for (let i = 0; i < (await guide.count()); i++) {
        const dial = guide.nth(i);
        const knob = await dial.getAttribute('data-knob');
        const kind = await dial.getAttribute('data-kind');
        const value = Number(await dial.locator('.dial-value').textContent());
        const pill = (await dial.locator('.pill-page').textContent()).trim();
        const source = card.locator(`[data-testid="knob-source"][data-knobs~="${knob}"], [data-testid="knob-source"]`).filter({
          has: page.locator('.quote-text'),
        });
        const matching = [];
        for (let j = 0; j < (await source.count()); j++) {
          const li = source.nth(j);
          const knobs = (await li.getAttribute('data-knobs')).split(',');
          if (knobs.includes(knob)) matching.push(li);
        }
        expect(matching.length, `${id} ${knob}: no displayed sentence`).toBe(1);
        const li = matching[0];
        await expect(li).toBeVisible();
        const text = await li.locator('.quote-text').textContent();
        expect((await li.locator('.pill-page').textContent()).trim(), `${id} ${knob}: page differs from the dial's`).toBe(pill);
        expect(quoteSupportsKnob(knob, value, text, hintsFor(id)), `${id} ${knob} ${value}: "${text}"`).toBe(true);
        await expect(li.locator('.nudge-label')).toContainText(`${knob} ${value}`);
        dials++;
        if (kind === 'guide_rule') rules++;
      }
      const taper = card.getByTestId('taper-note');
      if (await taper.count()) await expect(taper).toContainText('About knob tapers (not a knob setting):');
    }
  }
  expect(dials, 'no guide dials were checked').toBeGreaterThanOrEqual(4);
  expect(rules, 'no guide-rule dial (Master 10) was checked').toBeGreaterThanOrEqual(1);
});

test('negative control: the taper sentence planted on Master 10 is rejected by the shape check', async ({}, ti) => {
  test.skip(ti.project.name !== 'chromium-1280', 'data check runs once');
  const answers = readFixture('answers.json').answers;
  const answer = Object.values(answers)
    .flatMap((e) => [e.on, e.off])
    .find((a) => a?.suggestions?.some((s) => s.knobs.some((k) => k.kind === 'guide_rule')));
  expect(answer, 'no fixture answer with a guide-rule knob').toBeTruthy();
  expect(checkAnswer(answer)).toEqual([]);
  const taper = readFixture('models.json').conventions.find((c) => c.id === 'taper-match');
  const planted = JSON.parse(JSON.stringify(answer));
  const knob = planted.suggestions.flatMap((s) => s.knobs).find((k) => k.kind === 'guide_rule');
  knob.quote = taper.quote;
  knob.page = taper.page;
  const problems = checkAnswer(planted);
  expect(problems.join('\n')).toContain(`the quote doesn't state ${knob.knob} ${knob.value}, so it can't carry a page`);
});
