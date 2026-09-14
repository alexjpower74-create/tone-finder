// Guide search (docs/API.md §4.1). Pure: models.json data + optional guide pages.
import { pageText } from './guide.js'
import { foldForSearch, splitSentences, splitAtBoxBreaks } from './text.js'
import { indexModels, resolvedModel, sectionTitles } from './models.js'

// Function words may not start or end an n-gram; filler words may end one ("brown sound") but not start one.
export const FUNCTION_WORDS = new Set(
  ('a an and the of on in at to for with from by like my me i want need get some sort kind type please how what that ' +
    'this those these is are be it its his her their do does make give through into onto over under about via as or ' +
    'but than').split(' '),
)
export const FILLER_WORDS = new Set(
  'tone tones sound sounds sounding song guitar guitars amp amps model models setting settings preset patch play playing'.split(' '),
)
export const STOP_WORDS = new Set([...FUNCTION_WORDS, ...FILLER_WORDS])
export const GENERIC_WORDS = new Set(
  ('clean crunch crunchy rhythm lead solo dirty distorted distortion overdrive overdriven drive gain master volume ' +
    'bass mid middle treble presence depth loud quiet warm bright dark fat big heavy').split(' '),
)
export const STRONG_DF_SHARE = 0.35
export const KEEP_SHARE = 0.4
export const MAX_SUGGESTIONS = 4
export const CARD_LABEL = /^(?:Synopsis|Tips|Clips|Sound Clips|Cabinet\/speaker|Stock cabs|Web, Manual|Amp controls|More videos, clips and comments)(?![A-Za-z])/

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
const ENDINGS = ['ing', 'ed', 'es', 'y', 'e', 's']

// Word variants (§4.1): a 5+ letter word ending in y/e/ing/ed/es/s also matches its stem (≥ 5 letters) plus one of
// those endings; a stem ending in "e" also drops it before ing/ed/es (chimey → chiming). → { re, pre } or null.
export function variant(word) {
  if (!/^[a-z]{5,}$/.test(word)) return null
  for (const end of ENDINGS) {
    if (!word.endsWith(end) || word.length - end.length < 5) continue
    const stem = word.slice(0, -end.length)
    const alts = [`${stem}(?:ing|ed|es|y|e|s)?`]
    let pre = stem
    if (stem.endsWith('e')) {
      alts.push(`${stem.slice(0, -1)}(?:ing|ed|es)`)
      pre = stem.slice(0, -1)
    }
    return { re: `(?:${alts.join('|')})`, pre }
  }
  return null
}

const termCache = new Map()
function compileTerm(term) {
  if (termCache.has(term)) return termCache.get(term)
  const words = foldForSearch(term).trim().split(' ')
  const parts = words.map((w) => variant(w)?.re ?? escapeRegex(w))
  const c = {
    re: new RegExp('(?<![a-z0-9+#/])' + parts.join(' +') + '(?![a-z0-9+#/])'),
    reAll: new RegExp('(?<![a-z0-9+#/])' + parts.join(' +') + '(?![a-z0-9+#/])', 'g'),
    pre: variant(words[0])?.pre ?? words[0],
  }
  termCache.set(term, c)
  return c
}

export function termRegex(term) {
  return compileTerm(term).re
}

// "The Edge": capital "The", the other words in any case, not at a sentence start. Runs on unfolded text.
function properRegex(words) {
  const rest = words.slice(1).map((w) => w.split('').map((ch) => (/[a-z]/.test(ch) ? `[${ch}${ch.toUpperCase()}]` : escapeRegex(ch))).join(''))
  return new RegExp('(?<=[^.!?:“"\\s][”"’)]*\\s+)The\\s+' + rest.join('\\s+') + '(?![A-Za-z0-9+#/])', 'g')
}

// Per model: folded text per weight, folded page text (for hits), raw text (for proper names with "the").
function buildIndex(data, pages) {
  const idx = indexModels(data)
  return idx.suggestable.map((base) => {
    const m = resolvedModel(data, base.id)
    const stubs = idx.stubsOf.get(m.id) || []
    const w4 = [...m.unit_names.map((u) => u.name), m.name, m.based_on || '', ...stubs.flatMap((s) => [s.name, s.based_on || ''])]
    const w3 = [m.synopsis?.quote, ...m.tips.map((t) => t.quote)]
    const w2 = [m.controls?.quote, m.cab.speaker?.quote, m.cab.stock_cabs?.quote, ...m.cab.notes.map((n) => n.quote), ...m.settings.map((s) => s.quote)]
    const w1 = [...m.notes.map((n) => n.quote), ...m.directions.map((d) => d.quote)]
    const pageTexts = []
    if (pages) for (let p = m.pages.start; p <= m.pages.end; p++) pageTexts.push(pageText(pages, p) || '')
    const join = (arr) => arr.filter(Boolean).join(SEP)
    const fields = [[4, w4], [3, w3], [2, w2], [1, [...w1, ...pageTexts]]]
    return {
      model: m,
      fields: fields.map(([w, arr]) => [w, foldForSearch(join(arr))]),
      raw: fields.map(([w, arr]) => [w, join(arr)]),
      hitsText: pages ? foldForSearch(join(pageTexts)) : foldForSearch(join(fields.flatMap(([, a]) => a))),
      hitsRaw: pages ? join(pageTexts) : join(fields.flatMap(([, a]) => a)),
    }
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

// → Map(modelId → { weight, hits }) for a term.
function hitsFor(index, term) {
  const words = term.split(' ')
  const proper = words.length > 1 && words[0] === 'the' ? properRegex(words) : null
  const { re, reAll, pre } = compileTerm(term)
  const hits = new Map()
  for (const entry of index) {
    let weight = 0
    if (proper) {
      for (const [w, text] of entry.raw) {
        proper.lastIndex = 0
        if (proper.test(text)) { weight = w; break }
      }
    } else {
      for (const [w, text] of entry.fields) {
        if (text.includes(pre) && re.test(text)) { weight = w; break }
      }
    }
    if (!weight) continue
    let n
    if (proper) {
      proper.lastIndex = 0
      n = (entry.hitsRaw.match(proper) || []).length
    } else {
      reAll.lastIndex = 0
      n = (entry.hitsText.match(reAll) || []).length
    }
    hits.set(entry.model.id, { weight, hits: Math.max(1, n) })
  }
  return hits
}

// search(query, { models, pages }) → { tokens, found, understood, candidates }
// candidates: [{ model, score, terms: [{ term, weight, strong }] }]
export function search(query, { models: data, pages = null }) {
  const index = getIndex(data, pages)
  const N = index.length
  const tokens = tokenize(query)
  const consumed = new Array(tokens.length).fill(false)
  const found = []
  for (let n = 4; n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      if (consumed.slice(i, i + n).some(Boolean)) continue
      const words = tokens.slice(i, i + n)
      if (n === 1 && STOP_WORDS.has(words[0])) continue
      if (n > 1) {
        const first = words[0]
        const theStart = first === 'the'
        if ((FUNCTION_WORDS.has(first) && !theStart) || FILLER_WORDS.has(first)) continue
        if (FUNCTION_WORDS.has(words[n - 1])) continue
      }
      const term = words.join(' ')
      const hits = hitsFor(index, term)
      if (!hits.size) continue
      for (let j = i; j < i + n; j++) consumed[j] = true
      found.push({ term, words, start: i, hits, df: hits.size, idf: Math.log(1 + N / hits.size) })
    }
  }
  found.sort((a, b) => a.start - b.start)

  // Generic: every word is generic once a leading "the" and filler words are set aside ("the rhythm", "rhythm tone").
  const isGeneric = (f) => {
    const core = f.words.filter((w, i) => !(i === 0 && w === 'the' && f.words.length > 1) && !FILLER_WORDS.has(w))
    return core.length > 0 && core.every((w) => GENERIC_WORDS.has(w))
  }
  const nonGeneric = new Set(found.filter((f) => !isGeneric(f)).map((f) => f.term))
  const foundN = Math.max(1, nonGeneric.size)
  const scored = []
  for (const entry of index) {
    let score = 0
    let strong = false
    let covered = 0
    const terms = []
    for (const f of found) {
      const h = f.hits.get(entry.model.id)
      if (!h) continue
      const generic = isGeneric(f)
      const isStrong = !generic && (f.df <= STRONG_DF_SHARE * N || h.weight >= 3)
      strong ||= isStrong
      if (!generic) covered++
      // Term frequency only for body-text hits (§4.1).
      const tf = h.weight === 1 ? 1 + Math.log(h.hits) : 1
      score += f.idf * h.weight * (f.words.length > 1 ? 1.5 : 1) * tf
      terms.push({ term: f.term, weight: h.weight, strong: isStrong })
    }
    // Coverage (§4.1): reward matching more of the query's non-generic terms.
    score *= 0.5 + (0.5 * Math.max(1, covered)) / foundN
    if (strong) scored.push({ model: entry.model, score, terms })
  }
  const order = new Map(data.models.map((m, i) => [m.id, i]))
  scored.sort((a, b) => b.score - a.score || order.get(a.model.id) - order.get(b.model.id))
  const top = scored[0]?.score ?? 0
  const candidates = scored.filter((c) => c.score >= KEEP_SHARE * top).slice(0, MAX_SUGGESTIONS)
  // §4.1: a supported query shows 2 suggestions whenever 2 candidates exist.
  if (candidates.length === 1 && scored.length > 1) candidates.push(scored[1])

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

// Sentences a why quote can come from: [{ text, page, weight, kind, said_by }]. Controls and stock-cab lines are never offered.
// Page sentences are split at box breaks (§4.2), so a piece never runs from one box into the next.
export function sentencePool(model, pages, titles = null) {
  const pool = []
  const add = (q, weight, kind) => q && pool.push({ text: q.quote, page: q.page, weight, kind, said_by: q.said_by ?? null })
  add(model.synopsis, 3, 'synopsis')
  model.tips.forEach((t) => add(t, 3, 'tip'))
  add(model.cab.speaker, 2, 'cab')
  model.cab.notes.forEach((n) => add(n, 2, 'cab'))
  model.settings.forEach((s) => add(s, 2, 'settings'))
  model.notes.forEach((n) => add(n, 1, 'note'))
  if (pages) {
    for (let p = model.pages.start; p <= model.pages.end; p++) {
      const raw = pages.get(p) || ''
      for (const s of splitSentences(pageText(pages, p) || '')) {
        for (const piece of splitAtBoxBreaks(s, raw, titles)) {
          if (!CARD_LABEL.test(piece)) pool.push({ text: piece, page: p, weight: 1, kind: 'page', said_by: null })
        }
      }
    }
  }
  return pool
}
