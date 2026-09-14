// Guide search (docs/API.md §4.1). Pure: models.json data + optional guide pages.
import { pageText } from './guide.js'
import { foldForSearch, splitSentences } from './text.js'
import { indexModels, resolvedModel } from './models.js'

export const STOP_WORDS = new Set(
  ('a an and the of on in at to for with from by like my me i want need get some sort kind type tone tones sound ' +
    'sounds sounding song guitar guitars amp amps model models setting settings preset patch please how what that ' +
    'this those these is are be it its his her their do does make give play playing').split(' '),
)
// Contract question 2 (build report): function words the §4.1 list leaves out. Without them "banjo through a
// toaster" finds "through" in two models' tips and becomes a suggestion, against golden. Kept apart so the
// lead can adopt or drop the list in one place.
export const EXTRA_STOP_WORDS = new Set('through into onto over under about via as or but than'.split(' '))
for (const w of EXTRA_STOP_WORDS) STOP_WORDS.add(w)
export const GENERIC_WORDS = new Set(
  ('clean crunch crunchy rhythm lead solo dirty distorted distortion overdrive overdriven drive gain master volume ' +
    'bass mid middle treble presence depth loud quiet warm bright dark fat big heavy').split(' '),
)
export const STRONG_DF_SHARE = 0.35
export const KEEP_SHARE = 0.4
export const MAX_SUGGESTIONS = 4

const INTENTS = [
  ['high_gain', ['high gain', 'metal', 'djent', 'thrash', 'brutal', 'chug']],
  ['lead', ['lead', 'solo', 'singing', 'liquid', 'sustain']],
  ['crunch', ['crunch', 'crunchy', 'classic rock', 'rock', 'rhythm']],
  ['edge', ['edge of breakup', 'breakup', 'blues', 'bluesy']],
  ['clean', ['clean', 'sparkle', 'sparkly', 'glassy', 'chime', 'chimey', 'shimmer', 'pristine', 'jazz', 'country']],
]

// Lowercase; keep letters, digits, + # / - and apostrophes inside words; split on everything else.
export function tokenize(query) {
  const words = String(query).toLowerCase().match(/[\p{L}\p{N}+#\/\-’']+/gu) || []
  return words.map((w) => w.replace(/^['’\-\/]+|['’\-\/]+$/g, '')).filter(Boolean)
}

export function detectIntent(tokens) {
  const q = ' ' + tokens.join(' ') + ' '
  for (const [intent, words] of INTENTS) if (words.some((w) => q.includes(' ' + w + ' '))) return intent
  return null
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SEP = ' ¶ '

function termRegex(term) {
  const needle = foldForSearch(term).trim()
  return new RegExp('(?<![a-z0-9+#/])' + escapeRegex(needle).replace(/ /g, ' +') + '(?![a-z0-9+#/])')
}

// Per model: folded text per weight (4, 3, 2, 1) and the raw pieces the why step picks sentences from.
function buildIndex(data, pages) {
  const { suggestable } = indexModels(data)
  return suggestable.map((base) => {
    const m = resolvedModel(data, base.id)
    const stubs = (indexModels(data).stubsOf.get(m.id) || [])
    const w4 = [...m.unit_names.map((u) => u.name), m.name, m.based_on || '', ...stubs.flatMap((s) => [s.name, s.based_on || ''])]
    const w3 = [m.synopsis?.quote, ...m.tips.map((t) => t.quote)]
    const w2 = [m.controls?.quote, m.cab.speaker?.quote, m.cab.stock_cabs?.quote, ...m.cab.notes.map((n) => n.quote), ...m.settings.map((s) => s.quote)]
    const w1 = [...m.notes.map((n) => n.quote), ...m.directions.map((d) => d.quote)]
    if (pages) for (let p = m.pages.start; p <= m.pages.end; p++) w1.push(pageText(pages, p) || '')
    const fold = (arr) => foldForSearch(arr.filter(Boolean).join(SEP))
    return { model: m, fields: [[4, fold(w4)], [3, fold(w3)], [2, fold(w2)], [1, fold(w1)]] }
  })
}

const indexCache = new WeakMap()
function getIndex(data, pages) {
  let byPages = indexCache.get(data)
  if (!byPages) indexCache.set(data, (byPages = new Map()))
  const key = pages || 'none'
  if (!byPages.has(key)) byPages.set(key, buildIndex(data, pages))
  return byPages.get(key)
}

// → Map(modelId → best weight) for a term.
function hitsFor(index, term) {
  const needle = foldForSearch(term).trim()
  const re = termRegex(term)
  const hits = new Map()
  for (const entry of index) {
    for (const [w, text] of entry.fields) {
      if (text.includes(needle) && re.test(text)) {
        hits.set(entry.model.id, w)
        break
      }
    }
  }
  return hits
}

// search(query, { models, pages }) → { terms, understood, candidates }
// candidates: [{ model, score, terms: [{ term, weight, strong }] }]
export function search(query, { models: data, pages = null }) {
  const index = getIndex(data, pages)
  const N = index.length
  const tokens = tokenize(query)
  const consumed = new Array(tokens.length).fill(false)
  const found = [] // { term, words, start, hits, df, idf }
  for (let n = 4; n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      if (consumed.slice(i, i + n).some(Boolean)) continue
      const words = tokens.slice(i, i + n)
      if (n === 1 && STOP_WORDS.has(words[0])) continue
      if (n > 1 && (STOP_WORDS.has(words[0]) || STOP_WORDS.has(words[n - 1]))) continue
      const term = words.join(' ')
      const hits = hitsFor(index, term)
      if (!hits.size) continue
      for (let j = i; j < i + n; j++) consumed[j] = true
      found.push({ term, words, start: i, hits, df: hits.size, idf: Math.log(1 + N / hits.size) })
    }
  }
  found.sort((a, b) => a.start - b.start)

  const scored = []
  for (const entry of index) {
    let score = 0
    let strong = false
    const terms = []
    for (const f of found) {
      const weight = f.hits.get(entry.model.id)
      if (!weight) continue
      const generic = f.words.length === 1 && GENERIC_WORDS.has(f.term)
      const isStrong = !generic && (f.df <= STRONG_DF_SHARE * N || weight >= 3)
      strong ||= isStrong
      score += f.idf * weight * (f.words.length > 1 ? 1.5 : 1)
      terms.push({ term: f.term, weight, strong: isStrong })
    }
    if (strong) scored.push({ model: entry.model, score, terms })
  }
  const order = new Map(data.models.map((m, i) => [m.id, i]))
  scored.sort((a, b) => b.score - a.score || order.get(a.model.id) - order.get(b.model.id))
  const top = scored[0]?.score ?? 0
  const candidates = scored.filter((c) => c.score >= KEEP_SHARE * top).slice(0, MAX_SUGGESTIONS)

  const unmatched = []
  tokens.forEach((t, i) => {
    if (!consumed[i] && !STOP_WORDS.has(t) && !GENERIC_WORDS.has(t) && !unmatched.includes(t)) unmatched.push(t)
  })
  return {
    tokens,
    found: found.map(({ term, df, idf }) => ({ term, df, idf })),
    understood: { matched_terms: found.map((f) => f.term), unmatched_terms: unmatched, intent: detectIntent(tokens) },
    candidates,
  }
}

// Sentences a why quote can come from, best field first: [{ text, page, weight }].
export function sentencePool(model, pages) {
  const pool = []
  const add = (q, weight) => q && pool.push({ text: q.quote, page: q.page, weight, said_by: q.said_by ?? null })
  add(model.synopsis, 3)
  model.tips.forEach((t) => add(t, 3))
  add(model.controls, 2)
  add(model.cab.speaker, 2)
  add(model.cab.stock_cabs, 2)
  model.cab.notes.forEach((n) => add(n, 2))
  model.settings.forEach((s) => add(s, 2))
  model.notes.forEach((n) => add(n, 1))
  if (pages) {
    for (let p = model.pages.start; p <= model.pages.end; p++) {
      for (const s of splitSentences(pageText(pages, p) || '')) pool.push({ text: s, page: p, weight: 1, said_by: null })
    }
  }
  return pool
}

export { termRegex }
