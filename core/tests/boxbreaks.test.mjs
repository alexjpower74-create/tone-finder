// Box breaks (docs/API.md §4.2): the lead's table, split/attribution helpers, and no stored quote spans a break.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadPages } from './guide-node.mjs'
import { pageText } from '../guide.js'
import { boxBreaks, spansBoxBreak, splitAtBoxBreaks, cutAttribution, cleanCut } from '../text.js'
import { answer } from '../answer.js'
import { SAID_BY } from '../../scripts/build-models.mjs'

const ATTRIBUTION_END = new RegExp(`\\s[–-]\\s+(?:${SAID_BY.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\.?$`)

const pages = loadPages()
const models = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/models.json', import.meta.url)), 'utf8'))

const SPANS = [
  [28, 'Or just crank everything, like Eddie Van Halen “My settings for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5.'],
  [33, 'These tonal characteristics are what define this much respected all-valve head.” – Marshall The re-issue has two EL34 tubes'],
  [125, 'Set the gain around 6 and then bring the master to taste” – Manual'],
]
const CLEAN = [
  [16, 'The name “Twin” probably refers to the use of two 12” speakers.'],
  [28, 'Plexis with 4x12 cabinets gave rise to the “Marshall stack”.'],
  [146, 'Model of the Bogner Uberschall, called “Armageddon in a box” by Bogner'],
]

test('the §4.2 table: three spans, three quoted-term cases that do not span', () => {
  for (const [p, q] of [...SPANS, ...CLEAN]) assert.ok(pageText(pages, p).includes(q), `control: on p. ${p}: ${q}`)
  for (const [p, q] of SPANS) assert.equal(spansBoxBreak(q, pages.get(p)), true, `p. ${p} should span`)
  for (const [p, q] of CLEAN) assert.equal(spansBoxBreak(q, pages.get(p)), false, `p. ${p} should not span`)
})

test('boxBreaks offsets are word starts in pageText on every page, and include the known breaks', () => {
  let total = 0
  for (let p = 1; p <= 301; p++) {
    const t = pageText(pages, p)
    for (const b of boxBreaks(pages.get(p))) {
      assert.ok(b > 0 && b < t.length && t[b - 1] === ' ' && t[b] !== ' ', `p. ${p} offset ${b}`)
      total++
    }
  }
  assert.ok(total > 300, `control: ${total} breaks found`)
  const t28 = pageText(pages, 28)
  assert.ok(boxBreaks(pages.get(28)).includes(t28.indexOf('“My settings for a “typical” Plexi tone are Bass 2, Mid 8')))
})

test('splitAtBoxBreaks shortens only; cutAttribution moves the name to said_by', () => {
  assert.deepEqual(splitAtBoxBreaks(SPANS[0][1], pages.get(28)), ['Or just crank everything, like Eddie Van Halen', '“My settings for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5.'])
  assert.deepEqual(splitAtBoxBreaks(CLEAN[0][1], pages.get(16)), [CLEAN[0][1]])
  const [before, after] = splitAtBoxBreaks(SPANS[1][1], pages.get(33))
  assert.equal(before, 'These tonal characteristics are what define this much respected all-valve head.”')
  assert.deepEqual(cutAttribution(after, ['Marshall']), { quote: 'The re-issue has two EL34 tubes', said_by: null })
  const [manual] = splitAtBoxBreaks(SPANS[2][1], pages.get(125))
  assert.equal(manual, 'Set the gain around 6 and then bring the master to taste”')
  assert.deepEqual(cutAttribution('Turn up Treble a lot to make it less dark – yek', ['yek']), { quote: 'Turn up Treble a lot to make it less dark', said_by: 'yek' })
})

test('no quote in models.json spans a box break or ends with an attribution', () => {
  let n = 0
  const walk = (v, path, model) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`, model))
    if (!v || typeof v !== 'object') return
    if (typeof v.quote === 'string' && Number.isInteger(v.page)) {
      n++
      assert.ok(!spansBoxBreak(v.quote, pages.get(v.page)), `${path} p. ${v.page} spans: ${v.quote}`)
      assert.ok(!ATTRIBUTION_END.test(v.quote), `${path} ends with an attribution: ${v.quote}`)
      assert.ok(!/(?:[,;:]|\s(?:and|or|with))$/i.test(v.quote), `${path} unclean cut: ${v.quote}`)
    }
    for (const [k, x] of Object.entries(v)) if (k !== 'quote') walk(x, `${path}.${k}`, model)
  }
  for (const m of models.models) walk(m, m.id, m)
  assert.ok(n > 800, `control: ${n} quotes checked`)
})

test('the p. 28 splice never reaches an answer', () => {
  for (const q of ['Van Halen brown sound', 'Eddie Van Halen', 'typical Plexi settings']) {
    const a = answer(q, { models, pages })
    for (const s of a.suggestions) for (const w of s.why) assert.ok(!spansBoxBreak(w.quote, pages.get(w.page)), `${q}: ${w.quote}`)
  }
})

test('cleanCut trims trailing punctuation and dangling words only', () => {
  assert.equal(cleanCut('Models of various Marshall Plexi heads,'), 'Models of various Marshall Plexi heads')
  assert.equal(cleanCut('4x12 Recto – Cab Packs 5, 7, 13, 14, 21 and'), '4x12 Recto – Cab Packs 5, 7, 13, 14, 21')
  assert.equal(cleanCut('Four models of a VOX AC30:'), 'Four models of a VOX AC30')
  assert.equal(cleanCut('rock and roll'), 'rock and roll')
  assert.equal(cleanCut('Brand new sound with'), 'Brand new sound')
})
