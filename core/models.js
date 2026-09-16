// data/models.json helpers: load, resolve stubs, unit-name lookup, facets, filters (docs/API.md §3, §6).

import { titleSet } from './text.js'

// Section titles (running page headers) for box breaks. The appendix pages' own headers are added by name.
export const APPENDIX_HEADERS = [
  'VOX-type Amps',
  'D-type Amps',
  'Preamps',
  'Fractal Forum Content',
  'Fender Circuits',
  'Amplifier Information',
]
const titleCache = new WeakMap()
export function sectionTitles(data) {
  if (!titleCache.has(data)) titleCache.set(data, titleSet([...data.models.map((m) => m.section), ...APPENDIX_HEADERS]))
  return titleCache.get(data)
}

export const POWER_TUBES = ['EL34', 'EL84', '6L6', '6V6', 'KT88', 'KT66', '6550', '6973']
const TUBE_ALIASES = { '6L6GC': '6L6', 5881: '6L6', '6AQ5': 'EL84' }
export const MV_VALUES = ['yes', 'no', 'mixed', 'unknown']

export function facetMasterVolume(spec) {
  if (spec == null) return 'unknown'
  const words = String(spec)
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Za-z]/g, ''))
    .filter((t) => t === 'Yes' || t === 'No')
  if (!words.length) return 'unknown'
  if (words.every((t) => t === 'Yes')) return 'yes'
  if (words.every((t) => t === 'No')) return 'no'
  return 'mixed'
}

export function facetPowerTubes(spec) {
  if (spec == null) return []
  const found = new Set()
  for (const raw of String(spec)
    .toUpperCase()
    .split(/[^A-Z0-9]+/)) {
    const t = TUBE_ALIASES[raw] || raw
    if (POWER_TUBES.includes(t)) found.add(t)
  }
  return POWER_TUBES.filter((t) => found.has(t))
}

// Index a parsed models.json once. Cheap enough to call per request, but callers should keep it.
const indexCache = new WeakMap()
export function indexModels(data) {
  let idx = indexCache.get(data)
  if (idx) return idx
  const byId = new Map(data.models.map((m) => [m.id, m]))
  const stubsOf = new Map()
  for (const m of data.models) {
    if (m.refers_to) {
      if (!stubsOf.has(m.refers_to)) stubsOf.set(m.refers_to, [])
      stubsOf.get(m.refers_to).push(m)
    }
  }
  // lowercased unit name → Set of resolved model ids
  const unitNames = new Map()
  for (const m of data.models) {
    const target = m.refers_to || m.id
    for (const u of m.unit_names) {
      const k = u.name.toLowerCase()
      if (!unitNames.has(k)) unitNames.set(k, new Set())
      unitNames.get(k).add(target)
    }
  }
  idx = { byId, stubsOf, unitNames, suggestable: data.models.filter((m) => !m.refers_to) }
  indexCache.set(data, idx)
  return idx
}

export function resolveId(data, id) {
  const m = indexModels(data).byId.get(id)
  if (!m) return null
  return m.refers_to || m.id
}

// A model with its stubs' unit names folded in (stubs themselves resolve to their target).
export function resolvedModel(data, id) {
  const idx = indexModels(data)
  const targetId = resolveId(data, id)
  if (!targetId) return null
  const target = idx.byId.get(targetId)
  const stubs = idx.stubsOf.get(targetId) || []
  if (!stubs.length) return target
  const seen = new Set(target.unit_names.map((u) => u.name.toLowerCase()))
  const extra = []
  for (const s of stubs) {
    for (const u of s.unit_names) {
      if (!seen.has(u.name.toLowerCase())) {
        seen.add(u.name.toLowerCase())
        extra.push(u)
      }
    }
  }
  return { ...target, unit_names: [...target.unit_names, ...extra], merged_stubs: stubs.map((s) => s.id) }
}

// → array of resolved model ids that carry this unit name (case-insensitive).
export function modelsForUnitName(data, name) {
  const set = indexModels(data).unitNames.get(String(name).toLowerCase())
  return set ? [...set] : []
}

export function isUnitName(data, name) {
  return modelsForUnitName(data, name).length > 0
}

// The model's own spelling of `name` if it is one of its (resolved) unit names, else null.
export function unitNameOf(data, modelId, name) {
  const m = resolvedModel(data, modelId)
  if (!m || typeof name !== 'string') return null
  const u = m.unit_names.find((x) => x.name.toLowerCase() === name.toLowerCase())
  return u ? u.name : null
}

export function convention(data, id) {
  return data.conventions.find((c) => c.id === id) || null
}

export function summary(m) {
  return {
    id: m.id,
    name: m.name,
    section: m.section,
    based_on: m.based_on,
    brands: m.brands,
    unit_names: m.unit_names.map((u) => u.name),
    pages: m.pages,
    facets: m.facets,
    refers_to: m.refers_to,
    synopsis: m.synopsis,
  }
}

function countBy(models, valuesOf, order) {
  const counts = new Map()
  for (const m of models) for (const v of valuesOf(m)) counts.set(v, (counts.get(v) || 0) + 1)
  const keys = [...counts.keys()]
  if (order) keys.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  else keys.sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b))
  return keys.map((value) => ({ value, count: counts.get(value) }))
}

export function facetCounts(data) {
  return {
    brands: countBy(data.models, (m) => m.brands),
    power_tubes: countBy(data.models, (m) => m.facets.power_tubes, POWER_TUBES),
    master_volume: countBy(data.models, (m) => [m.facets.master_volume], MV_VALUES),
  }
}

// GET /api/models filters, combined with AND. Empty / missing filters are ignored.
export function filterModels(data, { brand, tube, mv, q } = {}) {
  const needle = q ? String(q).trim().toLowerCase() : ''
  return data.models.filter((m) => {
    if (brand && !m.brands.some((b) => b.toLowerCase() === String(brand).toLowerCase())) return false
    if (tube && !m.facets.power_tubes.some((t) => t.toLowerCase() === String(tube).toLowerCase())) return false
    if (mv && m.facets.master_volume !== String(mv).toLowerCase()) return false
    if (needle) {
      const hay = [m.name, m.based_on || '', ...m.unit_names.map((u) => u.name)].join('\n').toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}
