// No quote in the mock fixtures is a joined passage (lead round 2, API.md §4.2).
import { expect, test } from '@playwright/test';
import { hasJoin, rawOpenQuoteHits } from '../tools/guide-text.mjs';
import { ONCE, quotesIn, readFixture } from './fixtures.mjs';

test.beforeEach(({}, ti) => test.skip(ti.project.name !== ONCE, 'data checks run once'));

test('the join detector catches the known glued passage and spares inline quoted words', () => {
  expect(hasJoin('Or just crank everything, like Eddie Van Halen “My settings for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5.')).toBe(true);
  expect(hasJoin('Adjust Presence to taste.” – Cliff')).toBe(true);
  expect(hasJoin('Eddie van Halen’s legendary “Brown Sound” probably is the most sought-after guitar tone')).toBe(false);
  expect(hasJoin('“My settings for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5.')).toBe(false);
  expect(hasJoin('Marshall stock cabs – Cab Packs')).toBe(false);
});

for (const file of ['models.json', 'answers.json']) {
  test(`no joined passage in app/mock/${file}`, () => {
    const quotes = quotesIn(readFixture(file));
    expect(quotes.length).toBeGreaterThan(10);
    const joined = quotes.filter((q) => hasJoin(q.quote)).map((q) => `${q.path} p. ${q.page}: ${q.quote}`);
    const inline = quotes.filter((q) => rawOpenQuoteHits(q.quote) > 0 && !hasJoin(q.quote)).length;
    console.log(`${file}: ${quotes.length} quotes, ${inline} contain a short inline “quoted” phrase (allowed)`);
    expect(joined).toEqual([]);
  });
}
