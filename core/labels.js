// Knob labels, `Label (=Knob)` hints, settings and direction parsing (docs/API.md §3 rules 6–7).
// Shared by scripts/build-models.mjs and the tests, so the stored knobs can be re-derived and checked.

export const KNOBS = ['Drive', 'Bass', 'Mid', 'Treble', 'Master', 'Presence', 'Depth']

export const LABEL_TABLE = {
  'input drive': 'Drive',
  drive: 'Drive',
  gain: 'Drive',
  bass: 'Bass',
  mid: 'Mid',
  middle: 'Mid',
  midrange: 'Mid',
  midrang: 'Mid',
  treble: 'Treble',
  master: 'Master',
  mv: 'Master',
  'master volume': 'Master',
  presence: 'Presence',
  depth: 'Depth',
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// `Label (=Target)` hints in a controls quote → { lowercased label: knob | null }. A hint whose target is not
// one of the seven knobs (Overdrive, Hi Cut, Bright…) maps its label to null: that label is not a knob.
export function parseControlHints(controls) {
  const hints = {}
  if (!controls) return hints
  const re = /([A-Za-z][A-Za-z0-9\-\/ ]*?)\s*\(\s*=\s*([^)]+?)\s*\)/g
  let m
  while ((m = re.exec(controls))) {
    let label = m[1].trim()
    const and = label.lastIndexOf(' and ')
    if (and >= 0) label = label.slice(and + 5).trim()
    if (!label) continue
    const target = m[2].replace(/\s+/g, ' ').trim().toLowerCase()
    hints[label.toLowerCase()] = LABEL_TABLE[target] || null
  }
  return hints
}

// Table, then hints on top. `Volume` is only a knob through a hint.
export function labelMap(hints = {}) {
  return { ...LABEL_TABLE, ...hints }
}

function labelRegex(map) {
  const labels = Object.keys(map).sort((a, b) => b.length - a.length)
  return new RegExp('(?<![A-Za-z0-9])(' + labels.map(escapeRegex).join('|') + ')(?![A-Za-z0-9])', 'gi')
}

// → { Drive: 5, … } in KNOBS order. `other` fragments are blanked first: they are non-knob settings by
// definition (a pedal's "Drive 0", "Overdrive: 9-10"). A value is one number 0–10 right after its label.
export function parseKnobs(quote, hints = {}, other = []) {
  let text = String(quote)
  for (const frag of other) {
    const i = text.indexOf(frag)
    if (i >= 0) text = text.slice(0, i) + ' '.repeat(frag.length) + text.slice(i + frag.length)
  }
  const map = labelMap(hints)
  const re = labelRegex(map)
  const found = {}
  let m
  while ((m = re.exec(text))) {
    const knob = map[m[1].toLowerCase()]
    if (!knob || knob in found) continue
    const rest = text.slice(m.index + m[0].length)
    const v = /^\s*(?:[:=]\s*)?(?:(?:at|around)\s+)*(\d+(?:\.\d+)?)(?![\d.]*\d)/i.exec(rest)
    if (!v) continue
    const after = rest.slice(v[0].length)
    if (/^\s*(?:[-–\/]\s*\d|to\s+\d|%|:\d|\s*o['’]clock)/i.test(after)) continue // ranges, clock, percent
    const value = Number(v[1])
    if (!(value >= 0 && value <= 10)) continue
    found[knob] = value
  }
  const out = {}
  for (const k of KNOBS) if (k in found) out[k] = found[k]
  return out
}

// Directions from a tip (rule 7): → [{ knob, dir }] in quote order, one per knob, conflicts dropped.
export function parseDirections(tip, hints = {}) {
  const map = labelMap(hints)
  const labels = Object.keys(map).sort((a, b) => b.length - a.length).map(escapeRegex).join('|')
  const L = `(?:the\\s+)?(?:${labels})(?![A-Za-z0-9])`
  const LIST = `${L}(?:\\s*(?:,\\s*(?:and\\s+)?|\\s+and\\s+|\\s+or\\s+)${L})*`
  const UP = 'turn(?:ing)?\\s+up|crank(?:ing)?|increas(?:e|ing)|rais(?:e|ing)|boost(?:ing)?'
  const DOWN = 'turn(?:ing)?\\s+down|decreas(?:e|ing)|lower(?:ing)?|reduc(?:e|ing)'
  const patterns = [
    [new RegExp(`(?<![A-Za-z])(${UP})\\s+(${LIST})`, 'gi'), 'up'],
    [new RegExp(`(?<![A-Za-z])(${DOWN})\\s+(${LIST})`, 'gi'), 'down'],
    [new RegExp(`(?<![A-Za-z])turn\\s+(${LIST})\\s+(?:all\\s+the\\s+way\\s+|way\\s+|a\\s+(?:little|bit)\\s+)?(up|down)(?![A-Za-z])`, 'gi'), 'turn'],
    [new RegExp(`(?<![A-Za-z])keep\\s+(${LIST})\\s+(low|down|high|up)(?![A-Za-z])`, 'gi'), 'keep'],
  ]
  const hits = []
  for (const [re, kind] of patterns) {
    let m
    while ((m = re.exec(tip))) {
      const before = tip.slice(Math.max(0, m.index - 16), m.index)
      if (/(?:don['’]t|do not|never|avoid)\s+(?:\w+\s+)?$/i.test(before) && !/hesitate/i.test(before)) continue
      let list, dir
      if (kind === 'up' || kind === 'down') {
        list = m[2]
        dir = kind
      } else {
        list = m[1]
        dir = /^(up|high)$/i.test(m[2]) ? 'up' : 'down'
      }
      const lre = labelRegex(map)
      let lm
      while ((lm = lre.exec(list))) {
        const knob = map[lm[1].toLowerCase()]
        if (knob) hits.push({ at: m.index + lm.index, knob, dir })
      }
    }
  }
  hits.sort((a, b) => a.at - b.at)
  const byKnob = new Map()
  const conflicted = new Set()
  for (const h of hits) {
    if (!byKnob.has(h.knob)) byKnob.set(h.knob, h)
    else if (byKnob.get(h.knob).dir !== h.dir) conflicted.add(h.knob)
  }
  return [...byKnob.values()].filter((h) => !conflicted.has(h.knob)).map(({ knob, dir }) => ({ knob, dir }))
}
