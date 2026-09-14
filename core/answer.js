// Answer engine (docs/API.md §4, §6). Pure: the AI step lives in core/ai.js and calls back into here.
import { normText, foldForSearch, spansBoxBreak, cutAttribution, cleanCut } from './text.js'
import { checkQuote, QUOTE_MAX } from './verify.js'
import { search, sentencePool, termRegex } from './search.js'
import { sectionTitles } from './models.js'
import { knobsFor } from './knobs.js'
import { aresObject, aresFlags } from './ares.js'

export const NO_SUPPORT_MESSAGE = "I can't point to the guide for that."
export const GK_LABEL = 'General knowledge (AI) — not from the guide'
export const MAX_WHY = 3
const SAID_BY_NAMES = ['yek', 'Yek', 'Cliff', 'Legendary Tones', 'Marshall', 'MESA', 'Manual', 'Alan Phillips', 'Fenderguru.com', 'Fenderguru', 'Wikipedia', 'Orange', 'Bogner', 'Soldano', 'Fryette', 'Friedman', 'Diezel', 'Supro', 'Suhr', 'Peavey', 'Komet', 'Ken Fischer', 'Dr. Z', 'Bob Bradshaw', 'Vintage Guitar', 'ToneQuest', 'The Gear Page', 'Swart', 'Splawn', 'Premier Guitar', 'Trainwreck.com', 'Richard Hallebeek', 'Rob Navarette', 'Ultra Sound']
const SPEC_LINE = /Amplifier Specifications|(?:Years of Manufacture|Negative Feedback|Preamp Tubes|Power Amp Tubes|Tonestack Location) \S/

const round2 = (x) => Math.round(x * 100) / 100

function guideInfo(data) {
  return { title: data.guide.title, revision: data.guide.revision, firmware: data.guide.firmware }
}

function storedSaidBy(model) {
  const map = new Map()
  for (const q of [...model.tips, ...model.notes, ...model.settings]) if (q.said_by) map.set(`${q.page}|${q.quote}`, q.said_by)
  return map
}

// A sentence over 320 characters is cut after the clause that holds a term, so it still starts at the sentence start.
function clausePrefix(text, terms) {
  const cuts = [...text.matchAll(/[;,] /g)].map((m) => m.index)
  for (const end of [...cuts, text.length]) {
    const prefix = text.slice(0, end).trim()
    if (prefix.length > QUOTE_MAX) return null
    if (terms.some((t) => t.re.test(foldForSearch(prefix)))) return prefix
  }
  return null
}

function cmpKey(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

// §4.2: 1–3 verified quotes. The first carries a strong term; the 2nd/3rd a strong term, or generic terms only when
// from synopsis or tips. Never a controls or spec-table line. Quotes in `avoid` (shown under an earlier card) are
// used only when the model has no other sentence that works.
export function pickWhy(model, terms, pages, { avoid = new Set(), titles = null } = {}) {
  if (!terms.length) return []
  const compiled = terms.map((t) => ({ ...t, re: termRegex(t.term) }))
  const saidBy = storedSaidBy(model)
  const controls = model.controls?.quote
  const stock = model.cab?.stock_cabs?.quote
  // §4.2 "Which sentence first": the model's name, a unit name, or a unit name's last word of 3+ characters.
  const nameParts = new Set([model.name, ...model.unit_names.map((u) => u.name)])
  for (const u of model.unit_names) {
    const last = u.name.split(' ').pop()
    if (last.length >= 3) nameParts.add(last)
  }
  const nameRe = new RegExp([...nameParts].map((n) => termRegex(n).source).join('|'))
  const seen = new Set()
  const cands = []
  sentencePool(model, pages, titles).forEach((item, order) => {
    let text = item.text
    let said = item.said_by
    const cut = cutAttribution(text, SAID_BY_NAMES)
    if (cut.quote !== text) {
      text = cut.quote
      said = said || (cut.said_by === 'Yek' ? 'yek' : cut.said_by)
    }
    text = cleanCut(text)
    if (text.length < 12) return
    if (SPEC_LINE.test(text) || (controls && (text.includes(controls) || controls.includes(text)))) return
    if (stock && (text.includes(stock) || stock.includes(text))) return
    let matched = compiled.filter((t) => t.re.test(foldForSearch(text)))
    if (!matched.length) return
    if (text.length > QUOTE_MAX) {
      const pre = clausePrefix(text, [...matched].sort((a, b) => b.strong - a.strong))
      if (!pre) return
      text = cleanCut(pre)
      if (text.length < 12) return
      matched = compiled.filter((t) => t.re.test(foldForSearch(text)))
      if (!matched.length) return
    }
    if (pages && (!checkQuote({ quote: text, page: item.page }, pages).ok || spansBoxBreak(text, pages.get(item.page), titles))) return
    const key = `${item.page}|${text}`
    if (seen.has(key)) return
    seen.add(key)
    const strong = matched.some((t) => t.strong)
    if (!strong && item.weight < 3) return
    cands.push({ text, page: item.page, weight: item.weight, order, said_by: said || saidBy.get(key) || null, matched, strong, named: nameRe.test(foldForSearch(text)) })
  })
  const fresh = cands.filter((c) => !avoid.has(c.text))
  const usable = fresh.some((c) => c.strong) ? fresh : cands
  const chosen = []
  const covered = new Set()
  const pool = [...usable]
  while (chosen.length < MAX_WHY && pool.length) {
    let best = -1
    let bestKey = null
    pool.forEach((c, i) => {
      if (!chosen.length && !c.strong) return
      const add = c.matched.filter((t) => !covered.has(t.term))
      const key = [c.strong ? 1 : 0, add.some((t) => t.strong) ? 1 : 0, c.weight >= 3 ? 1 : 0, c.named ? 1 : 0, add.length, c.weight, -c.order]
      if (!bestKey || cmpKey(key, bestKey) > 0) {
        best = i
        bestKey = key
      }
    })
    if (best < 0) break
    const [c] = pool.splice(best, 1)
    const add = c.matched.filter((t) => !covered.has(t.term))
    if (chosen.length && !add.length) break
    c.matched.forEach((t) => covered.add(t.term))
    chosen.push({ quote: c.text, page: c.page, said_by: c.said_by, matched: c.matched.map((t) => t.term) })
  }
  return chosen
}

export function chooseUnitName(model, why, query) {
  const names = [...model.unit_names].sort((a, b) => b.name.length - a.name.length)
  const texts = [...why.map((w) => w.quote), query].map((t) => foldForSearch(t))
  for (const u of names) {
    const re = termRegex(u.name)
    if (texts.some((t) => re.test(t))) return u.name
  }
  return model.unit_names[0]?.name ?? model.name
}

export function buildSuggestion(model, { data, pages, query, terms, intent, rank, source, score, why = null, unitName = null, aiTexts = [], avoid }) {
  const whyList = why ?? pickWhy(model, terms, pages, { avoid, titles: sectionTitles(data) })
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
    query: String(query).trim(),
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

// Guide search → { answer, candidates }. `extraTerms` (AI search terms) are searched with the query; terms found
// only because of them are listed in understood.ai_terms.
export function guideAnswer(query, { models: data, pages = null, extraTerms = [] }) {
  const q = normText(query)
  const extra = extraTerms.map((t) => normText(t)).filter(Boolean)
  const full = extra.length ? `${q} ${extra.join(' ')}` : q
  const res = search(full, { models: data, pages })
  const own = extra.length ? search(q, { models: data, pages }) : res
  const ownTerms = new Set(own.understood.matched_terms)
  const out = baseAnswer(query, data)
  out.understood = {
    matched_terms: res.understood.matched_terms.filter((t) => ownTerms.has(t)),
    unmatched_terms: own.understood.unmatched_terms,
    ai_terms: res.understood.matched_terms.filter((t) => !ownTerms.has(t)),
    intent: own.understood.intent,
  }
  const used = new Set()
  const suggestions = []
  const kept = []
  for (const c of res.candidates) {
    const s = buildSuggestion(c.model, { data, pages, query: full, terms: c.terms, intent: own.understood.intent, rank: 0, source: 'guide_search', score: c.score, avoid: used })
    if (!s.why.length) continue
    s.why.forEach((w) => used.add(w.quote))
    suggestions.push(s)
    kept.push(c)
  }
  if (!suggestions.length) return { answer: out, candidates: [] }
  out.status = 'ok'
  out.message = null
  out.suggestions = suggestions.map((s, i) => ({ ...s, rank: i + 1 }))
  return { answer: out, candidates: kept }
}

export function answer(query, { models, pages = null } = {}) {
  return guideAnswer(query, { models, pages }).answer
}
