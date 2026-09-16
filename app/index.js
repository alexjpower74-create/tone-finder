// Ask screen (docs/API.md §8).
import { ask, getHealth } from './api.js'
import { binderButton, renderCard } from './card.js'
import { esc, renderShell } from './shell.js'
import { addPick, hasPick, removePick } from './store.js'

const EXAMPLES = [
  'Van Halen brown sound',
  'clean worship pad with sparkle',
  'the rhythm tone on Master of Puppets',
  'Robben Ford',
  'AC30 chime',
  'djent',
]
const NO_SUPPORT = "I can't point to the guide for that."
const GK_LABEL = 'General knowledge (AI) — not from the guide'

renderShell()

const form = document.getElementById('ask-form')
const input = document.getElementById('q')
const statusEl = document.getElementById('status')
const answerEl = document.getElementById('answer')
const aiLine = document.getElementById('ai-line')

let aiOn = true
let current = null
let seq = 0

document.getElementById('examples').innerHTML = EXAMPLES.map(
  (e) => `<button type="button" class="chip" data-example="${esc(e)}">${esc(e)}</button>`,
).join('')

document.getElementById('examples').addEventListener('click', (ev) => {
  const chip = ev.target.closest('[data-example]')
  if (!chip) return
  input.value = chip.dataset.example
  run(chip.dataset.example)
})

form.addEventListener('submit', (ev) => {
  ev.preventDefault()
  run(input.value)
})

const list = (words) => words.map(esc).join(', ')

function understoodHtml(u) {
  const lines = []
  if (u.matched_terms.length) lines.push(`<span>Found in the guide: <strong>${list(u.matched_terms)}</strong></span>`)
  if (u.unmatched_terms.length) lines.push(`<span>Not in the guide: <strong>${list(u.unmatched_terms)}</strong></span>`)
  if (u.ai_terms?.length) lines.push(`<span>Words the AI added: <strong>${list(u.ai_terms)}</strong></span>`)
  return lines.length ? `<p class="understood" data-testid="understood">${lines.join('<br>')}</p>` : ''
}

// "Brown Sound Deluxe: not an Axe-Fx II model in the guide", "USA IIC+: quote not on page 12".
// detail is "<unit name>, p. <n>", or just the name (API.md §5.5); the older "<name>: page <n>" still reads.
export function dropText({ kind, detail }) {
  const m = String(detail).match(/^(.*?)(?:,\s*p\.\s*|:\s*page\s+)(\d+)$/i)
  const name = m ? m[1] : detail
  const page = m ? m[2] : null
  switch (kind) {
    case 'unknown_model':
      return `${name}: not an Axe-Fx II model in the guide`
    case 'bad_page':
      return page ? `${name}: page ${page} isn't in that model's section` : `${name}: page isn't in that model's section`
    case 'quote_not_on_page':
      return page ? `${name}: quote not on page ${page}` : `${name}: quote not on the page`
    case 'quote_too_long':
      return page ? `${name}: quote on page ${page} too long to check` : `${name}: quote too long to check`
    case 'no_verified_quote':
      return `${name}: no quote we could check`
    default:
      return `${detail}: ${kind}`
  }
}

function aresHtml(ares) {
  if (!ares) return ''
  return `<div class="ares-line" data-testid="ares-line">
    <p>${esc(ares.note)}</p>
    <details data-testid="ares-sources">
      <summary>Sources</summary>
      <ul class="detail-list">${ares.sources
        .map(
          (
            s,
          ) => `<li><blockquote class="quote quote-small" data-testid="source-quote"><p class="quote-text">${esc(s.quote)}</p></blockquote>
            <a class="src-link" href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.url)}</a>
            <span class="small">fetched ${esc(s.fetched)}</span></li>`,
        )
        .join('')}</ul>
    </details>
  </div>`
}

function renderAnswer(a) {
  const parts = []
  if (a.status !== 'ok') {
    parts.push(`<section class="glass panel no-support" data-testid="no-support">
      <h2>${esc(a.message || NO_SUPPORT)}</h2>
      ${understoodHtml(a.understood)}
      <p>Try an artist, an amp or a sound word, like “Plexi crunch”, “sparkly clean” or “Robben Ford”.</p>
    </section>`)
  } else {
    parts.push(understoodHtml(a.understood))
    if (a.general_knowledge.length) {
      parts.push(`<aside class="glass panel gk-box" data-testid="general-knowledge">
        <h2>${esc(a.general_knowledge[0].label || GK_LABEL)}</h2>
        <ul>${a.general_knowledge.map((g) => `<li>${esc(g.text)}</li>`).join('')}</ul>
      </aside>`)
    }
  }
  const dropped = a.ai?.dropped ?? []
  if (dropped.length) {
    parts.push(`<details class="drops" data-testid="ai-drops">
      <summary>The AI suggested ${dropped.length} ${dropped.length === 1 ? 'thing' : 'things'} we couldn't find in the guide, so ${dropped.length === 1 ? "it's" : "they're"} not shown.</summary>
      <ul>${dropped.map((d) => `<li>${esc(dropText(d))}</li>`).join('')}</ul>
    </details>`)
  }
  if (a.suggestions.length) {
    parts.push(
      `<div class="results" data-testid="results">${a.suggestions
        .map((s) => renderCard(s, { query: a.query, saved: hasPick(a.query, s.model_id) }))
        .join('')}</div>`,
    )
  }
  parts.push(aresHtml(a.ares))
  answerEl.innerHTML = parts.join('')
}

// After a search, put focus on the results summary (or the no-support heading) and bring it into view, so on a
// phone the first card's name is on screen without a manual scroll.
function revealAnswer(a) {
  const target = a.status === 'ok' ? statusEl : answerEl.querySelector('.no-support h2')
  if (!target) return
  target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  const narrow = globalThis.matchMedia?.('(max-width: 600px)').matches
  target.scrollIntoView({ block: narrow ? 'start' : 'nearest' })
}

async function run(raw, { updateUrl = true } = {}) {
  const query = raw.trim()
  if (!query) {
    statusEl.innerHTML = '<span class="error">Type a tone first.</span>'
    return
  }
  if (query.length > 200) {
    statusEl.innerHTML = '<span class="error">Keep it under 200 characters.</span>'
    return
  }
  if (updateUrl) {
    const u = new URL(location.href)
    u.searchParams.set('q', query)
    history.replaceState(null, '', u)
  }
  const mine = ++seq
  statusEl.textContent = 'Looking in the guide…'
  answerEl.setAttribute('aria-busy', 'true')
  try {
    const a = await ask(query, aiOn)
    if (mine !== seq) return
    current = a
    renderAnswer(a)
    statusEl.textContent =
      a.status === 'ok' ? `${a.suggestions.length} starting ${a.suggestions.length === 1 ? 'point' : 'points'} for “${query}”.` : ''
    revealAnswer(a)
  } catch (e) {
    if (mine !== seq) return
    current = null
    answerEl.innerHTML = ''
    statusEl.innerHTML = `<span class="error">${esc(e.message)}</span>`
  } finally {
    if (mine === seq) answerEl.removeAttribute('aria-busy')
  }
}

answerEl.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-action="binder"]')
  if (!btn || !current) return
  const s = current.suggestions.find((x) => x.model_id === btn.dataset.modelId)
  if (!s) return
  let saved
  if (hasPick(current.query, s.model_id)) {
    removePick(current.query, s.model_id)
    saved = false
  } else if (addPick(current.query, s)) {
    saved = true
  } else {
    statusEl.innerHTML = `<span class="error">Couldn't save: this browser isn't letting Tone Finder store anything.</span>`
    return
  }
  btn.innerHTML = binderButton(saved)
  btn.setAttribute('aria-pressed', String(saved))
  btn.classList.toggle('is-saved', saved)
  statusEl.textContent = saved ? `Added ${s.unit_name} to the binder.` : `Removed ${s.unit_name} from the binder.`
})

async function loadAiLine() {
  let health = null
  try {
    health = await getHealth()
  } catch {
    health = null
  }
  const ai = health?.ai
  if (!ai?.configured) {
    aiOn = false
    aiLine.innerHTML = '<span data-testid="ai-status">AI help: off</span>'
    return
  }
  const used = `CA$${Number(ai.spent_cad).toFixed(2)} of CA$${Number(ai.cap_cad).toFixed(2)} used`
  const draw = () => {
    aiLine.innerHTML = `<span data-testid="ai-status">AI help: ${aiOn ? 'on' : 'off'} · ${used}</span>
      <label class="switch"><input type="checkbox" role="switch" id="ai-switch" ${aiOn ? 'checked' : ''}><span>Use AI help</span></label>`
    document.getElementById('ai-switch').addEventListener('change', (ev) => {
      aiOn = ev.target.checked
      draw()
      if (current) run(current.query, { updateUrl: false })
    })
  }
  draw()
}

const initial = new URLSearchParams(location.search).get('q')
loadAiLine().then(() => {
  if (initial) {
    input.value = initial
    run(initial, { updateUrl: false })
  }
})
