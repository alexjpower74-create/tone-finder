// Box breaks (API.md §4.2): no quote in the mock fixtures spans one, and the contract's table holds.
// Reads the local guide from TF_GUIDE_DIR; a missing guide fails the run (it never silently skips).
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { boxBreaks, cutAttribution, normText, parsePages, spansBoxBreak } from '../tools/guide-text.mjs';
import { ONCE, quotesIn, readFixture } from './fixtures.mjs';

const GUIDE_DIR = process.env.TF_GUIDE_DIR || '/home/alexander/Claude/Reference/Yek Fractal Amp Guide';
let pages = null;
function raw(n) {
  if (!pages) {
    let full;
    try {
      full = readFileSync(`${GUIDE_DIR}/yek-guide-fulltext.txt`, 'utf8');
    } catch {
      throw new Error(`guide not found at ${GUIDE_DIR}`);
    }
    pages = parsePages(full);
  }
  return pages.get(n);
}

test.beforeEach(({}, ti) => test.skip(ti.project.name !== ONCE, 'data checks run once'));

test('box-break offsets land on run starts in pageText, on every page', () => {
  let total = 0;
  for (let n = 1; n <= 301; n++) {
    const text = normText(raw(n));
    for (const o of boxBreaks(raw(n))) {
      total++;
      expect(o, `p. ${n}`).toBeGreaterThan(0);
      expect(o, `p. ${n}`).toBeLessThan(text.length);
      expect(text[o - 1], `p. ${n} offset ${o}`).toBe(' ');
    }
  }
  expect(total).toBeGreaterThan(300);
});

// The lead's table, checked on the raw pages (API.md §4.2).
const TABLE = [
  [28, 'Or just crank everything, like Eddie Van Halen “My settings for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5.', true],
  [33, 'These tonal characteristics are what define this much respected all-valve head.” – Marshall The re-issue has two EL34 tubes', true],
  [125, 'Set the gain around 6 and then bring the master to taste” – Manual', true],
  [16, 'The name “Twin” probably refers to the use of two 12” speakers.', false],
  [28, 'Plexis with 4x12 cabinets gave rise to the “Marshall stack”.', false],
  [146, 'Model of the Bogner Uberschall, called “Armageddon in a box” by Bogner', false],
];
for (const [page, quote, spans] of TABLE) {
  test(`§4.2 table: p. ${page} ${spans ? 'spans' : "doesn't span"} “${quote.slice(0, 40)}…”`, () => {
    // The quote must really be on the page, or "doesn't span" would pass for the wrong reason.
    expect(normText(raw(page)).includes(quote)).toBe(true);
    expect(spansBoxBreak(quote, raw(page))).toBe(spans);
  });
}

for (const file of ['models.json', 'answers.json']) {
  test(`no quote in app/mock/${file} spans a box break`, () => {
    const quotes = quotesIn(readFixture(file)).filter((q) => Number.isInteger(q.page));
    expect(quotes.length).toBeGreaterThan(10);
    const spanning = quotes.filter((q) => spansBoxBreak(q.quote, raw(q.page))).map((q) => `${q.path} p. ${q.page}: ${q.quote}`);
    // Same attribution definition as the builder (" – yek", " – Cliff", …). A list separator such as
    // "3x10 Vibrato King – Cab Pack" is not an attribution.
    const endsWithAttribution = quotes.filter((q) => cutAttribution(q.quote).quote !== q.quote).map((q) => `${q.path}: ${q.quote}`);
    expect(spanning).toEqual([]);
    expect(endsWithAttribution).toEqual([]);
  });
}
