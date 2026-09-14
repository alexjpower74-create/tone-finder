// A knob keeps a page only if its quote states that knob's value (docs/API.md §4.3). Lead fix after Onyx's review:
// 1959SLP / PLEXI 100W showed "Master 10 · p. 12" while the only p. 12 sentence on the card was the taper note.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { knobsFor, quoteSupportsKnob } from '../knobs.js'
import { parseControlHints } from '../labels.js'

const data = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/models.json', import.meta.url)), 'utf8'))
const conventions = data.conventions
const conv = (id) => conventions.find((c) => c.id === id)
const model = (id) => data.models.find((m) => m.id === id)
const RULE = conv('no-master-volume').quote
const TAPER = conv('taper-match').quote

test('quoteSupportsKnob: the rule sentence states Master 10; the taper sentence names Master but states no value', () => {
  assert.match(TAPER, /Master/, 'control: the taper sentence really does contain the word Master')
  assert.equal(quoteSupportsKnob('Master', 10, RULE), true)
  assert.equal(quoteSupportsKnob('Master', 10, TAPER), false)
  assert.equal(quoteSupportsKnob('Drive', 10, TAPER), false, '"within 10%" is not a Drive value')
  const plexi = 'My settings for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5.'
  assert.equal(quoteSupportsKnob('Bass', 2, plexi), true)
  assert.equal(quoteSupportsKnob('Treble', 7.5, plexi), true)
  assert.equal(quoteSupportsKnob('Mid', 9, plexi), false, 'a wrong value is not supported')
  assert.equal(quoteSupportsKnob('Presence', 5, plexi), false, 'a knob the sentence never names is not supported')
})

test('negative control: the taper sentence attached to Master 10 is rejected and Master becomes a starting guess', () => {
  const slp = model('1959slp')
  assert.equal(slp.facets.master_volume, 'no')
  const real = knobsFor(slp, { conventions }).knobs.find((k) => k.knob === 'Master')
  assert.equal(real.kind, 'guide_rule')
  assert.equal(real.quote, RULE)
  const planted = conventions.map((c) => (c.id === 'no-master-volume' ? { ...c, quote: TAPER } : c))
  const master = knobsFor(slp, { conventions: planted }).knobs.find((k) => k.knob === 'Master')
  assert.equal(master.kind, 'guess')
  assert.equal(master.page, undefined)
  assert.equal(master.note, 'starting guess — not from the guide')
})

test('a settings knob whose quote does not state it becomes a guess (planted), and no real one does', () => {
  const slp = model('1959slp')
  const planted = { ...slp, settings: slp.settings.map((s, i) => (i === 0 ? { ...s, quote: TAPER, knobs: { Bass: 2 } } : s)) }
  const bass = knobsFor(planted, { conventions }).knobs.find((k) => k.knob === 'Bass')
  assert.equal(bass.kind, 'guess')

  let checked = 0
  for (const m of data.models) {
    const hints = parseControlHints(m.controls?.quote)
    for (const s of m.settings || []) {
      for (const [k, v] of Object.entries(s.knobs)) {
        checked++
        assert.ok(quoteSupportsKnob(k, v, s.quote, hints), `${m.id} ${k} ${v} p. ${s.page}: ${s.quote}`)
      }
    }
    for (const k of knobsFor(m, { conventions }).knobs) {
      if (k.kind !== 'guess') assert.ok(quoteSupportsKnob(k.knob, k.value, k.quote, hints), `${m.id} ${k.knob} ${k.value}`)
    }
  }
  assert.ok(checked >= 50, `only ${checked} stored settings knobs checked`)
})
