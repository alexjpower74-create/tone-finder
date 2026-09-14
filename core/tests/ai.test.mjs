// AI step (docs/API.md §5) against the fake OpenAI server on TF_FAKE_AI_PORT (8303). No paid calls.
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadPages } from './guide-node.mjs'
import { aiAnswer, memoryStore, estimateCad, costUsd, prices, MAX_TOKENS } from '../ai.js'
import { answer, GK_LABEL } from '../answer.js'
import { checkQuote } from '../verify.js'
import { pageText } from '../guide.js'
import { spansBoxBreak, locateQuote, foldWithMap } from '../text.js'
import { sectionTitles } from '../models.js'
import { isUnitName } from '../models.js'
import { checkInvariants } from './invariants.mjs'
import { quoteShapeProblem } from './quote-shape.mjs'
import { startFake } from '../../worker/tests/fake-openai.mjs'

const read = (p) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8'))
const pages = loadPages()
const models = read('../../data/models.json')
const KEY = 'sk-test-DO-NOT-ECHO-0123456789abcdef'

let fake
let env
const answers = []
const http = (path, method = 'GET') => fetch(`http://127.0.0.1:${fake.port}${path}`, { method }).then((r) => r.json())

before(async () => {
  fake = await startFake({ port: Number(process.env.TF_FAKE_AI_PORT || 8303) })
  env = {
    OPENAI_API_KEY: KEY,
    OPENAI_BASE_URL: `http://127.0.0.1:${fake.port}/v1`,
    AI_MODEL: 'gpt-5.4-mini',
    AI_CAP_CAD: '2.00',
    USD_CAD: '1.3866',
    AI_PRICE_IN_PER_M: '0.75',
    AI_PRICE_CACHED_IN_PER_M: '0.075',
    AI_PRICE_OUT_PER_M: '4.50',
  }
})
after(() => fake.close())
beforeEach(() => http('/reset', 'POST'))

const ask = async (query, opts = {}) => {
  const a = await aiAnswer(query, { models, pages, env, store: memoryStore(), ...opts })
  answers.push(a)
  return a
}

test('fake-plant: unknown unit name, bad page and a changed character are dropped; the verified quote survives', async () => {
  const store = memoryStore()
  const a = await ask('Brown Sound Deluxe fake-plant', { store })
  assert.equal(a.ai.used, true)
  assert.equal(a.ai.reason, null)
  assert.equal(a.status, 'ok')
  const s = a.suggestions[0]
  assert.equal(s.model_id, '1959slp')
  assert.equal(s.source, 'ai_checked')
  assert.deepEqual(s.why.map((w) => [w.page, w.quote]), [[28, 'Models of a 100 watt Superlead Plexi re-issue']])
  assert.equal(s.unit_name, '1959SLP')
  for (const w of s.why) assert.ok(checkQuote(w, pages).ok)
  assert.ok(!a.suggestions.some((x) => x.unit_name === 'Brown Sound Deluxe'))
  assert.ok(!isUnitName(models, 'Brown Sound Deluxe'))
  assert.deepEqual(a.ai.dropped, [
    { kind: 'unknown_model', detail: 'Brown Sound Deluxe' },
    { kind: 'bad_page', detail: '1959SLP, p. 60' },
    { kind: 'quote_not_on_page', detail: '1959SLP, p. 28' },
    { kind: 'unknown_model', detail: 'Brown Sound Deluxe' },
  ])
  assert.deepEqual(a.general_knowledge, [{ text: 'FAKE general knowledge: a planted line for the tests.', label: GK_LABEL }])
  assert.equal(fake.count(), 2)
  assert.equal(store.calls.length, 2)
  assert.deepEqual(store.calls.map((c) => [c.step, c.ok, c.input_tokens, c.cached_input_tokens, c.output_tokens]), [['pick', 1, 1500, 500, 400], ['cite', 1, 1500, 500, 400]])
  assert.ok(a.ai.cost_cad > 0)
  checkInvariants(a, { pages })
})

test('fake-attrib: a citation opening with the previous passage’s "– Manual" is shown without it', async () => {
  const cited = '– Manual Fractal Audio’s model is based on channel 1 (12AX7) with Master bypassed.'
  assert.ok(pageText(pages, 188).includes(cited), 'control: the attribution really runs into the sentence on p. 188')
  const a = await ask('AC30 chime fake-attrib')
  const s = a.suggestions.find((x) => x.model_id === 'matchbox-d-30')
  assert.ok(s && s.source === 'ai_checked', JSON.stringify(a.suggestions.map((x) => [x.model_id, x.source])) + JSON.stringify(a.ai.dropped))
  assert.equal(s.why.length, 1)
  assert.equal(s.why[0].page, 188)
  assert.ok(s.why[0].quote.startsWith('Fractal Audio’s model is based on channel 1'), s.why[0].quote)
  assert.ok(checkQuote(s.why[0], pages).ok)
  for (const x of a.suggestions) for (const w of x.why) {
    assert.equal(quoteShapeProblem(w.quote, pages.get(w.page), sectionTitles(models)), null, `${x.model_id}: ${w.quote}`)
  }
  assert.ok(!JSON.stringify(a.suggestions.map((x) => x.why)).includes('– Manual Fractal'))
})

test('fake-fold: a citation differing only in quote marks and case is located and shown as the page text', async () => {
  const exact = 'Custom amp models by Fractal Audio, recreating EVH’s “Brown Sound”'
  assert.ok(pageText(pages, 60).includes(exact), 'control: the exact text is on p. 60')
  assert.ok(!pageText(pages, 60).includes('custom amp models by fractal audio, recreating EVH\'s "Brown Sound"'), 'control: the folded citation is not a raw substring')
  const a = await ask('Van Halen brown sound fake-fold')
  const brown = a.suggestions.find((s) => s.model_id === 'brit-brown-and-fas-brown')
  assert.equal(brown.source, 'ai_checked')
  assert.deepEqual(brown.why.map((w) => [w.page, w.quote]), [[60, exact]])
  const ods = a.suggestions.find((s) => s.model_id === 'ods-100')
  assert.ok(ods && ods.source === 'ai_checked', JSON.stringify(a.suggestions.map((s) => [s.model_id, s.source])))
  const w = ods.why[0]
  assert.equal(w.page, 201)
  assert.ok(w.quote.includes('which produces an up front sparkling tone'), w.quote)
  assert.ok(w.quote.length > 'which produces an up front sparkling tone,'.length, `expanded: ${w.quote}`)
  assert.match(w.quote, /^[A-Z“"(‘]/, 'starts at a sentence start')
  for (const s of a.suggestions) for (const q of s.why) {
    assert.ok(checkQuote(q, pages).ok)
    assert.ok(!spansBoxBreak(q.quote, pages.get(q.page), sectionTitles(models)))
  }
  assert.deepEqual(a.ai.dropped, [
    { kind: 'quote_not_on_page', detail: 'Brit Brown, p. 60' },
    { kind: 'quote_not_on_page', detail: 'Brit Brown, p. 61' },
  ])
})

test('locateQuote: folds marks, dashes, case and spaces; needs a unique match; maps back to page text', () => {
  const t = 'He said “Hi – there’s  ONE” here. And ‘one’ there.'
  const text = t.replace(/\s+/g, ' ')
  const r = locateQuote('he said "hi - there\'s one"', text)
  assert.deepEqual(text.slice(r.start, r.end), 'He said “Hi – there’s ONE”')
  assert.equal(locateQuote("'one'", 'x ‘one’ y ’one’ z'), null, 'two folded matches → not located')
  assert.equal(locateQuote('He said “Hx', text), null)
  assert.equal(foldWithMap('A — B').text, 'a - b')
})

test('fake-gk: general knowledge about the guide, candidates or model list is dropped; terms are de-duplicated', async () => {
  const a = await ask('Van Halen brown sound master fake-gk')
  assert.equal(a.ai.used, true)
  assert.equal(a.suggestions[0].model_id, 'brit-brown-and-fas-brown')
  assert.equal(a.suggestions[0].source, 'ai_checked')
  assert.deepEqual(a.general_knowledge.map((g) => g.text), ['FAKE: Eddie Van Halen played a modded Marshall Superlead on the early records.'])
  for (const g of a.general_knowledge) assert.doesNotMatch(g.text, /guide|candidate|provided|model list|the list/i)
  const { matched_terms, ai_terms } = a.understood
  assert.ok(matched_terms.includes('van halen') && matched_terms.includes('brown sound'), JSON.stringify(a.understood))
  assert.deepEqual(matched_terms, [...new Set(matched_terms)], `matched_terms repeat: ${matched_terms}`)
  assert.deepEqual(ai_terms, [...new Set(ai_terms)], `ai_terms repeat: ${ai_terms}`)
  assert.equal(matched_terms.filter((t) => t === 'master').length, 1, 'control: "master" is in both the query and the AI terms')
})

test('the pick prompt forbids guide talk in general knowledge, and the cache version moved on', async () => {
  const { PROMPT_VERSION } = await import('../ai.js')
  assert.equal(PROMPT_VERSION, 'tf-ai-4')
  const src = readFileSync(fileURLToPath(new URL('../ai.js', import.meta.url)), 'utf8')
  assert.match(src, /Never write general_knowledge about the guide, the guide candidates or the model list/)
})

test('fake-span: an AI citation that runs across a box break is dropped as quote_not_on_page', async () => {
  const q = 'Or just crank everything, like Eddie Van Halen “My settings for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5.'
  assert.ok(checkQuote({ quote: q, page: 28 }, pages).ok, 'control: it is an exact, verified substring')
  const a = await ask('1959SLP fake-span')
  assert.deepEqual(a.ai.dropped, [{ kind: 'quote_not_on_page', detail: '1959SLP, p. 28' }, { kind: 'no_verified_quote', detail: '1959SLP' }])
  assert.ok(a.suggestions.every((s) => s.source === 'guide_search'))
  assert.ok(!JSON.stringify(a).includes('Van Halen “My settings'))
})

test('fake-nonsense: no guide support and no general knowledge → still "I can\'t point to the guide for that", no cite call', async () => {
  const q = 'banjo through a toaster fake-nonsense'
  // Control: guide search alone can't support it (so the guard, not the search, decides).
  assert.equal(answer(q, { models, pages }).status, 'no_guide_support')
  const a = await ask(q)
  assert.equal(a.status, 'no_guide_support')
  assert.equal(a.message, "I can't point to the guide for that.")
  assert.deepEqual(a.suggestions, [])
  assert.deepEqual(a.general_knowledge, [])
  assert.deepEqual(a.understood.ai_terms, [])
  assert.equal(a.ai.used, true)
  assert.equal(fake.count(), 1, 'only the pick call; no cite call')
  checkInvariants(a, { pages })
})

test('the pick prompt tells the model to return nothing for requests that are not about music', async () => {
  const src = readFileSync(fileURLToPath(new URL('../ai.js', import.meta.url)), 'utf8')
  assert.match(src, /If the request is not about a guitar tone, song, artist, band, style or gear, return empty general_knowledge, search_terms and picks/)
})

test('fake-puppets: general knowledge + search terms lead to USA IIC+ with a verified p. 270 quote', async () => {
  const q = 'the rhythm tone on Master of Puppets fake-puppets'
  // Control: without AI the guide can't support it.
  assert.equal(answer('the rhythm tone on Master of Puppets', { models, pages }).status, 'no_guide_support')
  const a = await ask(q)
  assert.equal(a.status, 'ok')
  const s = a.suggestions.find((x) => x.model_id === 'usa-iic-plus-and-usa-iic-plus-plus')
  assert.ok(s, a.suggestions.map((x) => x.model_id).join(','))
  assert.equal(s.source, 'ai_checked')
  assert.equal(s.unit_name, 'USA IIC+')
  assert.equal(s.why[0].page, 270)
  assert.ok(checkQuote(s.why[0], pages).ok)
  assert.equal(a.general_knowledge.length, 1)
  assert.equal(a.general_knowledge[0].label, 'General knowledge (AI) — not from the guide')
  assert.ok(!('page' in a.general_knowledge[0]) && !('said_by' in a.general_knowledge[0]))
  assert.ok(a.understood.ai_terms.includes('metallica'), JSON.stringify(a.understood))
  checkInvariants(a, { pages })
})

test('cap: AI_CAP_CAD below the estimate → spend_cap and zero requests', async () => {
  const before = fake.count()
  const store = memoryStore()
  const a = await ask('Robben Ford fake-plant', { env: { ...env, AI_CAP_CAD: '0.0001' }, store })
  assert.equal(a.ai.used, false)
  assert.equal(a.ai.reason, 'spend_cap')
  assert.equal(fake.count(), before)
  assert.equal(before, 0)
  assert.equal(store.calls.length, 0)
  assert.equal(a.status, 'ok', 'the guide-search answer is still given')
  // Spent so far counts: a store already at the cap also refuses.
  const full = memoryStore()
  full.calls.push({ cad: 1.999 })
  const b = await ask('Robben Ford fake-plant', { store: full })
  assert.equal(b.ai.reason, 'spend_cap')
  assert.equal(fake.count(), 0)
})

test('cache: a second identical question makes no request and costs nothing', async () => {
  const store = memoryStore()
  const first = await ask('the rhythm tone on Master of Puppets fake-puppets', { store })
  assert.equal(fake.count(), 2)
  const second = await ask('  The rhythm tone on Master of Puppets   FAKE-puppets ', { store })
  assert.equal(fake.count(), 2)
  assert.equal(second.ai.used, true)
  assert.equal(second.ai.reason, 'cached')
  assert.equal(second.ai.cost_cad, 0)
  assert.deepEqual(second.suggestions, first.suggestions)
})

test('fake 500 and bad JSON → ai.reason "error" and the guide-search answer', async () => {
  for (const word of ['fake-error', 'fake-badjson']) {
    const a = await ask(`Robben Ford ${word}`)
    assert.equal(a.ai.used, false)
    assert.equal(a.ai.reason, 'error')
    const guide = answer(`Robben Ford ${word}`, { models, pages })
    assert.deepEqual(a.suggestions, guide.suggestions)
    assert.ok(a.suggestions.every((s) => s.source === 'guide_search'))
    assert.deepEqual(a.general_knowledge, [])
  }
})

test('off, no_key and guide_not_loaded make zero requests', async () => {
  assert.equal((await ask('Robben Ford fake-plant', { ai: false })).ai.reason, 'off')
  assert.equal((await ask('Robben Ford fake-plant', { env: { ...env, OPENAI_API_KEY: '' } })).ai.reason, 'no_key')
  const nl = await ask('Robben Ford fake-plant', { pages: null })
  assert.equal(nl.ai.reason, 'guide_not_loaded')
  assert.equal(nl.status, 'ok')
  assert.equal(fake.count(), 0)
})

test('request shape: bearer key, model, token limits, low reasoning, JSON mode', async () => {
  await ask('Robben Ford fake-puppets')
  const last = await http('/last')
  assert.deepEqual(last, { step: 'cite', authorization: 'present', model: 'gpt-5.4-mini', max_completion_tokens: MAX_TOKENS.cite, reasoning_effort: 'low', response_format: { type: 'json_object' } })
  assert.equal(MAX_TOKENS.pick, 1200)
  assert.equal(MAX_TOKENS.cite, 2500)
})

test('spend math follows §5.8', () => {
  const p = prices(env)
  assert.equal(costUsd({ input: 1_000_000, cached: 0, output: 0 }, p), 0.75)
  assert.equal(Math.round(costUsd({ input: 1500, cached: 500, output: 400 }, p) * 1e9), Math.round(((1000 * 0.75 + 500 * 0.075 + 400 * 4.5) / 1e6) * 1e9))
  assert.equal(estimateCad(3000, 1200, p), ((1000 * 0.75 + 1200 * 4.5) / 1e6) * 1.3866)
})

test('the key string never appears in any Answer or thrown error', async () => {
  // A fetch that fails with the key in its message must not leak it.
  const leaky = async (_url, init) => {
    throw new Error(`boom ${init.headers.authorization}`)
  }
  const a = await ask('Robben Ford', { fetchImpl: leaky })
  assert.equal(a.ai.reason, 'error')
  // Unreachable base URL.
  const b = await ask('Slash', { env: { ...env, OPENAI_BASE_URL: 'http://127.0.0.1:9/v1' } })
  assert.equal(b.ai.reason, 'error')
  let thrown = ''
  try {
    await aiAnswer('Slash', { models, pages, env, store: null })
  } catch (e) {
    thrown = `${e.message}\n${e.stack}`
  }
  assert.ok(thrown, 'control: a broken store does throw')
  assert.ok(!thrown.includes(KEY))
  assert.ok(answers.length >= 10, 'control: answers from every scenario were collected')
  for (const x of answers) assert.ok(!JSON.stringify(x).includes(KEY))
  assert.ok(!JSON.stringify(answers).includes('DO-NOT-ECHO'))
})
