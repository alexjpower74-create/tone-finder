// Box breaks and clean quotes (API.md §0, §4.2), checked with core's own functions so the mock can't drift from
// the Worker. Reads the local guide from TF_GUIDE_DIR; a missing guide fails the run (it never silently skips).
import { expect, test } from '@playwright/test'
import { sectionTitles } from '../../core/models.js'
import { boxBreaks, cleanCut, cutAttribution, normText, spansBoxBreak } from '../../core/text.js'
import { checkQuote } from '../../core/verify.js'
import { loadPages } from '../../core/tests/guide-node.mjs'
import { ONCE, quotesIn, readFixture } from './fixtures.mjs'

const SAMPLE = 'SAMPLE (test only):'
const ATTRIBUTION_NAMES = ['yek', 'Yek', 'Cliff', 'Legendary Tones', 'Marshall', 'MESA', 'Manual']

let pages = null
let titles = null
const raw = (n) => (pages ??= loadPages()).get(n)
const titleSet = () => (titles ??= sectionTitles(readFixture('models.json')))

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires the fixtures object destructuring pattern to reach testInfo
test.beforeEach(({}, ti) => test.skip(ti.project.name !== ONCE, 'data checks run once'))

test('box-break offsets land on run starts in pageText, on every page', () => {
  let total = 0
  for (let n = 1; n <= 301; n++) {
    const text = normText(raw(n))
    for (const o of boxBreaks(raw(n), titleSet())) {
      total++
      expect(o, `p. ${n}`).toBeGreaterThan(0)
      expect(o, `p. ${n}`).toBeLessThan(text.length)
      expect(text[o - 1], `p. ${n} offset ${o}`).toBe(' ')
    }
  }
  expect(total).toBeGreaterThan(300)
})

test('the running header and printed page number count as box breaks when titles are given', () => {
  let withTitles = 0
  let without = 0
  for (let n = 1; n <= 301; n++) {
    withTitles += boxBreaks(raw(n), titleSet()).length
    without += boxBreaks(raw(n)).length
  }
  expect(withTitles).toBeGreaterThan(without)
})

// The lead's table, checked on the raw pages (API.md §4.2).
const TABLE = [
  [28, 'Or just crank everything, like Eddie Van Halen “My settings for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5.', true],
  [33, 'These tonal characteristics are what define this much respected all-valve head.” – Marshall The re-issue has two EL34 tubes', true],
  [125, 'Set the gain around 6 and then bring the master to taste” – Manual', true],
  [16, 'The name “Twin” probably refers to the use of two 12” speakers.', false],
  [28, 'Plexis with 4x12 cabinets gave rise to the “Marshall stack”.', false],
  [146, 'Model of the Bogner Uberschall, called “Armageddon in a box” by Bogner', false],
]
for (const [page, quote, spans] of TABLE) {
  test(`§4.2 table: p. ${page} ${spans ? 'spans' : "doesn't span"} “${quote.slice(0, 40)}…”`, () => {
    // The quote must really be on the page, or "doesn't span" would pass for the wrong reason.
    expect(normText(raw(page)).includes(quote)).toBe(true)
    expect(spansBoxBreak(quote, raw(page), titleSet())).toBe(spans)
  })
}

for (const file of ['models.json', 'answers.json']) {
  test(`every quote in app/mock/${file} verifies, spans no box break, ends cleanly`, () => {
    const quotes = quotesIn(readFixture(file)).filter((q) => Number.isInteger(q.page) && !q.quote.startsWith(SAMPLE))
    expect(quotes.length).toBeGreaterThan(10)
    const list = (bad) => quotes.filter(bad).map((q) => `${q.path} p. ${q.page}: ${q.quote}`)
    expect(list((q) => !checkQuote({ quote: q.quote, page: q.page }, pages ?? (pages = loadPages())).ok)).toEqual([])
    expect(list((q) => spansBoxBreak(q.quote, raw(q.page), titleSet()))).toEqual([])
    expect(list((q) => cutAttribution(q.quote, ATTRIBUTION_NAMES).quote !== q.quote)).toEqual([])
    expect(list((q) => cleanCut(q.quote) !== q.quote)).toEqual([])
  })
}
