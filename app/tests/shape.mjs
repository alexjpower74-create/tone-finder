// Shape checker for the HTTP JSON in docs/API.md §6 (and the Model of §3.1). Each check returns a list of
// problems; [] means the shape is right. Extra keys are allowed; missing keys, wrong types and bad enums are not.
import { quoteSupportsKnob } from '../../core/knobs.js'

export const KNOBS = ['Drive', 'Bass', 'Mid', 'Treble', 'Master', 'Presence', 'Depth']
// A knob with a page must have a quote that states its value (API.md §4.3). The Worker uses each model's own
// `Label (=Knob)` hints; the shape check doesn't have them, so it accepts the table plus the common hint sets.
const HINT_SETS = [{}, { volume: 'Drive' }, { drive: 'Master', gain: 'Drive' }]
export const GUESS_NOTE = 'starting guess — not from the guide'
export const NO_SUPPORT = "I can't point to the guide for that."
export const GK_LABEL = 'General knowledge (AI) — not from the guide'
const AI_REASONS = [null, 'off', 'no_key', 'guide_not_loaded', 'spend_cap', 'cached', 'error']
const DROP_KINDS = ['unknown_model', 'bad_page', 'quote_not_on_page', 'quote_too_long', 'no_verified_quote']
const INTENTS = [null, 'high_gain', 'lead', 'crunch', 'edge', 'clean']
const TUBES = ['EL34', 'EL84', '6L6', '6V6', 'KT88', 'KT66', '6550', '6973']
const MV = ['yes', 'no', 'mixed', 'unknown']
const SPEC_KEYS = ['years', 'circuit', 'power', 'master_volume', 'negative_feedback', 'preamp_tubes', 'power_tubes', 'tonestack']

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v)

class Checker {
  errors = []
  fail(msg) {
    this.errors.push(msg)
  }
  is(v, types, path) {
    const actual = typeOf(v)
    const ok = types.split('|').some((t) => t === actual || (t === 'number' && actual === 'integer'))
    if (!ok) this.fail(`${path}: expected ${types}, got ${actual}`)
    return ok
  }
  key(obj, k, types, path) {
    if (!obj || typeof obj !== 'object' || !(k in obj)) {
      this.fail(`${path}.${k}: missing`)
      return false
    }
    return this.is(obj[k], types, `${path}.${k}`)
  }
  oneOf(v, list, path) {
    if (!list.includes(v)) this.fail(`${path}: ${JSON.stringify(v)} is not one of ${JSON.stringify(list)}`)
  }
  strings(obj, k, path) {
    if (this.key(obj, k, 'array', path))
      obj[k].forEach((s, i) => {
        this.is(s, 'string', `${path}.${k}[${i}]`)
      })
  }
  pages(obj, k, path) {
    if (!this.key(obj, k, 'object', path)) return null
    const p = obj[k]
    const okS = this.key(p, 'start', 'integer', `${path}.${k}`)
    const okE = this.key(p, 'end', 'integer', `${path}.${k}`)
    if (okS && okE && !(1 <= p.start && p.start <= p.end && p.end <= 301)) this.fail(`${path}.${k}: bad range ${p.start}–${p.end}`)
    return p
  }
  quote(q, path, within = null) {
    if (!this.is(q, 'object', path)) return
    if (this.key(q, 'quote', 'string', path)) {
      if (q.quote.length > 320) this.fail(`${path}.quote: ${q.quote.length} characters (max 320)`)
      if (q.quote.length < 12) this.fail(`${path}.quote: ${q.quote.length} characters (min 12)`)
    }
    if (this.key(q, 'page', 'integer', path)) {
      if (q.page < 1 || q.page > 301) this.fail(`${path}.page: ${q.page} out of 1–301`)
      if (within && (q.page < within.start || q.page > within.end))
        this.fail(`${path}.page: ${q.page} outside pp. ${within.start}–${within.end}`)
    }
  }
  quoteOrNull(obj, k, path, within) {
    if (this.key(obj, k, 'object|null', path) && obj[k] !== null) this.quote(obj[k], `${path}.${k}`, within)
  }
  saidBy(obj, path) {
    this.key(obj, 'said_by', 'string|null', path)
  }
  cab(obj, path, within) {
    if (!this.key(obj, 'cab', 'object', path)) return
    const c = obj.cab
    this.quoteOrNull(c, 'speaker', `${path}.cab`, within)
    this.quoteOrNull(c, 'stock_cabs', `${path}.cab`, within)
    if (this.key(c, 'notes', 'array', `${path}.cab`))
      c.notes.forEach((n, i) => {
        this.quote(n, `${path}.cab.notes[${i}]`, within)
      })
  }
  facets(obj, path) {
    if (!this.key(obj, 'facets', 'object', path)) return
    if (this.key(obj.facets, 'master_volume', 'string', `${path}.facets`))
      this.oneOf(obj.facets.master_volume, MV, `${path}.facets.master_volume`)
    if (this.key(obj.facets, 'power_tubes', 'array', `${path}.facets`))
      obj.facets.power_tubes.forEach((t, i) => {
        this.oneOf(t, TUBES, `${path}.facets.power_tubes[${i}]`)
      })
  }
}

export function checkHealth(h) {
  const c = new Checker()
  const p = 'health'
  c.key(h, 'ok', 'boolean', p)
  c.key(h, 'models', 'integer', p)
  if (c.key(h, 'guide', 'object', p)) {
    c.key(h.guide, 'loaded', 'boolean', `${p}.guide`)
    c.key(h.guide, 'pages', 'integer', `${p}.guide`)
    c.key(h.guide, 'sha_ok', 'boolean', `${p}.guide`)
  }
  if (c.key(h, 'ai', 'object', p)) {
    c.key(h.ai, 'configured', 'boolean', `${p}.ai`)
    c.key(h.ai, 'model', 'string', `${p}.ai`)
    c.key(h.ai, 'cap_cad', 'number', `${p}.ai`)
    c.key(h.ai, 'spent_cad', 'number', `${p}.ai`)
    c.key(h.ai, 'calls', 'integer', `${p}.ai`)
  }
  return c.errors
}

function summaryInto(c, s, p) {
  c.key(s, 'id', 'string', p)
  c.key(s, 'name', 'string', p)
  c.key(s, 'section', 'string', p)
  c.key(s, 'based_on', 'string|null', p)
  c.strings(s, 'brands', p)
  c.strings(s, 'unit_names', p)
  const pages = c.pages(s, 'pages', p)
  c.facets(s, p)
  c.key(s, 'refers_to', 'string|null', p)
  c.quoteOrNull(s, 'synopsis', p, pages)
}

export function checkSummary(s, path = 'summary') {
  const c = new Checker()
  summaryInto(c, s, path)
  return c.errors
}

export function checkModelsList(r) {
  const c = new Checker()
  const p = 'models_list'
  c.key(r, 'count', 'integer', p)
  c.key(r, 'total', 'integer', p)
  if (c.key(r, 'models', 'array', p)) {
    if (r.count !== r.models.length) c.fail(`${p}.count ${r.count} ≠ models.length ${r.models.length}`)
    r.models.forEach((s, i) => {
      summaryInto(c, s, `${p}.models[${i}]`)
    })
  }
  if (c.key(r, 'facets', 'object', p)) {
    for (const k of ['brands', 'power_tubes', 'master_volume']) {
      if (!c.key(r.facets, k, 'array', `${p}.facets`)) continue
      r.facets[k].forEach((f, i) => {
        c.key(f, 'value', 'string', `${p}.facets.${k}[${i}]`)
        c.key(f, 'count', 'integer', `${p}.facets.${k}[${i}]`)
        if (k === 'master_volume') c.oneOf(f.value, MV, `${p}.facets.master_volume[${i}].value`)
        if (k === 'power_tubes') c.oneOf(f.value, TUBES, `${p}.facets.power_tubes[${i}].value`)
      })
    }
  }
  return c.errors
}

function modelInto(c, m, p) {
  c.key(m, 'id', 'string', p)
  c.key(m, 'section', 'string', p)
  c.key(m, 'name', 'string', p)
  c.key(m, 'based_on', 'string|null', p)
  const pages = c.pages(m, 'pages', p)
  c.key(m, 'refers_to', 'string|null', p)
  if (c.key(m, 'unit_names', 'array', p)) {
    m.unit_names.forEach((u, i) => {
      c.key(u, 'name', 'string', `${p}.unit_names[${i}]`)
      c.key(u, 'evidence', 'string', `${p}.unit_names[${i}]`)
      c.key(u, 'page', 'integer', `${p}.unit_names[${i}]`)
    })
  }
  c.strings(m, 'brands', p)
  if (c.key(m, 'specs', 'object', p)) for (const k of SPEC_KEYS) c.key(m.specs, k, 'string|null', `${p}.specs`)
  c.facets(m, p)
  c.quoteOrNull(m, 'synopsis', p, pages)
  c.quoteOrNull(m, 'controls', p, pages)
  if (c.key(m, 'tips', 'array', p))
    m.tips.forEach((t, i) => {
      c.quote(t, `${p}.tips[${i}]`, pages)
      c.saidBy(t, `${p}.tips[${i}]`)
    })
  c.cab(m, p, pages)
  if (c.key(m, 'settings', 'array', p)) {
    m.settings.forEach((s, i) => {
      const sp = `${p}.settings[${i}]`
      c.quote(s, sp, pages)
      c.saidBy(s, sp)
      c.key(s, 'context', 'string|null', sp)
      c.key(s, 'unit_name', 'string|null', sp)
      if (c.key(s, 'knobs', 'object', sp)) {
        const entries = Object.entries(s.knobs)
        if (!entries.length) c.fail(`${sp}.knobs: needs at least one knob`)
        for (const [k, v] of entries) {
          c.oneOf(k, KNOBS, `${sp}.knobs key`)
          if (c.is(v, 'number', `${sp}.knobs.${k}`) && (v < 0 || v > 10)) c.fail(`${sp}.knobs.${k}: ${v} out of 0–10`)
        }
      }
      c.strings(s, 'other', sp)
    })
  }
  if (c.key(m, 'directions', 'array', p)) {
    m.directions.forEach((d, i) => {
      const dp = `${p}.directions[${i}]`
      c.oneOf(d.knob, KNOBS, `${dp}.knob`)
      c.oneOf(d.dir, ['up', 'down'], `${dp}.dir`)
      c.quote(d, dp, pages)
    })
  }
  if (c.key(m, 'notes', 'array', p)) {
    if (m.notes.length > 5) c.fail(`${p}.notes: ${m.notes.length} notes (max 5)`)
    m.notes.forEach((n, i) => {
      c.quote(n, `${p}.notes[${i}]`, pages)
      c.saidBy(n, `${p}.notes[${i}]`)
    })
  }
}

export function checkModel(m, path = 'model') {
  const c = new Checker()
  modelInto(c, m, path)
  return c.errors
}

export function checkModelDetail(r) {
  const c = new Checker()
  const p = 'model_detail'
  if (c.key(r, 'model', 'object', p)) modelInto(c, r.model, `${p}.model`)
  if (c.key(r, 'conventions', 'array', p)) {
    r.conventions.forEach((cv, i) => {
      c.key(cv, 'id', 'string', `${p}.conventions[${i}]`)
      c.quote(cv, `${p}.conventions[${i}]`)
    })
  }
  if (c.key(r, 'guide', 'object', p)) {
    for (const k of ['title', 'by', 'revision', 'firmware', 'pages_sha256']) c.key(r.guide, k, 'string', `${p}.guide`)
    c.key(r.guide, 'pdf_pages', 'integer', `${p}.guide`)
  }
  return c.errors
}

export function checkError(body) {
  const c = new Checker()
  c.key(body, 'error', 'string', 'error_body')
  c.key(body, 'message', 'string', 'error_body')
  return c.errors
}

export function checkAnswer(a) {
  const c = new Checker()
  const p = 'answer'
  c.key(a, 'query', 'string', p)
  if (c.key(a, 'status', 'string', p)) c.oneOf(a.status, ['ok', 'no_guide_support'], `${p}.status`)
  c.key(a, 'message', 'string|null', p)
  if (a?.status === 'no_guide_support' && a.message !== NO_SUPPORT) c.fail(`${p}.message: must be "${NO_SUPPORT}" when there is no support`)
  if (a?.status === 'ok' && a.message !== null) c.fail(`${p}.message: must be null when status is ok`)

  if (c.key(a, 'understood', 'object', p)) {
    const u = a.understood
    c.strings(u, 'matched_terms', `${p}.understood`)
    c.strings(u, 'unmatched_terms', `${p}.understood`)
    c.strings(u, 'ai_terms', `${p}.understood`)
    if (c.key(u, 'intent', 'string|null', `${p}.understood`)) c.oneOf(u.intent, INTENTS, `${p}.understood.intent`)
  }

  if (c.key(a, 'ai', 'object', p)) {
    const ai = a.ai
    c.key(ai, 'used', 'boolean', `${p}.ai`)
    if (c.key(ai, 'reason', 'string|null', `${p}.ai`)) c.oneOf(ai.reason, AI_REASONS, `${p}.ai.reason`)
    if (ai.used === false && ai.reason === null) c.fail(`${p}.ai.reason: null only when ai.used is true`)
    c.key(ai, 'cost_cad', 'number', `${p}.ai`)
    if (c.key(ai, 'dropped', 'array', `${p}.ai`)) {
      ai.dropped.forEach((d, i) => {
        if (c.key(d, 'kind', 'string', `${p}.ai.dropped[${i}]`)) c.oneOf(d.kind, DROP_KINDS, `${p}.ai.dropped[${i}].kind`)
        // §5.5: "<unit name>, p. <n>", or just the name for unknown_model and no_verified_quote.
        if (c.key(d, 'detail', 'string', `${p}.ai.dropped[${i}]`)) {
          const nameOnly = d.kind === 'unknown_model' || d.kind === 'no_verified_quote'
          const withPage = /^.+, p\. \d+$/.test(d.detail)
          if (nameOnly ? withPage : !withPage) {
            c.fail(
              `${p}.ai.dropped[${i}].detail: "${d.detail}" (want ${nameOnly ? 'just the name' : '"<unit name>, p. <n>"'} for ${d.kind})`,
            )
          }
        }
      })
    }
  }

  if (c.key(a, 'general_knowledge', 'array', p)) {
    a.general_knowledge.forEach((g, i) => {
      if (c.key(g, 'text', 'string', `${p}.general_knowledge[${i}]`) && g.text.length > 200)
        c.fail(`${p}.general_knowledge[${i}].text: over 200 characters`)
      if (c.key(g, 'label', 'string', `${p}.general_knowledge[${i}]`) && g.label !== GK_LABEL)
        c.fail(`${p}.general_knowledge[${i}].label: must be "${GK_LABEL}"`)
    })
  }

  if (c.key(a, 'suggestions', 'array', p)) {
    const n = a.suggestions.length
    if (a.status === 'ok' && (n < 1 || n > 4)) c.fail(`${p}.suggestions: ${n} (want 1–4 when ok)`)
    if (a.status === 'no_guide_support' && n !== 0) c.fail(`${p}.suggestions: ${n} (want 0 with no support)`)
    a.suggestions.forEach((s, i) => {
      const sp = `${p}.suggestions[${i}]`
      if (c.key(s, 'rank', 'integer', sp) && s.rank !== i + 1) c.fail(`${sp}.rank: ${s.rank}, want ${i + 1}`)
      c.key(s, 'model_id', 'string', sp)
      c.key(s, 'unit_name', 'string', sp)
      c.key(s, 'section', 'string', sp)
      c.key(s, 'based_on', 'string|null', sp)
      c.strings(s, 'brands', sp)
      const pages = c.pages(s, 'pages', sp)
      if (c.key(s, 'source', 'string', sp)) c.oneOf(s.source, ['guide_search', 'ai_checked'], `${sp}.source`)
      c.key(s, 'score', 'number', sp)
      if (c.key(s, 'why', 'array', sp)) {
        if (s.why.length < 1 || s.why.length > 3) c.fail(`${sp}.why: ${s.why.length} quotes (want 1–3)`)
        s.why.forEach((w, j) => {
          c.quote(w, `${sp}.why[${j}]`, pages)
          c.saidBy(w, `${sp}.why[${j}]`)
          c.strings(w, 'matched', `${sp}.why[${j}]`)
        })
      }
      if (c.key(s, 'knobs', 'array', sp)) {
        const order = s.knobs.map((k) => k?.knob)
        if (JSON.stringify(order) !== JSON.stringify(KNOBS))
          c.fail(`${sp}.knobs: order ${JSON.stringify(order)}, want exactly ${JSON.stringify(KNOBS)}`)
        s.knobs.forEach((k, j) => {
          const kp = `${sp}.knobs[${j}]`
          if (c.key(k, 'value', 'number', kp) && (k.value < 0 || k.value > 10)) c.fail(`${kp}.value: ${k.value} out of 0–10`)
          if (!c.key(k, 'kind', 'string', kp)) return
          c.oneOf(k.kind, ['guide', 'guide_rule', 'guess'], `${kp}.kind`)
          if (k.kind === 'guide') {
            c.quote(k, kp)
            c.saidBy(k, kp)
          }
          if (k.kind === 'guide_rule') c.quote(k, kp)
          if (
            (k.kind === 'guide' || k.kind === 'guide_rule') &&
            typeof k.quote === 'string' &&
            !HINT_SETS.some((h) => quoteSupportsKnob(k.knob, k.value, k.quote, h))
          )
            c.fail(`${kp}: the quote doesn't state ${k.knob} ${k.value}, so it can't carry a page (API.md §4.3)`)
          if (k.kind === 'guess' && k.note !== GUESS_NOTE) c.fail(`${kp}.note: must be "${GUESS_NOTE}"`)
          if ('direction' in k) {
            if (k.kind !== 'guess') c.fail(`${kp}.direction: only a guess may be nudged`)
            if (c.is(k.direction, 'object', `${kp}.direction`)) {
              c.oneOf(k.direction.dir, ['up', 'down'], `${kp}.direction.dir`)
              c.quote(k.direction, `${kp}.direction`)
            }
          }
        })
      }
      c.quoteOrNull(s, 'taper_note', sp)
      if (c.key(s, 'other_settings', 'array', sp)) {
        s.other_settings.forEach((o, j) => {
          c.key(o, 'text', 'string', `${sp}.other_settings[${j}]`)
          c.quote(o, `${sp}.other_settings[${j}]`)
        })
      }
      c.cab(s, sp, pages)
      if (c.key(s, 'ares_flags', 'array', sp)) {
        s.ares_flags.forEach((f, j) => {
          const fp = `${sp}.ares_flags[${j}]`
          c.oneOf(f.param, ['Motor Drive', 'Transformer Grind'], `${fp}.param`)
          c.oneOf(f.where, ['why', 'settings', 'direction', 'ai'], `${fp}.where`)
          c.key(f, 'quote', 'string', fp)
          // §4.5: the flagged quote's page for why / settings / direction; null only for AI text.
          if (c.key(f, 'page', 'integer|null', fp)) {
            if (f.where === 'ai' && f.page !== null) c.fail(`${fp}.page: must be null for where "ai"`)
            if (f.where !== 'ai' && !Number.isInteger(f.page)) c.fail(`${fp}.page: must be the flagged quote's page for where "${f.where}"`)
          }
          c.key(f, 'advice', 'string', fp)
        })
      }
    })
  }

  if (c.key(a, 'ares', 'object', p)) {
    const ar = a.ares
    if (ar.firmware !== 'Ares') c.fail(`${p}.ares.firmware: must be "Ares"`)
    c.key(ar, 'guide_firmware', 'string', `${p}.ares`)
    c.key(ar, 'note', 'string', `${p}.ares`)
    if (c.key(ar, 'sources', 'array', `${p}.ares`)) {
      if (ar.sources.length !== 2) c.fail(`${p}.ares.sources: ${ar.sources.length} (want 2)`)
      ar.sources.forEach((s, i) => {
        if (c.key(s, 'url', 'string', `${p}.ares.sources[${i}]`) && !s.url.startsWith('https://'))
          c.fail(`${p}.ares.sources[${i}].url: not https`)
        c.key(s, 'fetched', 'string', `${p}.ares.sources[${i}]`)
        c.key(s, 'quote', 'string', `${p}.ares.sources[${i}]`)
      })
    }
  }
  if (c.key(a, 'guide', 'object', p)) for (const k of ['title', 'revision', 'firmware']) c.key(a.guide, k, 'string', `${p}.guide`)
  return c.errors
}
