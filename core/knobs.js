// Seven knobs for a suggestion (docs/API.md §4.3).
import { KNOBS } from './labels.js'
import { hasWholeWord } from './text.js'

export const GUESS_NOTE = 'starting guess — not from the guide'
export const DRIVE_BY_INTENT = { clean: 2.5, edge: 4.5, crunch: 6, lead: 7, high_gain: 7 }
export const NUDGE = 2

const INTENT_WORD = { high_gain: 'high gain', lead: 'lead', crunch: 'crunch', edge: 'edge', clean: 'clean' }

const clamp = (v) => Math.min(10, Math.max(0, v))

// 1. same unit name → 2. quote holds a found term or the intent word → 3. the first → none.
export function pickSettings(model, { unitName = null, terms = [], intent = null } = {}) {
  const list = model.settings || []
  if (!list.length) return null
  if (unitName) {
    const same = list.find((s) => s.unit_name && s.unit_name.toLowerCase() === unitName.toLowerCase())
    if (same) return same
  }
  const words = [...terms, ...(intent ? [INTENT_WORD[intent]] : [])]
  const withTerm = list.find((s) => words.some((w) => hasWholeWord(s.quote, w)))
  return withTerm || list[0]
}

// → { knobs: [7], taper_note, other_settings }
export function knobsFor(model, { unitName = null, terms = [], intent = null, conventions = [] } = {}) {
  const picked = pickSettings(model, { unitName, terms, intent })
  const conv = (id) => conventions.find((c) => c.id === id) || null
  const out = new Map()
  if (picked) {
    for (const k of KNOBS) {
      if (k in picked.knobs) {
        out.set(k, { knob: k, value: picked.knobs[k], kind: 'guide', quote: picked.quote, page: picked.page, said_by: picked.said_by ?? null })
      }
    }
  }
  const noMv = conv('no-master-volume')
  if (!out.has('Master') && model.facets?.master_volume === 'no' && noMv) {
    out.set('Master', { knob: 'Master', value: 10, kind: 'guide_rule', quote: noMv.quote, page: noMv.page })
  }
  for (const k of KNOBS) {
    if (out.has(k)) continue
    const base = k === 'Drive' ? (DRIVE_BY_INTENT[intent] ?? 5) : 5
    const g = { knob: k, value: base, kind: 'guess', note: GUESS_NOTE }
    const d = (model.directions || []).find((x) => x.knob === k)
    if (d) {
      g.value = clamp(base + (d.dir === 'up' ? NUDGE : -NUDGE))
      g.direction = { dir: d.dir, quote: d.quote, page: d.page }
    }
    out.set(k, g)
  }
  const knobs = KNOBS.map((k) => out.get(k))
  const taper = conv('taper-match')
  return {
    knobs,
    taper_note: knobs.some((k) => k.kind === 'guide') && taper ? { quote: taper.quote, page: taper.page } : null,
    other_settings: picked ? picked.other.map((text) => ({ text, quote: picked.quote, page: picked.page })) : [],
    settings_quote: picked ? { quote: picked.quote, page: picked.page } : null,
  }
}
