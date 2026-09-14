import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadPages, loadSections } from './guide-node.mjs'
import { pageText, pagesSha256 } from '../guide.js'
import { normText } from '../text.js'
import { checkQuote } from '../verify.js'
import { BRANDS, brandsForSection } from '../brands.js'
import { facetMasterVolume, facetPowerTubes, modelsForUnitName, resolvedModel } from '../models.js'
import { parseControlHints, parseKnobs, labelMap, KNOBS } from '../labels.js'
import { buildData, slug, APPENDIX_SECTIONS, SPEC_KEYS } from '../../scripts/build-models.mjs'

const read = (p) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8'))
const pages = loadPages()
const sections = loadSections()
const data = read('../../data/models.json')
const golden = read('../../data/golden.json')
const curation = read('../../data/curation.json')
const models = data.models
const byId = new Map(models.map((m) => [m.id, m]))

export const QUOTE_BUDGET = 0.15

// Every {quote, page} object in a model, with the path it sits on.
function quotesOf(m) {
  const out = []
  const walk = (v, path) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`))
    else if (v && typeof v === 'object') {
      if (typeof v.quote === 'string' && 'page' in v) out.push({ ...v, path })
      for (const [k, x] of Object.entries(v)) if (k !== 'quote') walk(x, `${path}.${k}`)
    }
  }
  walk(m, m.id)
  return out
}

test('rule 1: exactly 109 models, same order, sections and start pages as sections.json', () => {
  const expected = sections.filter((s) => !APPENDIX_SECTIONS.includes(s.title))
  assert.equal(expected.length, 109)
  assert.equal(models.length, golden.model_count)
  assert.deepEqual(models.map((m) => m.section), expected.map((s) => s.title))
  assert.deepEqual(models.map((m) => m.pages.start), expected.map((s) => s.page))
  for (let i = 0; i < models.length; i++) {
    const nextPage = sections[sections.findIndex((s) => s.title === models[i].section && s.page === models[i].pages.start) + 1].page
    assert.equal(models[i].pages.end, nextPage - 1, models[i].id)
  }
})

test('rule 1: every section title is in the TOC; every TOC amp entry is a title or a unit name', () => {
  const tocText = [2, 3, 4, 5, 6, 7].map((p) => pageText(pages, p)).join(' ')
  for (const m of models) assert.ok(tocText.includes(m.section), `TOC misses ${m.section}`)
  const titles = new Set(models.map((m) => m.section))
  const unitNames = new Set(models.flatMap((m) => m.unit_names.flatMap((u) => [u.name.toLowerCase(), u.evidence.toLowerCase()])))
  let inAmps = false
  let n = 0
  for (let p = 2; p <= 7; p++) {
    for (const line of pages.get(p).split('\n')) {
      const mm = /^(.*?)\s*\.{2,}\s*(\d+)\s*$/.exec(line) || /^(.*?[^.\d\s])\s*(\d+)$/.exec(line)
      if (!mm) continue
      const text = normText(mm[1].replace(/\.+$/, ''))
      if (text === 'The Amps') { inAmps = true; continue }
      if (text === 'Amp Categories') inAmps = false
      if (!inAmps) continue
      n++
      const namePart = text.split(/: | \(/)[0].toLowerCase()
      assert.ok(titles.has(text) || unitNames.has(namePart), `TOC entry not accounted for: ${text}`)
    }
  }
  assert.ok(n >= 150, `control: TOC parsed (${n} entries)`)
})

test('rule 2: ids are slug(name), unique; golden ids exist; duplicate names use the TOC sub-entry', () => {
  assert.equal(new Set(models.map((m) => m.id)).size, models.length)
  for (const m of models) assert.equal(m.id, slug(m.name))
  for (const id of golden.ids_must_exist) assert.ok(byId.has(id), `missing id ${id}`)
  assert.equal(slug('USA IIC+ and USA IIC++'), 'usa-iic-plus-and-usa-iic-plus-plus')
  assert.equal(slug('Dweezil’s B-man'), 'dweezils-b-man')
  assert.equal(byId.get('suhr-badger-18').pages.start, 238)
  assert.equal(byId.get('suhr-badger-30').pages.start, 239)
})

test('rule 3: unit names have verified evidence, are evidence or its slash expansion, no case dups', () => {
  for (const m of models) {
    const seen = new Set()
    assert.ok(m.unit_names.length > 0 || /models$/.test(m.name) === false, `${m.id} has no unit names`)
    for (const u of m.unit_names) {
      assert.ok(u.evidence.length >= 3)
      assert.ok(checkQuote({ quote: u.evidence, page: u.page }, pages, { minLength: 3, sentences: false }).ok, `${m.id}: ${u.evidence} p. ${u.page}`)
      if (u.name !== u.evidence) {
        const parts = u.evidence.split('/')
        const first = parts[0].split(' ')
        const expansions = new Set([parts[0]])
        for (let k = 1; k <= first.length; k++) for (const later of parts.slice(1)) expansions.add([...first.slice(0, -k), later].join(' '))
        assert.ok(expansions.has(u.name), `${m.id}: ${u.name} is not an expansion of ${u.evidence}`)
      }
      assert.ok(!seen.has(u.name.toLowerCase()), `${m.id}: duplicate ${u.name}`)
      seen.add(u.name.toLowerCase())
    }
  }
  // Pointers are not unit names of the pointing section.
  assert.ok(!byId.get('fas-custom-models').unit_names.some((u) => u.name === 'FAS Brown'))
  // Slash names that are part of the name stay whole.
  assert.ok(byId.get('usa-iic-plus-and-usa-iic-plus-plus').unit_names.some((u) => u.name === 'USA IIC+ BRT/DP'))
  const plexi = byId.get('plexi-models').unit_names.map((u) => u.name)
  for (const n of ['Plexi 100W HIGH', 'Plexi 100W JUMP', 'Plexi 100W NRML', 'Plexi 50W HI 1', 'Plexi 50W JUMP', 'Plexi 50W NRML']) assert.ok(plexi.includes(n), n)
})

test('golden: names_resolve_to, names_never, stub_ids, stub_targets', () => {
  for (const [name, id] of Object.entries(golden.names_resolve_to)) {
    assert.deepEqual(modelsForUnitName(data, name), [id], `${name} → ${modelsForUnitName(data, name)}`)
  }
  for (const name of golden.names_never) assert.deepEqual(modelsForUnitName(data, name), [], name)
  const stubs = models.filter((m) => m.refers_to).map((m) => m.id)
  // Contract question 1 (build report): p. 139 "Dweezil’s B-man" is, by §0, a stub ("Please refer to the section
  // on the 65 Bassguy model.") but golden stub_ids leaves it out. Golden's five are asserted exactly; the one
  // extra is named here so the divergence stays visible instead of silent.
  assert.deepEqual(stubs.filter((id) => id !== 'dweezils-b-man').sort(), [...golden.stub_ids].sort())
  assert.equal(byId.get('dweezils-b-man').refers_to, '65-bassguy')
  assert.equal(stubs.length, golden.stub_ids.length + 1)
  for (const [stub, target] of Object.entries(golden.stub_targets)) {
    assert.equal(byId.get(stub).refers_to, target)
    assert.equal(resolvedModel(data, stub).id, target)
  }
})

test('rule 4: specs verbatim or null, facets derived, brands from the fixed table', () => {
  for (const m of models) {
    const s = sections.find((x) => x.title === m.section && x.page === m.pages.start)
    const joined = normText(Array.from({ length: m.pages.end - m.pages.start + 1 }, (_, j) => pageText(pages, m.pages.start + j)).join(' '))
    for (const [src, key] of Object.entries(SPEC_KEYS)) {
      const v = s.specs?.[src]
      if (m.specs[key] !== null) {
        assert.equal(m.specs[key], normText(v))
        assert.ok(joined.includes(m.specs[key]), `${m.id}.${key}`)
      } else if (v != null) {
        assert.ok(!joined.includes(normText(v)), `${m.id}.${key} is null but verbatim`)
      }
    }
    assert.equal(m.facets.master_volume, facetMasterVolume(m.specs.master_volume))
    assert.deepEqual(m.facets.power_tubes, facetPowerTubes(m.specs.power_tubes))
    assert.deepEqual(m.brands, brandsForSection(m.section))
    for (const b of m.brands) {
      const tokens = BRANDS.find(([name]) => name === b)[1]
      assert.ok(tokens.some((t) => m.section.includes(t)), `${m.id}: ${b}`)
    }
  }
  assert.equal(facetMasterVolume('Yes (Lead) No (Clean)'), 'mixed')
  assert.deepEqual(facetPowerTubes('6L6GC / 5881 or EL34, 6AQ5'), ['EL34', 'EL84', '6L6'])
  assert.deepEqual(byId.get('1959slp').brands, ['Marshall'])
  assert.deepEqual(byId.get('fas-custom-models').brands, ['Fractal Audio'])
})

test('rule 5: every quote verified on a page inside its model; quote budget ≤ 15% of the guide', () => {
  let total = 0
  let n = 0
  for (const m of models) {
    for (const q of quotesOf(m)) {
      n++
      total += q.quote.length
      assert.ok(checkQuote({ quote: q.quote, page: q.page }, pages).ok, `${q.path} p. ${q.page}: ${q.quote}`)
      assert.ok(q.page >= m.pages.start && q.page <= m.pages.end, `${q.path} page ${q.page} outside ${m.pages.start}-${m.pages.end}`)
    }
    for (const u of m.unit_names) total += u.evidence.length
    for (const st of m.settings) total += st.context?.length ?? 0
  }
  for (const c of data.conventions) {
    assert.equal(c.page, 12)
    assert.ok(checkQuote(c, pages).ok, c.id)
    total += c.quote.length
  }
  assert.deepEqual(data.conventions.map((c) => c.id), ['high-low-inputs', 'no-master-volume', 'two-gain-controls', 'single-tone-control', 'taper-match', 'soft-reset'])
  let guide = 0
  for (let p = 1; p <= 301; p++) guide += pageText(pages, p).length
  const share = total / guide
  console.log(`quote budget: ${n} quotes, ${total} characters of ${guide} (${(share * 100).toFixed(2)}%, limit ${QUOTE_BUDGET * 100}%)`)
  assert.ok(n > 300, 'control: quotes were walked')
  assert.ok(share <= QUOTE_BUDGET, `quote budget ${share} > ${QUOTE_BUDGET}`)
})

test('rule 6: settings knobs re-derive from the quote, values 0–10 written in the quote', () => {
  let count = 0
  for (const m of models) {
    const hints = parseControlHints(m.controls?.quote)
    for (const st of m.settings) {
      count++
      assert.ok(Object.keys(st.knobs).length >= 1, `${m.id} settings without knobs`)
      assert.deepEqual(st.knobs, parseKnobs(st.quote, hints, st.other), `${m.id} p. ${st.page}`)
      assert.deepEqual(Object.keys(st.knobs), KNOBS.filter((k) => k in st.knobs))
      for (const [k, v] of Object.entries(st.knobs)) {
        assert.ok(v >= 0 && v <= 10)
        assert.match(st.quote, new RegExp(String(v).replace('.', '\\.')), `${m.id} ${k}`)
      }
      for (const o of st.other) assert.ok(st.quote.includes(o))
      if (st.context) assert.ok(checkQuote({ quote: st.context, page: st.page }, pages).ok)
      if (st.unit_name) assert.ok(m.unit_names.some((u) => u.name === st.unit_name))
    }
  }
  assert.equal(count, curation.settings.length)
  // Spot checks against the guide: hints decide Volume and Drive.
  const slp = byId.get('1959slp').settings
  assert.deepEqual(slp[0].knobs, { Bass: 2, Mid: 8, Treble: 7.5 })
  assert.deepEqual(slp[1].knobs, { Drive: 10, Bass: 0, Mid: 10, Treble: 10 })
  assert.deepEqual(parseControlHints('Drive (=Master), Bass, Middle, Treble, Gain (=Drive)'), { drive: 'Master', gain: 'Drive' })
  assert.deepEqual(parseKnobs('Drive 3, Gain 7', { drive: 'Master', gain: 'Drive' }), { Drive: 7, Master: 3 })
  assert.deepEqual(parseKnobs('Volume 6, Overdrive: 9-10, Mid: 4/5', {}), {})
})

test('rule 7: directions come from tips, up/down, label present', () => {
  let count = 0
  for (const m of models) {
    const map = labelMap(parseControlHints(m.controls?.quote))
    for (const d of m.directions) {
      count++
      assert.ok(m.tips.some((t) => t.quote === d.quote && t.page === d.page), `${m.id}: direction not from a tip`)
      assert.ok(d.dir === 'up' || d.dir === 'down')
      const labels = Object.keys(map).filter((l) => map[l] === d.knob)
      assert.ok(labels.some((l) => new RegExp(`(?<![A-Za-z0-9])${l}(?![A-Za-z0-9])`, 'i').test(d.quote)), `${m.id}: ${d.knob} label not in quote`)
    }
  }
  assert.ok(count > 10, `control: directions exist (${count})`)
  assert.ok(byId.get('brit-brown-and-fas-brown').directions.some((d) => d.knob === 'Presence' && d.dir === 'up'))
})

test('guide sha matches; the build is deterministic and matches the committed file', async () => {
  assert.equal(data.guide.pages_sha256, await pagesSha256(pages))
  const a = await buildData({ pages, sections, curation })
  const b = await buildData({ pages, sections, curation })
  const sa = JSON.stringify(a.data, null, 2) + '\n'
  assert.equal(sa, JSON.stringify(b.data, null, 2) + '\n')
  assert.equal(sa, readFileSync(fileURLToPath(new URL('../../data/models.json', import.meta.url)), 'utf8'), 'data/models.json is stale: run npm run build:models')
})

test('a curated quote that fails verification stops the build', async () => {
  const broken = structuredClone(curation)
  broken.settings[0].quote = broken.settings[0].quote.replace('Input Drive at 4', 'Input Drive at 5')
  await assert.rejects(buildData({ pages, sections, curation: broken }), /settings quote not_on_page/)
})
