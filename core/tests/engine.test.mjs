// Knobs, stored-quote fallback and Ares (docs/API.md §4.3–4.5).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadPages } from './guide-node.mjs'
import { answer } from '../answer.js'
import { knobsFor, GUESS_NOTE } from '../knobs.js'
import { ARES, ARES_ADVICE } from '../ares.js'
import { search } from '../search.js'
import { checkInvariants } from './invariants.mjs'

const read = (p) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8'))
const pages = loadPages()
const models = read('../../data/models.json')
const byId = new Map(models.models.map((m) => [m.id, m]))
const conventions = models.conventions
const P12 = 'If the original amp has no Master Volume control, the Master control in the amp model will default at 10.'

test('a model with a guide settings set gives kind "guide" values with the quote', () => {
  const m = byId.get('1959slp')
  const { knobs, taper_note } = knobsFor(m, { conventions })
  const bass = knobs.find((k) => k.knob === 'Bass')
  assert.deepEqual(bass, { knob: 'Bass', value: 2, kind: 'guide', quote: m.settings[0].quote, page: 28, said_by: null })
  assert.equal(knobs.filter((k) => k.kind === 'guide').length, 3)
  assert.equal(taper_note.page, 12)
  assert.match(taper_note.quote, /tapers on the original amps within 10%/)
})

test('no master volume and no Master in the set → guide_rule 10 with the p. 12 quote', () => {
  const m = byId.get('1959slp')
  assert.equal(m.facets.master_volume, 'no')
  assert.ok(!('Master' in m.settings[0].knobs))
  const master = knobsFor(m, { conventions }).knobs.find((k) => k.knob === 'Master')
  assert.deepEqual(master, { knob: 'Master', value: 10, kind: 'guide_rule', quote: P12, page: 12 })
  // Control: a model with a master volume never gets the rule.
  const withMv = models.models.find((x) => x.facets.master_volume === 'yes' && !x.settings.length)
  assert.equal(knobsFor(withMv, { conventions }).knobs.find((k) => k.knob === 'Master').kind, 'guess')
})

test('a model without settings gives seven guesses with the exact note', () => {
  const m = models.models.find((x) => !x.refers_to && !x.settings.length && x.facets.master_volume !== 'no' && !x.directions.length)
  const { knobs, taper_note, other_settings } = knobsFor(m, { conventions, intent: 'clean' })
  assert.equal(knobs.length, 7)
  for (const k of knobs) {
    assert.equal(k.kind, 'guess')
    assert.equal(k.note, 'starting guess — not from the guide')
    assert.equal(k.note, GUESS_NOTE)
    assert.ok(!('quote' in k) && !('page' in k))
  }
  assert.equal(knobs[0].value, 2.5, 'Drive by intent: clean')
  assert.ok(knobs.slice(1).every((k) => k.value === 5))
  assert.equal(taper_note, null)
  assert.deepEqual(other_settings, [])
})

test('a tip direction nudges only a guess', () => {
  const brown = byId.get('brit-brown-and-fas-brown')
  const presence = knobsFor(brown, { conventions }).knobs.find((k) => k.knob === 'Presence')
  assert.equal(presence.kind, 'guess')
  assert.equal(presence.value, 7)
  assert.deepEqual(presence.direction, { dir: 'up', quote: 'Turn up Presence in the Brit Brown model', page: 60 })
  // 1959SLP's tip says turn Bass down and Middle and Treble up, but those knobs have guide values.
  const slp = byId.get('1959slp')
  assert.ok(slp.directions.some((d) => d.knob === 'Bass' && d.dir === 'down'), 'control: the direction exists')
  for (const k of knobsFor(slp, { conventions }).knobs.filter((x) => x.kind === 'guide')) {
    assert.equal(k.value, slp.settings[0].knobs[k.knob])
    assert.ok(!('direction' in k))
  }
  // Up → at least 7, down → at most 3; a guess already on that side stays.
  const up = { ...brown, directions: [{ knob: 'Drive', dir: 'up', quote: 'x', page: 60 }] }
  assert.equal(knobsFor(up, { conventions, intent: 'high_gain' }).knobs[0].value, 7)
  assert.equal(knobsFor(up, { conventions, intent: 'clean' }).knobs[0].value, 7)
  const down = { ...brown, directions: [{ knob: 'Drive', dir: 'down', quote: 'x', page: 60 }] }
  const clean = knobsFor(down, { conventions, intent: 'clean' }).knobs[0]
  assert.equal(clean.value, 2.5, 'clean Drive 2.5 with "keep Drive low" stays 2.5')
  assert.equal(clean.direction.dir, 'down')
  assert.equal(knobsFor(down, { conventions }).knobs[0].value, 3)
})

test('the settings entry with the same unit name wins', () => {
  const m = byId.get('cali-leggy-and-legato-100')
  const legato = knobsFor(m, { conventions, unitName: 'Legato 100' }).knobs.find((k) => k.knob === 'Mid')
  assert.equal(legato.kind, 'guess', 'Legato 100 set has Mid: 4/5 in other')
  const leggy = knobsFor(m, { conventions, unitName: 'Cali Leggy' }).knobs.find((k) => k.knob === 'Mid')
  assert.equal(leggy.kind, 'guess', 'no Cali Leggy set: first set')
})

test('the answer with pages: null still works from stored quotes', () => {
  const a = answer('Van Halen brown sound', { models, pages: null })
  assert.equal(a.status, 'ok')
  assert.ok(a.suggestions.length >= 1)
  for (const s of a.suggestions) {
    const m = byId.get(s.model_id)
    const stored = new Set(JSON.stringify(m).match(/"quote":"(?:[^"\\]|\\.)*"/g).map((x) => JSON.parse(x.slice(8))))
    for (const w of s.why) assert.ok(stored.has(w.quote), `${s.model_id}: why is not a stored quote: ${w.quote}`)
  }
  checkInvariants(a, { pages: null })
  // And with pages the same query also works (control that null is a different path).
  assert.equal(answer('Van Halen brown sound', { models, pages }).status, 'ok')
})

test('a planted "SAMPLE (test only): add Transformer Grind" tip yields one ares_flags entry', () => {
  const planted = structuredClone(models)
  const m = planted.models.find((x) => x.id === '1959slp')
  m.tips.push({ quote: 'SAMPLE (test only): add Transformer Grind', page: 28, said_by: null })
  const a = answer('1959SLP transformer grind', { models: planted, pages: null })
  const s = a.suggestions.find((x) => x.model_id === '1959slp')
  assert.ok(s, `1959slp suggested: ${a.suggestions.map((x) => x.model_id)}`)
  assert.equal(s.ares_flags.length, 1)
  assert.deepEqual(s.ares_flags[0], {
    param: 'Transformer Grind',
    where: 'why',
    quote: 'SAMPLE (test only): add Transformer Grind',
    page: 28,
    advice: "Your firmware doesn't have this control. Skip this step: Fractal replaced it with Speaker Compression (Spkr Comp), which resets to 3.0.",
  })
  assert.equal(s.ares_flags[0].advice, ARES_ADVICE)
  // Control: the unplanted data gives no flag for the same model.
  const clean = answer('1959SLP', { models, pages })
  assert.ok(clean.suggestions.every((x) => x.ares_flags.length === 0))
})

test('the ares object equals API.md §4.5 on every answer', () => {
  const expected = {
    firmware: 'Ares',
    guide_firmware: 'Quantum 7.02',
    note: 'yek\'s guide was written for Quantum 7.02. Your Axe-Fx II runs Ares, which came later. Quantum 9.00 removed Motor Drive and Transformer Grind from the Amp block and replaced them with Speaker Compression (Spkr Comp), and Fractal says Ares amp modeling "should sound very similar".',
    sources: [
      { url: 'https://forum.fractalaudio.com/threads/axe-fx-ii-quantum-rev-9-00-firmware-release.131649/', fetched: '2026-09-14',
        quote: 'Removed the “Motor Drive” and “Transformer Grind” algorithms and associated parameters from the Amp block. These have been replaced by the new “Speaker Compression” algorithm.' },
      { url: 'https://forum.fractalaudio.com/threads/axe-fx-ii-ares-rev-1-00-firmware-release.148248/', fetched: '2026-09-14',
        quote: 'Not all aspects of the Ares modeling were able to be ported but the most important parts were and the amp modeling should sound very similar.' },
    ],
  }
  assert.deepEqual(answer('banjo through a toaster', { models, pages }).ares, expected)
  assert.deepEqual(answer('Robben Ford', { models, pages }).ares, expected)
  assert.deepEqual(JSON.parse(JSON.stringify(ARES)), expected)
  // The lead's source file holds the same quotes.
  const src = read('../../data/sources/fractal-release-notes.json')
  assert.ok(src.sources[0].quotes.includes(expected.sources[0].quote))
  assert.ok(src.sources[1].quotes.includes(expected.sources[1].quote))
})

test('understood: matched, unmatched, intent', () => {
  const r = search('clean worship pad with sparkle', { models, pages })
  assert.equal(r.understood.intent, 'clean')
  assert.ok(r.understood.unmatched_terms.includes('worship'))
  const v = search('Van Halen brown sound', { models, pages })
  assert.ok(v.understood.matched_terms.includes('van halen'))
  assert.equal(search('djent chug', { models, pages }).understood.intent, 'high_gain')
  assert.equal(search('edge of breakup blues', { models, pages }).understood.intent, 'edge')
})

test('which sentence first: a why sentence naming the model wins (Metallica → “Metallica’s IIC+”, p. 270)', () => {
  const a = answer('Metallica', { models, pages })
  const s = a.suggestions[0]
  assert.equal(s.model_id, 'usa-iic-plus-and-usa-iic-plus-plus')
  assert.equal(s.why[0].page, 270)
  assert.match(s.why[0].quote, /Metallica’s IIC\+/)
})

test('coverage: a model matching one of two found terms scores exactly 0.75 × its single-term score', async () => {
  const { search } = await import('../search.js')
  const one = search('chime', { models, pages }).candidates
  const both = search('The Edge chime', { models, pages }).candidates
  const car1 = one.find((c) => c.model.id === 'car-roamer')
  const car2 = both.find((c) => c.model.id === 'car-roamer')
  assert.ok(car1 && car2, 'control: Car Roamer is a candidate for both queries')
  assert.deepEqual(car2.terms.map((t) => t.term), ['chime'], 'control: it matches only "chime"')
  assert.ok(Math.abs(car2.score - 0.75 * car1.score) < 1e-9, `${car2.score} vs 0.75 × ${car1.score}`)
  const edge = search('the edge', { models, pages }).candidates.find((c) => c.model.id === 'class-a-30w')
  const chime = search('chime', { models, pages }).candidates.find((c) => c.model.id === 'class-a-30w')
  const classA = both.find((c) => c.model.id === 'class-a-30w')
  assert.equal(classA.terms.length, 2)
  // Both terms covered → factor 1, so its score is the plain sum (chime may fall outside the single-query top 4).
  if (edge && chime) assert.ok(Math.abs(classA.score - (edge.score + chime.score)) < 1e-9)
})
