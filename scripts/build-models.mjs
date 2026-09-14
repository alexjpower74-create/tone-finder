#!/usr/bin/env node
// Build data/models.json from the local guide + data/curation.json (docs/API.md §3).
// Deterministic: guide order, stable key order, no timestamps. Every stored quote is verified; a curated quote
// that fails verification stops the build. Mechanical cuts that fail are dropped and counted (`--log` prints them).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { loadPages, loadSections } from '../core/tests/guide-node.mjs'
import { pageText, pagesSha256, PDF_PAGES } from '../core/guide.js'
import { normText, splitSentences, splitAtBoxBreaks, spansBoxBreak, cutAttribution, cleanCut, titleSet as makeTitleSet } from '../core/text.js'
import { checkQuote } from '../core/verify.js'
import { brandsForSection } from '../core/brands.js'
import { facetMasterVolume, facetPowerTubes } from '../core/models.js'
import { parseControlHints, parseKnobs, parseDirections, labelMap } from '../core/labels.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const APPENDIX_SECTIONS = ['VOX-type Amps', 'D-type Amps', 'Preamps', 'Fractal Forum Content']
export const NOTE_MAX = 220
export const CAB_NOTE_MAX = 200
export const SPEC_KEYS = {
  'Years of Manufacture': 'years',
  Circuit: 'circuit',
  Power: 'power',
  'Master Volume': 'master_volume',
  'Negative Feedback': 'negative_feedback',
  'Preamp Tubes': 'preamp_tubes',
  'Power Amp Tubes': 'power_tubes',
  'Tonestack Location': 'tonestack',
}
export const SAID_BY = [
  'yek', 'Yek', 'Cliff', 'Legendary Tones', 'Marshall', 'MESA', 'Manual', 'Alan Phillips', 'Fenderguru.com',
  'Fenderguru', 'Wikipedia', 'Orange', 'Bogner', 'Soldano', 'Fryette', 'Friedman', 'Diezel', 'Supro', 'Suhr',
  'Peavey', 'Komet', 'Ken Fischer', 'Dr. Z', 'Bob Bradshaw', 'Vintage Guitar', 'ToneQuest', 'The Gear Page',
  'Swart', 'Splawn', 'Premier Guitar', 'Trainwreck.com', 'Richard Hallebeek', 'Rob Navarette', 'Ultra Sound',
]
export const CONVENTIONS = [
  ['high-low-inputs', 'If the actual amp has two inputs, the model is based on the input with the highest gain.'],
  ['no-master-volume', 'If the original amp has no Master Volume control, the Master control in the amp model will default at 10.'],
  ['two-gain-controls', 'If the original amp has two gain controls, the one that’s closest to the 1/4” input on the actual amp will be represented by Input Drive in the amp model, and the other one by Overdrive.'],
  ['single-tone-control', 'If the original amp only has a single Tone control, the control will be mapped to either Treble or Presence/Hi Cut in the amp model.'],
  ['taper-match', 'The controls of the virtual amp models, such as Drive, Bass, Treble etc. match the tapers on the original amps within 10%, except for Master, Presence/Hi Cut and Depth.'],
  ['soft-reset', 'A soft reset is performed by de-selecting and re-selecting the amp type in the Amp block. This resets most parameters, including Presence and Master, but leaves the Drive controls and Bass/Mid/Treble untouched.'],
]

export function slug(name) {
  return name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\+/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function build({ pages, sections, curation, log = () => {} }) {
  const fails = []
  const stats = { cut_dropped: 0, cut_shrunk: 0, box_split: 0 }

  const verified = (quote, page, opts) => checkQuote({ quote, page }, pages, opts).ok
  const findPage = (quote, start, end, opts) => {
    for (let p = start; p <= end; p++) if (verified(quote, p, opts)) return p
    return null
  }
  // API.md §4.2: split at box breaks, cut attributions into said_by; pieces only get shorter and must still verify.
  const CARD_LABEL = /^(?:Synopsis|Tips|Clips|Sound Clips|Cabinet\/speaker|Stock cabs|Web, Manual|Amp controls|More videos, clips and comments)(?![A-Za-z])/
  const titles = makeTitleSet(sections.map((s) => s.title).concat(['Fender Circuits', 'Amplifier Information']))
  const boxClean = (quote, page, min = 12, max = 320) => {
    const out = []
    for (const piece of splitAtBoxBreaks(quote, pages.get(page), titles)) {
      if (CARD_LABEL.test(piece)) continue
      const cut = cutAttribution(piece, SAID_BY)
      const q = cleanCut(cut.quote)
      if (q.length < min || q.length > max || !verified(q, page) || spansBoxBreak(q, pages.get(page), titles)) continue
      out.push({ quote: q, said_by: cut.said_by === 'Yek' ? 'yek' : cut.said_by })
    }
    return out
  }
  const firstClean = (r) => {
    if (!r) return null
    const [c] = boxClean(r.quote, r.page)
    if (!c) { stats.cut_dropped++; log(`box split left nothing: p. ${r.page} "${r.quote.slice(0, 50)}"`); return null }
    if (c.quote !== r.quote) { stats.box_split++; log(`box split p. ${r.page}: "${r.quote.slice(0, 50)}" → "${c.quote.slice(0, 50)}"`) }
    return { quote: c.quote, page: r.page }
  }

  // ---------- sections → model skeletons ----------
  const all = sections.map((s, i) => ({ ...s, end: (sections[i + 1]?.page ?? PDF_PAGES + 1) - 1 }))
  const modelSecs = all.filter((s) => !APPENDIX_SECTIONS.includes(s.title))

  // ---------- table of contents (pp. 2–7) ----------
  const toc = []
  let inAmps = false
  for (let p = 2; p <= 7; p++) {
    for (const line of pages.get(p).split('\n')) {
      const m = /^(.*?)\s*\.{2,}\s*(\d+)\s*$/.exec(line) || /^(.*?[^.\d\s])\s*(\d+)$/.exec(line)
      if (!m) continue
      const text = normText(m[1].replace(/\.+$/, ''))
      if (text === 'The Amps') { inAmps = true; continue }
      if (text === 'Amp Categories') inAmps = false
      if (!inAmps) continue
      toc.push({ text, printed: Number(m[2]), page: p })
    }
  }
  const titleSet = new Set(modelSecs.map((s) => s.title))
  // Attach sub-entries to the model whose pages hold their printed page + 1.
  const tocSubs = new Map() // section index → [{ text, page }]
  let lastTitle = null
  for (const e of toc) {
    if (titleSet.has(e.text)) { lastTitle = e.text; continue }
    const pdf = e.printed + 1
    const owner = modelSecs.findIndex((s) => s.title === lastTitle && pdf >= s.page && pdf <= s.end)
    const idx = owner >= 0 ? owner : modelSecs.findIndex((s) => s.title === lastTitle)
    if (idx < 0) { fails.push(`TOC entry with no section: ${e.text}`); continue }
    if (!tocSubs.has(idx)) tocSubs.set(idx, [])
    tocSubs.get(idx).push(e)
  }

  const nameOf = (s, i) => {
    const base = s.title.split(' (')[0]
    const dup = modelSecs.filter((x) => x.title.split(' (')[0] === base).length > 1
    if (!dup) return { name: base, fromToc: false }
    const sub = (tocSubs.get(i) || [])[0]
    if (!sub) { fails.push(`duplicate name without a TOC sub-entry: ${s.title}`); return { name: base, fromToc: false } }
    return { name: sub.text, fromToc: true }
  }
  const basedOn = (title) => {
    const i = title.indexOf(' (')
    if (i < 0 || !title.endsWith(')')) return null
    return title.slice(i + 2, -1)
  }

  const skel = modelSecs.map((s, i) => {
    const { name, fromToc } = nameOf(s, i)
    const start = pageText(pages, s.page)
    const isStub = /Please refer to the section on the /.test(start) && s.end === s.page
    return { s, i, name, fromToc, id: slug(name), isStub }
  })
  const ids = new Set()
  for (const k of skel) {
    if (ids.has(k.id)) fails.push(`duplicate id ${k.id}`)
    ids.add(k.id)
  }

  // ---------- unit names ----------
  const unitNames = new Map(skel.map((k) => [k.id, []]))
  const addName = (id, name, evidence, page, tier) => {
    if (evidence.length < 3 || !verified(evidence, page, { minLength: 3, sentences: false })) {
      fails.push(`unit name evidence not on p. ${page}: ${evidence} (${id})`)
      return
    }
    unitNames.get(id).push({ name, evidence, page, tier })
  }
  const titleNameParts = (k) => {
    if (k.fromToc) return []
    if (curation.title_names?.[k.id]) return curation.title_names[k.id]
    if (/\bmodels?$/i.test(k.name)) return []
    return k.name.split(/\s*,\s*|\s+and\s+|\s+\/\s+/).filter(Boolean)
  }
  for (const k of skel) {
    for (const part of titleNameParts(k)) {
      if (!k.s.title.includes(part)) fails.push(`title name not in title: ${part} (${k.id})`)
      addName(k.id, part, part, k.s.page, 0)
    }
  }
  const pointerIn = (k, name) => {
    for (let p = k.s.page; p <= k.s.end; p++) if (pageText(pages, p).includes(`${name} See `)) return true
    return false
  }
  for (const k of skel) {
    for (const e of tocSubs.get(k.i) || []) {
      const name = e.text.split(/: | \(/)[0]
      if (pointerIn(k, name)) { log(`TOC pointer skipped: ${name} in ${k.id}`); continue }
      const expand = curation.toc_expand?.[name]
      if (expand) {
        const parts = name.split('/')
        const firstWords = parts[0].split(' ')
        addName(k.id, parts[0], name, e.page, 1)
        for (const later of parts.slice(1)) addName(k.id, [...firstWords.slice(0, -expand), later].join(' '), name, e.page, 1)
      } else {
        addName(k.id, name, name, e.page, 1)
      }
    }
  }
  // Variant lists in the section body: "• NAME – description" where NAME starts with one of the model's names
  // (or, for "… models" sections, the name's first word). Channel labels like "Mode #34" or "OD1" don't.
  for (const k of skel) {
    if (k.isStub) continue
    const prefixes = new Set(unitNames.get(k.id).map((u) => u.name.toLowerCase()))
    if (/\bmodels?$/i.test(k.name)) prefixes.add(k.name.split(' ')[0].toLowerCase())
    for (let p = k.s.page; p <= k.s.end; p++) {
      for (const line of pages.get(p).split('\n')) {
        const m = /^\s*[•\-]\s*([A-Z][^–:]{2,40}?)\s+[–:]\s/.exec(line)
        if (!m) continue
        const name = normText(m[1])
        const low = name.toLowerCase()
        if (![...prefixes].some((x) => low === x || low.startsWith(x + ' '))) continue
        addName(k.id, name, name, p, 0)
      }
    }
  }
  // Body names (curated): section-page spelling when on the model's pages, else lowest priority.
  for (const b of curation.body_names || []) {
    const k = skel.find((x) => x.id === b.model)
    if (!k) { fails.push(`body name for unknown model ${b.model}`); continue }
    const opts = { minLength: 3, sentences: false }
    let page = findPage(b.evidence, k.s.page, k.s.end, opts)
    let tier = 0
    if (!page) { page = findPage(b.evidence, 1, PDF_PAGES, opts); tier = 3 }
    if (!page) { fails.push(`body name not in the guide: ${b.evidence}`); continue }
    addName(k.id, b.evidence, b.evidence, page, tier)
  }
  // Appendix tables: the longest all-caps line suffix that starts with a known name.
  const known = []
  for (const k of skel) {
    for (const u of unitNames.get(k.id)) known.push([u.name.toLowerCase(), k.refers ? null : k])
  }
  for (const [prefix, id] of Object.entries(curation.appendix_aliases || {})) {
    if (prefix.startsWith('_')) continue
    known.push([prefix.toLowerCase(), skel.find((x) => x.id === id)])
  }
  const stubIds = new Set(skel.filter((k) => k.isStub).map((k) => k.id))
  for (let p = 295; p <= 298; p++) {
    for (const rawLine of pages.get(p).split('\n')) {
      const words = normText(rawLine).split(' ')
      let hit = null
      for (let w = 0; w < words.length && !hit; w++) {
        const suffix = words.slice(w).join(' ')
        if (/[a-z]/.test(suffix) || suffix.length < 3) continue
        const low = suffix.toLowerCase()
        const matches = known.filter(([n, k]) => k && (low === n || low.startsWith(n + ' ')))
        if (!matches.length) continue
        const best = matches.sort((a, b) => stubIds.has(a[1].id) - stubIds.has(b[1].id) || b[0].length - a[0].length)[0]
        hit = { suffix, k: best[1] }
      }
      if (hit) addName(hit.k.id, hit.suffix, hit.suffix, p, 2)
      else if (/^[A-Z0-9][A-Z0-9+\-]* [A-Z0-9 +\-]+$/.test(normText(rawLine))) {
        fails.push(`appendix name with no model: ${normText(rawLine)} (p. ${p})`)
      }
    }
  }
  const mergedUnitNames = (id) => {
    const list = [...unitNames.get(id)].sort((a, b) => a.tier - b.tier)
    const seen = new Set()
    const out = []
    for (const u of list) {
      const key = u.name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ name: u.name, evidence: u.evidence, page: u.page })
    }
    return out
  }

  // ---------- stubs ----------
  const refersTo = (k) => {
    const m = /Please refer to the section on the (.+?) models?\./.exec(pageText(pages, k.s.page))
    if (!m) return null
    const target = skel.find((x) => !x.isStub && x.name.toLowerCase().startsWith(m[1].toLowerCase()))
    if (!target) fails.push(`stub target not found: ${m[1]} (${k.id})`)
    return target?.id ?? null
  }

  // ---------- quote helpers ----------
  const saidBy = (quote, page) => {
    const t = pageText(pages, page)
    const at = t.indexOf(quote)
    if (at < 0) return null
    const names = SAID_BY.map(escapeRegex).join('|')
    const dash = new RegExp(`^\\s*– (${names})(?![A-Za-z])`)
    const norm = (n) => (n === 'Yek' ? 'yek' : n)
    const end = at + quote.length
    let closeAt = -1
    if (quote.endsWith('”')) closeAt = end
    else {
      let depth = 0
      for (let i = end; i < Math.min(t.length, end + 600); i++) {
        if (t[i] === '“') depth++
        else if (t[i] === '”') {
          if (depth === 0) { closeAt = i + 1; break }
          depth--
        }
      }
    }
    if (closeAt < 0) return null
    let opened = quote.startsWith('“')
    if (!opened) {
      let depth = 0
      for (let i = at - 1; i >= Math.max(0, at - 1200); i--) {
        if (t[i] === '”') depth++
        else if (t[i] === '“') {
          if (depth === 0) { opened = true; break }
          depth--
        }
      }
    }
    if (!opened) return null
    const m = dash.exec(t.slice(closeAt))
    return m ? norm(m[1]) : null
  }

  // Cut a card field at the next field's junk, then let verification prove the cut.
  const cutCard = (s, markers) => {
    let t = normText(s || '')
    for (const mk of markers) {
      const i = t.indexOf(mk)
      if (i >= 0) t = t.slice(0, i)
    }
    return t.trim()
  }
  const bestQuote = (text, k, what) => {
    const t = normText(text)
    if (!t) return null
    const tryQ = (q) => {
      const page = findPage(q, k.s.page, k.s.end)
      return page ? { quote: q, page } : null
    }
    const whole = tryQ(t)
    if (whole) return whole
    const sents = splitSentences(t)
    for (const cand of [sents.slice(0, 2).join(' '), sents[0]]) {
      const r = cand && tryQ(cand)
      if (r) { stats.cut_shrunk++; log(`${what} ${k.id}: kept first sentence(s)`); return r }
    }
    const words = (sents[0] || t).split(' ')
    for (let n = words.length - 1; n >= 2; n--) {
      const r = tryQ(words.slice(0, n).join(' ').replace(/[,;:–-]+$/, '').trim())
      if (r) { stats.cut_shrunk++; log(`${what} ${k.id}: shrunk to "${r.quote}"`); return r }
    }
    stats.cut_dropped++
    log(`${what} ${k.id}: dropped (no verified cut)`)
    return null
  }

  const controlsQuote = (k) => {
    const lines = pages.get(k.s.page).split('\n').map((l) => l.trim())
    const i = lines.findIndex((l) => l.startsWith('Amp controls '))
    if (i < 0) return null
    const parts = [lines[i].slice('Amp controls '.length)]
    for (let j = i + 1; j < lines.length; j++) {
      const prev = parts[parts.length - 1]
      const next = lines[j]
      if (!next || /^\d+$/.test(next)) break
      if (/[,\-]$|\band$|\bwith$/.test(prev) || /^[a-z(]/.test(next)) parts.push(next)
      else break
    }
    for (let n = parts.length; n >= 1; n--) {
      const q = normText(parts.slice(0, n).join(' '))
      const r = checkQuote({ quote: q, page: k.s.page }, pages)
      if (r.ok) {
        const card = normText(k.s.card?.['Amp controls'] || '')
        if (card && !card.startsWith(q)) log(`controls ${k.id}: raw line differs from card field`)
        return { quote: q, page: k.s.page }
      }
    }
    stats.cut_dropped++
    log(`controls ${k.id}: dropped`)
    return null
  }

  const settingsByModel = new Map()
  for (const st of curation.settings || []) {
    if (!settingsByModel.has(st.model)) settingsByModel.set(st.model, [])
    settingsByModel.get(st.model).push(st)
  }
  for (const id of settingsByModel.keys()) if (!ids.has(id)) fails.push(`settings for unknown model ${id}`)

  // ---------- models ----------
  const models = skel.map((k) => {
    const card = k.s.card || {}
    const refers_to = k.isStub ? refersTo(k) : null
    const joined = normText([...Array(k.s.end - k.s.page + 1)].map((_, j) => pageText(pages, k.s.page + j)).join(' '))
    const specs = {}
    for (const [src, key] of Object.entries(SPEC_KEYS)) {
      const v = k.s.specs?.[src]
      specs[key] = v != null && joined.includes(normText(v)) ? normText(v) : null
      if (v != null && specs[key] === null) log(`spec ${k.id}.${key}: not verbatim, null`)
    }
    const empty = { speaker: null, stock_cabs: null, notes: [] }
    const model = {
      id: k.id,
      section: k.s.title,
      name: k.name,
      based_on: basedOn(k.s.title),
      pages: { start: k.s.page, end: k.s.end },
      refers_to,
      unit_names: mergedUnitNames(k.id),
      brands: brandsForSection(k.s.title),
      specs,
      facets: { master_volume: facetMasterVolume(specs.master_volume), power_tubes: facetPowerTubes(specs.power_tubes) },
      synopsis: null,
      controls: null,
      tips: [],
      cab: empty,
      settings: [],
      directions: [],
      notes: [],
    }
    if (k.isStub) return model

    model.synopsis = card.Synopsis ? firstClean(bestQuote(cutCard(card.Synopsis, [' • ', ' Tips ', ' Clips ', ' More videos']), k, 'synopsis')) : null
    model.controls = firstClean(controlsQuote(k))
    const hints = parseControlHints(model.controls?.quote)

    // Tips: sentence by sentence.
    const tipText = cutCard(card.Tips, [' More videos, clips and comments', ' Clips ', ' Cabinet/speaker '])
    const tipSeen = new Set()
    for (const sen of tipText ? splitSentences(tipText) : []) {
      if (sen.length < 12) continue
      const page = sen.length <= 320 ? findPage(sen, k.s.page, k.s.end) : null
      if (!page) { stats.cut_dropped++; log(`tip ${k.id}: dropped "${sen.slice(0, 60)}…"`); continue }
      const pieces = boxClean(sen, page)
      if (pieces.length !== 1 || pieces[0].quote !== sen) { stats.box_split++; log(`tip ${k.id} p. ${page}: box split into ${pieces.length}`) }
      for (const pc of pieces) {
        if (tipSeen.has(pc.quote)) continue
        tipSeen.add(pc.quote)
        model.tips.push({ quote: pc.quote, page, said_by: pc.said_by ?? saidBy(pc.quote, page) })
      }
    }

    // Cab.
    const speaker = card['Cabinet/speaker'] ? firstClean(bestQuote(cutCard(card['Cabinet/speaker'], [' Web, Manual', ' More videos, clips and comments']), k, 'speaker')) : null
    const stock = card['Stock cabs'] ? firstClean(bestQuote(cutCard(card['Stock cabs'], [' Web, Manual', ' More videos, clips and comments']), k, 'stock_cabs')) : null
    const stored = new Set([speaker?.quote, stock?.quote, model.synopsis?.quote, model.controls?.quote, ...model.tips.map((t) => t.quote)])
    const cabNotes = []
    const headerEnd = model.controls ? pageText(pages, k.s.page).indexOf(model.controls.quote) + model.controls.quote.length : 0
    for (let p = k.s.page; p <= k.s.end && cabNotes.length < 2; p++) {
      const t = pageText(pages, p)
      const body = p === k.s.page ? t.slice(headerEnd) : t
      for (const sen of splitSentences(body)) {
        if (cabNotes.length >= 2) break
        if (sen.length < 40 || sen.length > CAB_NOTE_MAX || stored.has(sen)) continue
        if (!/\b(cab|cabs|cabinet|cabinets|speaker|speakers)\b/i.test(sen)) continue
        if (/Cab Pack|Amplifier Specifications|Web, Manual|More videos|https?:/i.test(sen)) continue
        for (const pc of boxClean(sen, p, 40, CAB_NOTE_MAX)) {
          if (cabNotes.length >= 2 || stored.has(pc.quote)) continue
          if (!/\b(cab|cabs|cabinet|cabinets|speaker|speakers)\b/i.test(pc.quote)) continue
          cabNotes.push({ quote: pc.quote, page: p })
          stored.add(pc.quote)
        }
      }
    }
    model.cab = { speaker, stock_cabs: stock, notes: cabNotes }

    // Settings (curated), knobs parsed per rule 6.
    for (const st of settingsByModel.get(k.id) || []) {
      const r = checkQuote({ quote: st.quote, page: st.page }, pages)
      if (!r.ok) { fails.push(`settings quote ${r.reason} p. ${st.page} (${k.id}): ${st.quote}`); continue }
      if (st.page < k.s.page || st.page > k.s.end) { fails.push(`settings page outside model pages (${k.id})`); continue }
      if (spansBoxBreak(st.quote, pages.get(st.page), titles)) { fails.push(`settings quote spans a box break p. ${st.page} (${k.id})`); continue }
      if (st.context && !checkQuote({ quote: st.context, page: st.page }, pages).ok) fails.push(`settings context not on p. ${st.page}: ${st.context}`)
      for (const o of st.other || []) if (!st.quote.includes(o)) fails.push(`settings other fragment not in quote: ${o}`)
      const knobs = parseKnobs(st.quote, hints, st.other || [])
      if (!Object.keys(knobs).length) { fails.push(`settings with no knob (${k.id}): ${st.quote}`); continue }
      let unit = null
      if (st.unit_name) {
        unit = model.unit_names.find((u) => u.name.toLowerCase() === st.unit_name.toLowerCase())?.name ?? null
        if (!unit) fails.push(`settings unit_name ${st.unit_name} is not a unit name of ${k.id}`)
      }
      model.settings.push({
        quote: st.quote,
        page: st.page,
        said_by: saidBy(st.quote, st.page),
        context: st.context ?? null,
        unit_name: unit,
        knobs,
        other: st.other || [],
      })
    }

    // Directions from tips only (rule 7).
    const map = labelMap(hints)
    const dirSeen = new Set()
    for (const tip of model.tips) {
      for (const d of parseDirections(tip.quote, hints)) {
        if (dirSeen.has(d.knob)) continue
        const label = Object.keys(map).find((l) => map[l] === d.knob && new RegExp(`(?<![A-Za-z0-9])${escapeRegex(l)}(?![A-Za-z0-9])`, 'i').test(tip.quote))
        if (!label) continue
        dirSeen.add(d.knob)
        model.directions.push({ knob: d.knob, dir: d.dir, quote: tip.quote, page: tip.page })
      }
    }

    // Notes: attributed passages (“…” – Name) on the model's pages, yek and Cliff first, ≤ 5.
    const cands = []
    for (let p = k.s.page; p <= k.s.end; p++) {
      const t = pageText(pages, p)
      const re = new RegExp(`”\\s*– (${SAID_BY.map(escapeRegex).join('|')})(?![A-Za-z])`, 'g')
      let m
      while ((m = re.exec(t))) {
        let depth = 0
        let open = -1
        for (let i = m.index - 1; i >= Math.max(0, m.index - 2000); i--) {
          if (t[i] === '”') depth++
          else if (t[i] === '“') {
            if (depth === 0) { open = i; break }
            depth--
          }
        }
        if (open < 0) continue
        const passage = t.slice(open + 1, m.index).trim()
        // Short notes keep the quote budget low: one sentence ≤ 220 characters, or two when the first is tiny.
        const sents = splitSentences(passage)
        let q = null
        const two = sents.slice(0, 2).join(' ')
        for (const cand of [sents[0]?.length < 60 ? two : null, sents[0]]) {
          if (cand && cand.length >= 12 && cand.length <= NOTE_MAX && checkQuote({ quote: cand, page: p }, pages).ok) { q = cand; break }
        }
        if (q) q = boxClean(q, p, 12, NOTE_MAX)[0]?.quote ?? null
        if (!q || stored.has(q)) continue
        const who = m[1] === 'Yek' ? 'yek' : m[1]
        cands.push({ quote: q, page: p, said_by: who, rank: who === 'yek' || who === 'Cliff' ? 0 : 1, at: p * 1e6 + open })
        stored.add(q)
      }
    }
    cands.sort((a, b) => a.rank - b.rank || a.at - b.at)
    model.notes = cands.slice(0, 5).sort((a, b) => a.at - b.at).map(({ quote, page, said_by }) => ({ quote, page, said_by }))
    return model
  })

  const conventions = CONVENTIONS.map(([id, quote]) => {
    if (!verified(quote, 12)) fails.push(`convention ${id} not on p. 12`)
    return { id, quote, page: 12 }
  })

  if (fails.length) {
    const err = new Error(`build-models: ${fails.length} failure(s)\n  ` + fails.join('\n  '))
    err.fails = fails
    throw err
  }
  return { models, conventions, stats, toc }
}

export async function buildData(opts) {
  const { models, conventions, stats, toc } = build(opts)
  const data = {
    schema: 1,
    guide: {
      title: 'Yek\'s Guide to the Fractal Audio Amp Models',
      by: 'Alexander van Engelen (yek); compiled by simviz',
      revision: 'April 2017',
      firmware: 'Quantum 7.02',
      pdf_pages: PDF_PAGES,
      pages_sha256: await pagesSha256(opts.pages),
    },
    conventions,
    models,
  }
  return { data, stats, toc }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const verbose = process.argv.includes('--log')
  const curation = JSON.parse(readFileSync(join(root, 'data/curation.json'), 'utf8'))
  const lines = []
  try {
    const { data, stats } = await buildData({ pages: loadPages(), sections: loadSections(), curation, log: (s) => lines.push(s) })
    const out = join(root, 'data/models.json')
    writeFileSync(out, JSON.stringify(data, null, 2) + '\n')
    if (verbose) console.log(lines.join('\n'))
    const m = data.models
    console.log(
      `models.json: ${m.length} models, ${m.filter((x) => x.refers_to).length} stubs, ` +
        `${m.reduce((n, x) => n + x.unit_names.length, 0)} unit names, ${m.reduce((n, x) => n + x.settings.length, 0)} settings, ` +
        `${m.reduce((n, x) => n + x.directions.length, 0)} directions, ${m.reduce((n, x) => n + x.notes.length, 0)} notes, ` +
        `${m.reduce((n, x) => n + x.tips.length, 0)} tips; cuts shrunk ${stats.cut_shrunk}, dropped ${stats.cut_dropped}, box splits ${stats.box_split}`,
    )
  } catch (e) {
    if (verbose) console.error(lines.join('\n'))
    console.error(e.message)
    process.exit(1)
  }
}
