// Answer engine (docs/API.md §4, §6). Pure: the AI step lives in core/ai.js and calls back into here.
import { normText, foldForSearch } from './text.js'
import { checkQuote, QUOTE_MAX } from './verify.js'
import { search, sentencePool, termRegex } from './search.js'
import { knobsFor } from './knobs.js'
import { aresObject, aresFlags } from './ares.js'

export const NO_SUPPORT_MESSAGE = "I can't point to the guide for that."
export const GK_LABEL = 'General knowledge (AI) — not from the guide'
export const MAX_WHY = 3

const round2 = (x) => Math.round(x * 100) / 100

function guideInfo(data) {
  return { title: data.guide.title, revision: data.guide.revision, firmware: data.guide.firmware }
}

// Stored quotes that carry an attribution, so a page sentence equal to one inherits it.
function storedSaidBy(model) {
  const map = new Map()
  for (const q of [...model.tips, ...model.notes, ...model.settings]) if (q.said_by) map.set(`${q.page}|${q.quote}`, q.said_by)
  return map
}

// A sentence over 320 characters is cut to the clause (split on "; " or ", ") that holds a term.
function clauseCut(text, terms) {
  const clauses = text.split(/; |, /)
  for (const t of terms) {
    const c = clauses.find((cl) => t.re.test(foldForSearch(cl)))
    if (c) return c.trim()
  }
  return null
}

// Lexicographic compare of two equal-length number arrays: > 0 when a ranks above b.
function cmpKey(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

// §4.2: 1–3 verified quotes, each containing a found term; strong terms first, then tips/synopsis, then
// distinct terms. With pages null only stored quotes are used (the build verified them).
export function pickWhy(model, terms, pages) {
  if (!terms.length) return []
  const compiled = terms.map((t) => ({ ...t, re: termRegex(t.term) }))
  const saidBy = storedSaidBy(model)
  const seen = new Set()
  const cands = []
  sentencePool(model, pages).forEach((item, order) => {
    let text = item.text
    let matched = compiled.filter((t) => t.re.test(foldForSearch(text)))
    if (!matched.length) return
    if (text.length > QUOTE_MAX) {
      const cut = clauseCut(text, [...matched].sort((a, b) => b.strong - a.strong))
      if (!cut) return
      text = cut
      matched = compiled.filter((t) => t.re.test(foldForSearch(text)))
      if (!matched.length) return
    }
    if (pages && !checkQuote({ quote: text, page: item.page }, pages).ok) return
    const key = `${item.page}|${text}`
    if (seen.has(key)) return
    seen.add(key)
    cands.push({ text, page: item.page, weight: item.weight, order, said_by: item.said_by || saidBy.get(key) || null, matched })
  })
  const chosen = []
  const covered = new Set()
  while (chosen.length < MAX_WHY && cands.length) {
    let best = 0
    let bestKey = null
    cands.forEach((c, i) => {
      const fresh = c.matched.filter((t) => !covered.has(t.term))
      const key = [c.matched.some((t) => t.strong) ? 1 : 0, fresh.some((t) => t.strong) ? 1 : 0, c.weight >= 3 ? 1 : 0, fresh.length, c.weight, -c.order]
      if (!bestKey || cmpKey(key, bestKey) > 0) {
        best = i
        bestKey = key
      }
    })
    const [c] = cands.splice(best, 1)
    const fresh = c.matched.filter((t) => !covered.has(t.term))
    if (chosen.length && !fresh.length) break
    c.matched.forEach((t) => covered.add(t.term))
    chosen.push({ quote: c.text, page: c.page, said_by: c.said_by, matched: c.matched.map((t) => t.term) })
  }
  return chosen
}

// The model's unit name found in a why quote or the query (longest first), else the first.
export function chooseUnitName(model, why, query) {
  const names = [...model.unit_names].sort((a, b) => b.name.length - a.name.length)
  const texts = [...why.map((w) => w.quote), query].map((t) => foldForSearch(t))
  for (const u of names) {
    const re = termRegex(u.name)
    if (texts.some((t) => re.test(t))) return u.name
  }
  return model.unit_names[0]?.name ?? model.name
}

// One suggestion. `why` may be supplied (verified AI citations); otherwise picked from `terms`.
export function buildSuggestion(model, { data, pages, query, terms, intent, rank, source, score, why = null, unitName = null, aiTexts = [] }) {
  const whyList = why ?? pickWhy(model, terms, pages)
  const unit_name = unitName ?? chooseUnitName(model, whyList, query)
  const k = knobsFor(model, { unitName: unit_name, terms: terms.map((t) => t.term), intent, conventions: data.conventions })
  const shown = [
    ...whyList.map((w) => ({ text: w.quote, where: 'why', page: w.page })),
    ...(k.settings_quote ? [{ text: k.settings_quote.quote, where: 'settings', page: k.settings_quote.page }] : []),
    ...k.other_settings.map((o) => ({ text: o.text, where: 'settings', page: o.page })),
    ...k.knobs.filter((x) => x.direction).map((x) => ({ text: x.direction.quote, where: 'direction', page: x.direction.page })),
    ...aiTexts.map((text) => ({ text, where: 'ai', page: null })),
  ]
  return {
    rank,
    model_id: model.id,
    unit_name,
    section: model.section,
    based_on: model.based_on,
    brands: model.brands,
    pages: model.pages,
    source,
    score: round2(score),
    why: whyList,
    knobs: k.knobs,
    taper_note: k.taper_note,
    other_settings: k.other_settings,
    cab: model.cab,
    ares_flags: aresFlags(shown),
  }
}

export function baseAnswer(query, data) {
  return {
    query,
    status: 'no_guide_support',
    message: NO_SUPPORT_MESSAGE,
    understood: { matched_terms: [], unmatched_terms: [], ai_terms: [], intent: null },
    ai: { used: false, reason: 'off', dropped: [], cost_cad: 0 },
    general_knowledge: [],
    suggestions: [],
    ares: aresObject(),
    guide: guideInfo(data),
  }
}

// Guide search → { answer, candidates }. `extraTerms` (AI search terms) are searched with the query; terms
// found only because of them are listed in understood.ai_terms.
export function guideAnswer(query, { models: data, pages = null, extraTerms = [] }) {
  const q = normText(query)
  const extra = extraTerms.map((t) => normText(t)).filter(Boolean)
  const full = extra.length ? `${q} ${extra.join(' ')}` : q
  const res = search(full, { models: data, pages })
  const own = extra.length ? search(q, { models: data, pages }) : res
  const ownTerms = new Set(own.understood.matched_terms)
  const out = baseAnswer(q, data)
  out.understood = {
    matched_terms: res.understood.matched_terms.filter((t) => ownTerms.has(t)),
    unmatched_terms: own.understood.unmatched_terms,
    ai_terms: res.understood.matched_terms.filter((t) => !ownTerms.has(t)),
    intent: own.understood.intent,
  }
  if (!res.candidates.length) return { answer: out, candidates: [] }
  out.status = 'ok'
  out.message = null
  out.suggestions = res.candidates.map((c, i) =>
    buildSuggestion(c.model, { data, pages, query: full, terms: c.terms, intent: own.understood.intent, rank: i + 1, source: 'guide_search', score: c.score }),
  )
  return { answer: out, candidates: res.candidates }
}

// answer(query, { models, pages }) → Answer with AI off. The Worker's AI path is core/ai.js.
export function answer(query, { models, pages = null } = {}) {
  return guideAnswer(query, { models, pages }).answer
}
