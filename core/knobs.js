// Seven knobs for a suggestion (docs/API.md §4.3).
import { KNOBS, labelMap, parseControlHints, parseKnobs } from './labels.js'
import { hasWholeWord } from './text.js'

export const GUESS_NOTE = 'starting guess — not from the guide'
export const DRIVE_BY_INTENT = { clean: 2.5, edge: 4.5, crunch: 6, lead: 7, high_gain: 7 }
export const NUDGE_UP = 7
export const NUDGE_DOWN = 3

const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A knob keeps a page only if its quote states that knob's value (docs/API.md §4.3): either a settings sentence
// that parses to exactly this value ("Bass 2, Mid 8, Treble 7.5"), or a sentence where the knob's label is followed,
// in the same sentence, by a setting phrase and the value ("the Master control in the amp model will default at
// 10"). The p. 12 taper sentence ("within 10%, except for Master, Presence/Hi Cut and Depth") names Master but
// states no Master value, so it can't cite Master 10.
export function quoteSupportsKnob(knob, value, quote, hints = {}) {
  const text = String(quote || '')
  if (!text) return false
  if (parseKnobs(text, hints)[knob] === Number(value)) return true
  const labels = Object.entries(labelMap(hints))
    .filter(([, k]) => k === knob)
    .map(([l]) => l)
  if (!labels.length) return false
  const v = escapeRe(String(Number(value)))
  const re = new RegExp(
    `(?<![A-Za-z0-9])(?:${labels.map(escapeRe).join('|')})(?![A-Za-z0-9])[^.!?]{0,80}?(?:defaults?\\s+(?:at|to)|set\\s+(?:at|to)|at|to|on)\\s+${v}(?![\\d.]*\\d|\\s*%)`,
    'i',
  )
  return re.test(text)
}

const INTENT_WORD = { high_gain: 'high gain', lead: 'lead', crunch: 'crunch', edge: 'edge', clean: 'clean' }

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
  const hints = parseControlHints(model.controls?.quote)
  const out = new Map()
  if (picked) {
    for (const k of KNOBS) {
      if (k in picked.knobs && quoteSupportsKnob(k, picked.knobs[k], picked.quote, hints)) {
        out.set(k, {
          knob: k,
          value: picked.knobs[k],
          kind: 'guide',
          quote: picked.quote,
          page: picked.page,
          said_by: picked.said_by ?? null,
        })
      }
    }
  }
  const noMv = conv('no-master-volume')
  if (!out.has('Master') && model.facets?.master_volume === 'no' && noMv && quoteSupportsKnob('Master', 10, noMv.quote)) {
    out.set('Master', { knob: 'Master', value: 10, kind: 'guide_rule', quote: noMv.quote, page: noMv.page })
  }
  for (const k of KNOBS) {
    if (out.has(k)) continue
    const base = k === 'Drive' ? (DRIVE_BY_INTENT[intent] ?? 5) : 5
    const g = { knob: k, value: base, kind: 'guess', note: GUESS_NOTE }
    const d = (model.directions || []).find((x) => x.knob === k)
    if (d) {
      g.value = d.dir === 'up' ? Math.max(base, NUDGE_UP) : Math.min(base, NUDGE_DOWN)
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
