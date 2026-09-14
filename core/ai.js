// Optional AI step (docs/API.md §5). Pure ESM: fetch and storage are injected, so the same code runs in core
// tests (memory store, fake server) and in the Worker (D1). Nothing here logs or returns the key or the prompt.
import { normText, spansBoxBreak, locateQuote, expandToSentence, cleanCut, sentenceBreakCount } from './text.js'
import { pageText, sha256Hex } from './guide.js'
import { checkQuote } from './verify.js'
import { indexModels, unitNameOf, sectionTitles } from './models.js'
import { guideAnswer, baseAnswer, buildSuggestion, GK_LABEL } from './answer.js'
import { termRegex } from './search.js'
import { foldForSearch } from './text.js'

export const PROMPT_VERSION = 'tf-ai-4'
// §5.6: general knowledge that talks about the guide, the candidates or the model list is not general knowledge.
export const GK_ABOUT_GUIDE = /guide|candidate|provided|model list|the list/i
export const MAX_TOKENS = { pick: 1200, cite: 2500 }
export const TIMEOUT_MS = 30000
export const LIMITS = { general_knowledge: 3, gk_chars: 200, search_terms: 6, picks: 4, models: 4, page_chars: 12000, why: 3 }

const PICK_RULES = [
  'STEP: pick',
  'You help a guitarist find starting points on a Fractal Audio Axe-Fx II (Ares firmware) using only the amp models in the list you are given.',
  'Only choose model_id and unit_name values exactly as they appear in the list. Never invent or rename a model.',
  'Song, artist and gear facts go in general_knowledge (at most 3 items, each at most 200 characters). They are shown as general knowledge, not as guide facts.',
  'Never write general_knowledge about the guide, the guide candidates or the model list; only facts about songs, artists and gear.',
  'If the request is not about a guitar tone, song, artist, band, style or gear, return empty general_knowledge, search_terms and picks.',
  'search_terms: at most 6 short words or phrases (artist, amp or sound words) that could appear in the guide.',
  'picks: at most 4.',
  'Never mention Axe-Fx III, FM3 or FM9 models, Motor Drive or Transformer Grind.',
  'Reply with JSON only: {"general_knowledge":[{"text":"…"}],"search_terms":["…"],"picks":[{"model_id":"…","unit_name":"…"}]}',
].join('\n')

const CITE_RULES = [
  'STEP: cite',
  'For each model, copy 1 to 3 short passages from its guide pages that support it for the query.',
  'Each quote must be copied exactly from one PAGE, at most 2 sentences and at most 320 characters, with the page number it is on.',
  'Only use the models given. Never mention Axe-Fx III, FM3 or FM9 models, Motor Drive or Transformer Grind.',
  'Reply with JSON only: {"suggestions":[{"model_id":"…","unit_name":"…","citations":[{"page":1,"quote":"…"}]}]}',
].join('\n')

const num = (v, d) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

export function prices(env) {
  return {
    in: num(env.AI_PRICE_IN_PER_M, 0.75),
    cached: num(env.AI_PRICE_CACHED_IN_PER_M, 0.075),
    out: num(env.AI_PRICE_OUT_PER_M, 4.5),
    usdCad: num(env.USD_CAD, 1.3866),
    cap: num(env.AI_CAP_CAD, 2),
  }
}

export function costUsd({ input, cached, output }, p) {
  return ((input - cached) * p.in + cached * p.cached + output * p.out) / 1e6
}

// Worst case: prompt characters / 3 input tokens, none cached, plus the full output allowance.
export function estimateCad(promptChars, maxTokens, p) {
  return costUsd({ input: Math.ceil(promptChars / 3), cached: 0, output: maxTokens }, p) * p.usdCad
}

export async function cacheKey(query, data, env) {
  return sha256Hex([normText(query).toLowerCase(), data.guide.pages_sha256, env.AI_MODEL || 'gpt-5.4-mini', PROMPT_VERSION].join('|'))
}

class AiError extends Error {}

// One chat completion. Errors carry a code only: never the key, the prompt or the response body.
async function callModel({ env, fetchImpl, messages, maxTokens }) {
  const base = String(env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
  let res
  try {
    res = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: env.AI_MODEL || 'gpt-5.4-mini',
        messages,
        max_completion_tokens: maxTokens,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new AiError('request_failed')
  }
  if (!res.ok) throw new AiError(`http_${res.status}`)
  let body
  try {
    body = await res.json()
  } catch {
    throw new AiError('bad_json')
  }
  const u = body?.usage || {}
  const usage = { input: num(u.prompt_tokens, 0), cached: num(u.prompt_tokens_details?.cached_tokens, 0), output: num(u.completion_tokens, 0) }
  let content
  try {
    content = JSON.parse(body?.choices?.[0]?.message?.content)
  } catch {
    const e = new AiError('bad_json')
    e.usage = usage
    throw e
  }
  if (!content || typeof content !== 'object') {
    const e = new AiError('bad_json')
    e.usage = usage
    throw e
  }
  return { content, usage }
}

function modelList(data) {
  return indexModels(data).suggestable.map((m) => ({
    id: m.id,
    unit_names: m.unit_names.map((u) => u.name),
    based_on: m.based_on,
    brands: m.brands,
    master_volume: m.facets.master_volume,
    power_tubes: m.facets.power_tubes,
  }))
}

function pagesForModel(model, pages) {
  let out = ''
  for (let p = model.pages.start; p <= model.pages.end; p++) {
    const chunk = `PAGE ${p}:\n${pageText(pages, p)}\n\n`
    if (out.length + chunk.length > LIMITS.page_chars) {
      out += chunk.slice(0, Math.max(0, LIMITS.page_chars - out.length))
      break
    }
    out += chunk
  }
  return out
}

const pickLabel = (p) => (typeof p?.unit_name === 'string' && p.unit_name) || (typeof p?.model_id === 'string' && p.model_id) || 'unnamed pick'

// A pick or suggestion names a real, non-stub model and one of its unit names. Returns the model or null.
export function checkPick(data, p) {
  const m = typeof p?.model_id === 'string' ? indexModels(data).byId.get(p.model_id) : null
  if (!m || m.refers_to) return null
  const unit = unitNameOf(data, m.id, p.unit_name)
  return unit ? { model: m, unit } : null
}

// §5.5 locate, then verify: page inside the model; find the citation on the page (exact, else folded and unique);
// expand to its sentence; clean cuts; box breaks; verifyQuote. The shown quote is always the page's own text.
// → { ok, quote, page } or { ok: false, kind }
export function checkCitation(model, c, pages, titles = null, { locate = true } = {}) {
  const page = c?.page
  if (!Number.isInteger(page) || page < model.pages.start || page > model.pages.end) return { ok: false, kind: 'bad_page' }
  const raw = pages.get(page)
  const text = pageText(pages, page)
  const cited = normText(c?.quote)
  const tooLong = cited.length > 320 || sentenceBreakCount(cited) > 1
  const span = locate ? locateQuote(cited, text) : text.includes(cited) ? { start: text.indexOf(cited), end: text.indexOf(cited) + cited.length } : null
  if (!span) return { ok: false, kind: tooLong ? 'quote_too_long' : 'quote_not_on_page' }
  const located = text.slice(span.start, span.end)
  const wide = expandToSentence(raw, span, titles)
  const tries = [wide ? text.slice(wide.start, wide.end) : null, located].filter(Boolean).map(cleanCut)
  for (const quote of tries) {
    if (spansBoxBreak(quote, raw, titles)) continue
    const r = checkQuote({ quote, page }, pages)
    if (r.ok) return { ok: true, quote, page }
  }
  const r = checkQuote({ quote: tries[tries.length - 1], page }, pages)
  return { ok: false, kind: r.reason === 'too_long' || r.reason === 'too_many_sentences' ? 'quote_too_long' : 'quote_not_on_page' }
}

function sanitisePick(content) {
  const gk = (Array.isArray(content.general_knowledge) ? content.general_knowledge : [])
    .map((g) => (typeof g === 'string' ? g : g?.text))
    .filter((t) => typeof t === 'string' && normText(t) && normText(t).length <= LIMITS.gk_chars && !GK_ABOUT_GUIDE.test(t))
    .slice(0, LIMITS.general_knowledge)
    .map((t) => normText(t))
  const terms = (Array.isArray(content.search_terms) ? content.search_terms : [])
    .filter((t) => typeof t === 'string' && normText(t))
    .slice(0, LIMITS.search_terms)
    .map((t) => normText(t).slice(0, 60))
  const picks = (Array.isArray(content.picks) ? content.picks : []).slice(0, LIMITS.picks)
  return { gk, terms, picks }
}

// aiAnswer(query, { models, pages, env, ai, fetchImpl, store }) → Answer
// store: { spentCad(): Promise<number>, recordCall(row): Promise, getCache(key): Promise<Answer|null>, putCache(key, answer): Promise }
export async function aiAnswer(query, { models: data, pages = null, env = {}, ai = true, fetchImpl = globalThis.fetch, store }) {
  const q = normText(query)
  const guideOnly = (reason, extraTerms = []) => {
    const { answer } = guideAnswer(query, { models: data, pages, extraTerms })
    answer.ai = { used: false, reason, dropped: [], cost_cad: 0 }
    return answer
  }
  if (!ai) return guideOnly('off')
  if (!env.OPENAI_API_KEY) return guideOnly('no_key')
  if (!pages) return guideOnly('guide_not_loaded')

  const key = await cacheKey(q, data, env)
  const hit = await store.getCache(key)
  if (hit) return { ...hit, ai: { ...hit.ai, used: true, reason: 'cached', cost_cad: 0 } }

  const p = prices(env)
  const queryHash = await sha256Hex(q.toLowerCase())
  const model = env.AI_MODEL || 'gpt-5.4-mini'
  let costCad = 0
  const run = async (step, messages) => {
    const chars = messages.reduce((n, m) => n + m.content.length, 0)
    const est = estimateCad(chars, MAX_TOKENS[step], p)
    const spent = await store.spentCad()
    if (spent + est > p.cap) {
      const e = new AiError('spend_cap')
      e.cap = true
      throw e
    }
    const at = new Date().toISOString()
    try {
      const r = await callModel({ env, fetchImpl, messages, maxTokens: MAX_TOKENS[step] })
      const usd = costUsd(r.usage, p)
      costCad += usd * p.usdCad
      await store.recordCall({ at, model, step, input_tokens: r.usage.input, cached_input_tokens: r.usage.cached, output_tokens: r.usage.output, usd, cad: usd * p.usdCad, query_hash: queryHash, ok: 1 })
      return r.content
    } catch (e) {
      const u = e.usage || { input: 0, cached: 0, output: 0 }
      const usd = costUsd(u, p)
      costCad += usd * p.usdCad
      await store.recordCall({ at, model, step, input_tokens: u.input, cached_input_tokens: u.cached, output_tokens: u.output, usd, cad: usd * p.usdCad, query_hash: queryHash, ok: 0 })
      throw e
    }
  }

  const dropped = []
  let gk, terms
  const c0 = guideAnswer(query, { models: data, pages })
  const survivors = []
  try {
    // Call A: pick.
    const pickMsg = [
      { role: 'system', content: PICK_RULES },
      {
        role: 'user',
        content: JSON.stringify({
          query: q,
          models: modelList(data),
          guide_candidates: c0.answer.suggestions.map((s) => ({ model_id: s.model_id, unit_name: s.unit_name, why: s.why.map((w) => w.quote) })),
        }),
      },
    ]
    const picked = sanitisePick(await run('pick', pickMsg))
    gk = picked.gk
    terms = picked.terms
    for (const pk of picked.picks) {
      const ok = checkPick(data, pk)
      if (!ok) dropped.push({ kind: 'unknown_model', detail: pickLabel(pk) })
      else if (!survivors.some((s) => s.model.id === ok.model.id)) survivors.push(ok)
    }
  } catch (e) {
    return guideOnly(e.cap ? 'spend_cap' : 'error')
  }

  // §5.2b: when the guide can't support the query on its own, the AI may only help if it also says what the query
  // is about (at least one general-knowledge item). Without that it is guessing: a real call turned "banjo through
  // a toaster" into four VOX-style cards. Keep "I can't point to the guide for that." and make no cite call.
  if (c0.answer.status === 'no_guide_support' && !gk.length) {
    const a = c0.answer
    a.understood = { ...a.understood, ai_terms: [] }
    a.general_knowledge = []
    a.ai = { used: true, reason: null, dropped, cost_cad: Math.round(costCad * 1e6) / 1e6 }
    await store.putCache(key, a)
    return a
  }

  // Search again with the AI's terms.
  const c1 = guideAnswer(query, { models: data, pages, extraTerms: terms })
  const targets = [...survivors]
  for (const c of c1.candidates) {
    if (targets.length >= LIMITS.models) break
    if (!targets.some((t) => t.model.id === c.model.id)) targets.push({ model: c.model, unit: null })
  }

  const kept = []
  if (targets.length) {
    let cited
    try {
      const citeMsg = [
        { role: 'system', content: CITE_RULES },
        {
          role: 'user',
          content:
            `QUERY: ${q}\n\n` +
            targets
              .slice(0, LIMITS.models)
              .map((t) => `MODEL ${t.model.id} (unit names: ${t.model.unit_names.map((u) => u.name).join(', ')})\n${pagesForModel(t.model, pages)}`)
              .join('\n'),
        },
      ]
      cited = await run('cite', citeMsg)
    } catch (e) {
      const a = e.cap ? guideOnly('spend_cap', terms) : guideOnly('error', terms)
      a.ai.dropped = dropped
      return a
    }
    const list = Array.isArray(cited?.suggestions) ? cited.suggestions : []
    for (const s of list) {
      const ok = checkPick(data, s)
      if (!ok) {
        dropped.push({ kind: 'unknown_model', detail: pickLabel(s) })
        continue
      }
      if (kept.some((k) => k.model.id === ok.model.id)) continue
      const why = []
      for (const c of Array.isArray(s.citations) ? s.citations : []) {
        const r = checkCitation(ok.model, c, pages, sectionTitles(data))
        if (!r.ok) {
          dropped.push({ kind: r.kind, detail: `${ok.unit}, p. ${Number.isInteger(c?.page) ? c.page : '?'}` })
          continue
        }
        if (why.length < LIMITS.why && !why.some((w) => w.quote === r.quote && w.page === r.page)) why.push(r)
      }
      if (!why.length) {
        dropped.push({ kind: 'no_verified_quote', detail: ok.unit })
        continue
      }
      kept.push({ ...ok, why })
    }
  }

  // Merge: kept AI suggestions in AI order, then C1 candidates not present, at most 4.
  const found = c1.candidates.flatMap((c) => c.terms)
  const termsFor = (id) => c1.candidates.find((c) => c.model.id === id)?.terms ?? []
  const intent = c1.answer.understood.intent
  const suggestions = []
  for (const k of kept.slice(0, 4)) {
    const t = termsFor(k.model.id)
    const allTerms = t.length ? t : [...new Map(found.map((x) => [x.term, { ...x, strong: false }])).values()]
    const why = k.why.map((w) => {
      const stored = [...k.model.tips, ...k.model.notes, ...k.model.settings].find((x) => x.quote === w.quote && x.page === w.page)
      return {
        quote: w.quote,
        page: w.page,
        said_by: stored?.said_by ?? null,
        matched: allTerms.filter((x) => termRegex(x.term).test(foldForSearch(w.quote))).map((x) => x.term),
      }
    })
    suggestions.push(
      buildSuggestion(k.model, {
        data, pages, query: q, terms: allTerms, intent, rank: 0, source: 'ai_checked',
        score: c1.candidates.find((c) => c.model.id === k.model.id)?.score ?? 0,
        why, unitName: k.unit, aiTexts: gk,
      }),
    )
  }
  if (suggestions.length) {
    for (const s of c1.answer.suggestions) {
      if (suggestions.length >= 4) break
      if (!suggestions.some((x) => x.model_id === s.model_id)) suggestions.push(s)
    }
  }
  let answer
  if (suggestions.length) {
    answer = baseAnswer(query, data)
    answer.status = 'ok'
    answer.message = null
    answer.understood = c1.answer.understood
    answer.suggestions = suggestions.map((s, i) => ({ ...s, rank: i + 1 }))
  } else {
    answer = c1.answer.suggestions.length ? c1.answer : c0.answer
    if (answer === c0.answer) answer.understood = { ...c0.answer.understood, ai_terms: c1.answer.understood.ai_terms }
  }
  answer.general_knowledge = answer.suggestions.length ? gk.map((text) => ({ text, label: GK_LABEL })) : []
  answer.ai = { used: true, reason: null, dropped, cost_cad: Math.round(costCad * 1e6) / 1e6 }
  await store.putCache(key, answer)
  return answer
}

// In-memory store for tests and scripts.
export function memoryStore() {
  const calls = []
  const cache = new Map()
  return {
    calls,
    cache,
    async spentCad() {
      return calls.reduce((n, c) => n + c.cad, 0)
    },
    async recordCall(row) {
      calls.push(row)
    },
    async getCache(k) {
      return cache.has(k) ? structuredClone(cache.get(k)) : null
    },
    async putCache(k, a) {
      cache.set(k, structuredClone(a))
    },
  }
}
