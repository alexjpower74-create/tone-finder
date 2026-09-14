import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { normText, splitSentences, sentenceBreakCount, hasWholeWord } from '../text.js'
import { parsePages, pageText, pagesSha256Input, pagesSha256 } from '../guide.js'
import { verifyQuote, checkQuote } from '../verify.js'
import { loadPages, loadGuideText } from './guide-node.mjs'

// Top level on purpose: a missing guide fails this file, it never skips.
const pages = loadPages()

// The §3.1 / §3 example quotes from docs/API.md.
const EXAMPLES = [
  { quote: 'Models of a 100 watt Superlead Plexi re-issue', page: 28 },
  { quote: 'Presence, Bass, Middle, Treble and Volume (=Drive)', page: 28 },
  { quote: "Don't hesitate to turn Bass all the way down and turn up Middle and Treble.", page: 28 },
  { quote: '4x12 Marshall cabinet with Celestion G12M (greenbacks) or G12H speakers', page: 28 },
  { quote: 'Marshall stock cabs – Cab Packs', page: 28 },
  { quote: 'My settings for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5.', page: 28 },
  { quote: 'If the original amp has no Master Volume control, the Master control in the amp model will default at 10.', page: 12 },
]

test('normText collapses whitespace runs (incl. NBSP) and trims, nothing else', () => {
  assert.equal(normText('  a\t\n b  c '), 'a b c')
  assert.equal(normText('Don’t  “x”'), 'Don’t “x”')
  assert.equal(normText('non- SimulClass'), 'non- SimulClass')
})

test('sentence split keeps exact substrings and counts §0 boundaries', () => {
  const t = 'One thing. “Two” here! (Three) there? four stays.'
  const parts = splitSentences(t)
  assert.deepEqual(parts, ['One thing.', '“Two” here!', '(Three) there? four stays.'])
  for (const p of parts) assert.ok(t.includes(p))
  assert.equal(sentenceBreakCount(t), 2)
})

test('whole-word find: case-insensitive, apostrophes and hyphens break words, no partial hits', () => {
  assert.ok(hasWholeWord('Eddie Van Halen cranked', 'van halen'))
  assert.ok(hasWholeWord('Metallica’s IIC+', 'metallica'))
  assert.ok(hasWholeWord('the USA IIC+ model', 'iic+'))
  assert.ok(!hasWholeWord('the USA IIC++ model', 'iic+'))
  assert.ok(!hasWholeWord('Plexiglass front', 'plexi'))
  assert.ok(hasWholeWord('edge-of-breakup', 'breakup'))
})

test('parsePages: 301 pages, markers excluded, sha input covers 1..301', async () => {
  assert.equal(pages.size, 301)
  assert.ok(!pageText(pages, 28).includes('===== PAGE'))
  assert.ok(pageText(pages, 28).startsWith('1959SLP (Marshall SLP1959'))
  const input = JSON.parse(pagesSha256Input(pages))
  assert.equal(input.length, 301)
  assert.deepEqual(input[0][0], 1)
  assert.deepEqual(input[300][0], 301)
  assert.match(await pagesSha256(pages), /^[0-9a-f]{64}$/)
  // Deterministic: parsing twice gives the same hash.
  assert.equal(await pagesSha256(parsePages(loadGuideText())), await pagesSha256(pages))
})

test('the API.md example quotes verify on their pages', () => {
  for (const q of EXAMPLES) assert.equal(verifyQuote(q, pages), true, `${q.page}: ${q.quote}`)
})

test('one changed character fails', () => {
  for (const q of EXAMPLES) {
    const i = Math.floor(q.quote.length / 2)
    const ch = q.quote[i] === 'x' ? 'y' : 'x'
    const changed = { ...q, quote: q.quote.slice(0, i) + ch + q.quote.slice(i + 1) }
    assert.equal(verifyQuote(changed, pages), false, changed.quote)
    assert.equal(checkQuote(changed, pages).reason, 'not_on_page')
  }
})

test('a real quote checked against the wrong page fails', () => {
  const q = { quote: 'Models of a 100 watt Superlead Plexi re-issue', page: 29 }
  assert.equal(verifyQuote(q, pages), false)
  assert.equal(checkQuote(q, pages).reason, 'not_on_page')
})

test('a 3-sentence passage that is on the page fails; its first 2 sentences pass', () => {
  const three =
    'A soft reset is performed by de-selecting and re-selecting the amp type in the Amp block. This resets most parameters, including Presence and Master, but leaves the Drive controls and Bass/Mid/Treble untouched. A full reset is performed by resetting the block.'
  assert.ok(pageText(pages, 12).includes(three), 'control: passage is really on p. 12')
  assert.ok(three.length <= 320, 'control: under the length limit')
  assert.equal(checkQuote({ quote: three, page: 12 }, pages).reason, 'too_many_sentences')
  const two = three.slice(0, three.lastIndexOf(' A full reset'))
  assert.equal(verifyQuote({ quote: two, page: 12 }, pages), true)
})

test('321 characters fails, 320 of the same text passes the length rule', () => {
  const t = pageText(pages, 12)
  const start = t.indexOf('If the original amp has two gain controls')
  assert.ok(start >= 0)
  const q321 = t.slice(start, start + 321).trim()
  assert.equal(q321.length, 321)
  assert.equal(checkQuote({ quote: q321, page: 12 }, pages).reason, 'too_long')
  const q320 = q321.slice(0, 320)
  assert.notEqual(checkQuote({ quote: q320, page: 12 }, pages).reason, 'too_long')
})

test('page 0 and 302 fail; non-integer pages fail; short and unnormalised quotes fail', () => {
  const q = EXAMPLES[0].quote
  assert.equal(checkQuote({ quote: q, page: 0 }, pages).reason, 'bad_page')
  assert.equal(checkQuote({ quote: q, page: 302 }, pages).reason, 'bad_page')
  assert.equal(checkQuote({ quote: q, page: 28.5 }, pages).reason, 'bad_page')
  assert.equal(checkQuote({ quote: q, page: '28' }, pages).reason, 'bad_page')
  assert.equal(checkQuote({ quote: 'Models of a', page: 28 }, pages).reason, 'too_short')
  assert.equal(checkQuote({ quote: ' ' + q, page: 28 }, pages).reason, 'not_normalised')
  assert.equal(verifyQuote({ quote: q, page: 28 }, null), false)
})

test('a missing TF_GUIDE_DIR fails the run with "guide not found at <path>"', () => {
  const helper = fileURLToPath(new URL('./guide-node.mjs', import.meta.url))
  const r = spawnSync(process.execPath, ['-e', `import(${JSON.stringify(helper)}).then(m => m.loadPages())`], {
    env: { ...process.env, TF_GUIDE_DIR: '/nonexistent-tf-guide' },
    encoding: 'utf8',
  })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /guide not found at \/nonexistent-tf-guide\/yek-guide-fulltext\.txt/)
})
