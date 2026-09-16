// Models browser (docs/API.md §8). Filters live in the URL: ?brand=&tube=&mv=&q=
import { carry, getModels } from './api.js'
import { esc, pageRange, renderShell } from './shell.js'

renderShell()

const TOP_BRANDS = 12
const MV_LABELS = { yes: 'Yes', no: 'No', mixed: 'Mixed', unknown: 'Unknown' }
const FILTERS = ['brand', 'tube', 'mv', 'q']

const params = new URLSearchParams(location.search)
const state = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? '']))

const nameInput = document.getElementById('name-filter')
const brandChips = document.getElementById('brand-chips')
const moreWrap = document.getElementById('more-brands-wrap')
const tubeChips = document.getElementById('tube-chips')
const mvChips = document.getElementById('mv-chips')
const showing = document.getElementById('showing')
const list = document.getElementById('model-list')

nameInput.value = state.q

let names = new Map() // id → name, for stub rows
let seq = 0

function syncUrl() {
  const u = new URL(location.href)
  for (const k of FILTERS) {
    if (state[k]) u.searchParams.set(k, state[k])
    else u.searchParams.delete(k)
  }
  history.replaceState(null, '', u)
}

const chip = (group, value, label, count) =>
  `<button type="button" class="chip" data-filter="${group}" data-value="${esc(value)}" aria-pressed="${state[group] === value}">${esc(label)}<span class="count">${count}</span></button>`

function renderFacets(facets) {
  const top = facets.brands.slice(0, TOP_BRANDS)
  const rest = facets.brands.slice(TOP_BRANDS)
  brandChips.innerHTML = top.map((b) => chip('brand', b.value, b.value, b.count)).join('')
  moreWrap.innerHTML = rest.length
    ? `<label class="visually-hidden" for="more-brands">More brands</label>
       <select id="more-brands" class="more-brands">
         <option value="">More brands</option>
         ${rest.map((b) => `<option value="${esc(b.value)}"${state.brand === b.value ? ' selected' : ''}>${esc(b.value)} (${b.count})</option>`).join('')}
       </select>`
    : ''
  tubeChips.innerHTML = facets.power_tubes.map((t) => chip('tube', t.value, t.value, t.count)).join('')
  mvChips.innerHTML = facets.master_volume.map((m) => chip('mv', m.value, MV_LABELS[m.value] ?? m.value, m.count)).join('')
}

function row(m) {
  if (m.refers_to) {
    const target = names.get(m.refers_to) ?? m.refers_to
    return `<li><a class="model-row glass stub" data-testid="model-row" data-stub="true" data-model-id="${esc(m.id)}"
        href="${esc(carry(`model.html?id=${encodeURIComponent(m.refers_to)}`))}">
      <div class="row-name">${esc(m.name)}</div>
      <div class="muted">See ${esc(target)}</div>
      <div class="row-meta">${m.brands.map((b) => `<span class="pill pill-brand" data-testid="brand-pill">${esc(b)}</span>`).join('')}<span>${pageRange(m.pages)}</span></div>
    </a></li>`
  }
  const tubes = m.facets.power_tubes.length ? m.facets.power_tubes.join(', ') : 'Tubes not in the guide'
  return `<li><a class="model-row glass" data-testid="model-row" data-model-id="${esc(m.id)}"
      href="${esc(carry(`model.html?id=${encodeURIComponent(m.id)}`))}">
    <div class="row-name">${esc(m.name)}</div>
    ${m.based_on ? `<div class="muted">${esc(m.based_on)}</div>` : ''}
    <div class="row-meta">
      ${m.brands.map((b) => `<span class="pill pill-brand" data-testid="brand-pill">${esc(b)}</span>`).join('')}
      <span>${esc(tubes)}</span>
      <span>Master volume: ${esc(MV_LABELS[m.facets.master_volume] ?? m.facets.master_volume)}</span>
      <span>${pageRange(m.pages)}</span>
    </div>
  </a></li>`
}

async function refresh() {
  const mine = ++seq
  syncUrl()
  try {
    const res = await getModels(state)
    if (mine !== seq) return
    renderFacets(res.facets)
    showing.textContent = `Showing ${res.count} of ${res.total}`
    list.innerHTML = res.models.length
      ? res.models.map(row).join('')
      : `<li class="glass panel">No models match those filters. <button type="button" class="btn" data-action="clear">Clear filters</button></li>`
  } catch (e) {
    if (mine !== seq) return
    showing.innerHTML = `<span class="error">${esc(e.message)}</span>`
    list.innerHTML = ''
  }
}

document.querySelector('.filters').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-filter]')
  if (!btn) return
  const { filter, value } = btn.dataset
  state[filter] = state[filter] === value ? '' : value
  refresh()
})

moreWrap.addEventListener('change', (ev) => {
  if (ev.target.id !== 'more-brands') return
  state.brand = ev.target.value
  refresh()
})

list.addEventListener('click', (ev) => {
  if (!ev.target.closest('[data-action="clear"]')) return
  for (const k of FILTERS) state[k] = ''
  nameInput.value = ''
  refresh()
})

let typing
nameInput.addEventListener('input', () => {
  clearTimeout(typing)
  typing = setTimeout(() => {
    state.q = nameInput.value.trim()
    refresh()
  }, 150)
})

;(async () => {
  try {
    const all = await getModels({})
    names = new Map(all.models.map((m) => [m.id, m.name]))
  } catch {
    // Stub rows fall back to the target id.
  }
  refresh()
})()
