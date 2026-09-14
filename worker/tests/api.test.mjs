// HTTP API against a local Worker started by tests/run.mjs (docs/API.md §6). Tests run in file order.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadPages, loadGuideText } from '../../core/tests/guide-node.mjs'
import { pagesSha256, pageText } from '../../core/guide.js'
import { checkQuote } from '../../core/verify.js'
import { isUnitName, unitNameOf } from '../../core/models.js'

const W = process.env.TF_WORKER_URL || 'http://127.0.0.1:8302'
const CAP = process.env.TF_WORKER_CAP_URL
const FAKE = process.env.TF_FAKE_AI_URL || 'http://127.0.0.1:8303'
const TOKEN = process.env.TF_ADMIN_TOKEN || 'test-admin-token'
const models = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/models.json', import.meta.url)), 'utf8'))
const pages = loadPages()
const allPages = [...pages.entries()].sort((a, b) => a[0] - b[0])
const answers = []
const responses = []

async function call(method, path, { body, token, base = W, raw = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`
  const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) })
  const text = await r.text()
  responses.push(text)
  let json = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: r.status, headers: r.headers, json }
}
const ask = async (query, extra = {}, base = W) => {
  const r = await call('POST', '/api/ask', { body: { query, ...extra }, base })
  if (r.status === 200) answers.push(r.json)
  return r
}
const fakeCount = async () => (await (await fetch(`${FAKE}/count`)).json()).count

async function loadGuide(base) {
  const sha = await pagesSha256(pages)
  return call('POST', '/api/admin/guide', { body: { pages_sha256: sha, pages: allPages }, token: TOKEN, base })
}

test('health before the guide is loaded', async () => {
  const r = await call('GET', '/api/health')
  assert.equal(r.status, 200)
  assert.equal(r.json.ok, true)
  assert.equal(r.json.models, 109)
  assert.deepEqual(r.json.guide, { loaded: false, pages: 0, sha_ok: false })
  assert.equal(r.json.ai.configured, true)
  assert.equal(r.json.ai.model, 'gpt-5.4-mini')
})

test('before load, ask still answers from stored quotes and AI is unavailable', async () => {
  const r = await ask('Van Halen brown sound')
  assert.equal(r.status, 200)
  assert.equal(r.json.status, 'ok')
  assert.equal(r.json.ai.reason, 'guide_not_loaded')
  assert.equal(await fakeCount(), 0)
})

test('/api/admin/guide: 401 without or with a wrong token', async () => {
  const sha = await pagesSha256(pages)
  assert.equal((await call('POST', '/api/admin/guide', { body: { pages_sha256: sha, pages: allPages } })).status, 401)
  const wrong = await call('POST', '/api/admin/guide', { body: { pages_sha256: sha, pages: allPages }, token: 'nope' })
  assert.equal(wrong.status, 401)
  assert.equal(wrong.json.error, 'unauthorized')
  // Same length as the real token, one character different: only the comparison itself can refuse this.
  const sameLength = TOKEN.slice(0, -1) + (TOKEN.endsWith('X') ? 'Y' : 'X')
  assert.equal(sameLength.length, TOKEN.length)
  assert.equal((await call('POST', '/api/admin/guide', { body: { pages_sha256: sha, pages: allPages }, token: sameLength })).status, 401)
  assert.equal((await call('GET', '/api/admin/spend', { token: sameLength })).status, 401)
  assert.equal((await call('GET', '/api/admin/spend')).status, 401)
  assert.equal((await call('GET', '/api/health')).json.guide.loaded, false, 'nothing was loaded by the refused posts')
})

test('/api/admin/guide: 400 with 300 pages, 409 with one page altered', async () => {
  const sha = await pagesSha256(pages)
  const short = await call('POST', '/api/admin/guide', { body: { pages_sha256: sha, pages: allPages.slice(0, 300) }, token: TOKEN })
  assert.equal(short.status, 400)
  const altered = new Map(pages)
  altered.set(150, altered.get(150).replace('a', 'b'))
  assert.notEqual(altered.get(150), pages.get(150), 'control: the page really changed')
  const altSha = await pagesSha256(altered)
  const alt = [...altered.entries()].sort((a, b) => a[0] - b[0])
  const r1 = await call('POST', '/api/admin/guide', { body: { pages_sha256: altSha, pages: alt }, token: TOKEN })
  assert.equal(r1.status, 409)
  assert.equal(r1.json.error, 'sha_mismatch')
  const r2 = await call('POST', '/api/admin/guide', { body: { pages_sha256: sha, pages: alt }, token: TOKEN })
  assert.equal(r2.status, 409)
  assert.equal((await call('GET', '/api/health')).json.guide.loaded, false)
})

test('load the guide, then health says loaded and sha_ok', async () => {
  const r = await loadGuide(W)
  assert.equal(r.status, 200)
  assert.deepEqual(r.json, { ok: true, pages: 301 })
  const h = await call('GET', '/api/health')
  assert.deepEqual(h.json.guide, { loaded: true, pages: 301, sha_ok: true })
})

test('/api/models: total, filters and facets', async () => {
  const all = await call('GET', '/api/models')
  assert.equal(all.json.total, 109)
  assert.equal(all.json.count, 109)
  assert.equal(all.json.models.length, 109)
  assert.equal(all.json.facets.master_volume.reduce((n, f) => n + f.count, 0), 109)
  assert.deepEqual(Object.keys(all.json.models[0]).sort(), ['based_on', 'brands', 'facets', 'id', 'name', 'pages', 'refers_to', 'section', 'synopsis', 'unit_names'])
  const marshall = await call('GET', '/api/models?brand=Marshall')
  assert.ok(marshall.json.count > 0 && marshall.json.count < 109)
  assert.equal(marshall.json.total, 109)
  for (const m of marshall.json.models) assert.ok(m.brands.includes('Marshall'), m.id)
  assert.equal(marshall.json.count, models.models.filter((m) => m.brands.includes('Marshall')).length)
  const el84 = await call('GET', '/api/models?tube=EL84')
  assert.ok(el84.json.count > 0)
  for (const m of el84.json.models) assert.ok(m.facets.power_tubes.includes('EL84'))
  const mvNo = await call('GET', '/api/models?mv=no')
  assert.ok(mvNo.json.count > 0)
  for (const m of mvNo.json.models) assert.equal(m.facets.master_volume, 'no')
  const q = await call('GET', '/api/models?q=plexi')
  assert.ok(q.json.count > 0)
  for (const m of q.json.models) assert.ok([m.name, m.based_on || '', ...m.unit_names].join(' ').toLowerCase().includes('plexi'))
  const both = await call('GET', '/api/models?brand=Marshall&mv=no')
  assert.ok(both.json.models.every((m) => m.brands.includes('Marshall') && m.facets.master_volume === 'no'))
  assert.deepEqual(both.json.facets, all.json.facets, 'facet counts are over all 109')
})

test('/api/models/1959slp and a 404', async () => {
  const r = await call('GET', '/api/models/1959slp')
  assert.equal(r.status, 200)
  assert.equal(r.json.model.id, '1959slp')
  assert.equal(r.json.conventions.length, 6)
  assert.equal(r.json.guide.pages_sha256, models.guide.pages_sha256)
  const nf = await call('GET', '/api/models/no-such-model')
  assert.equal(nf.status, 404)
  assert.equal(nf.json.error, 'not_found')
})

test('ask "Van Halen brown sound": ok, every why quote verified against the real page', async () => {
  const r = await ask('Van Halen brown sound')
  assert.equal(r.json.status, 'ok')
  assert.ok(r.json.suggestions.length >= 1)
  for (const s of r.json.suggestions) {
    for (const w of s.why) {
      assert.ok(pageText(pages, w.page).includes(w.quote), `p. ${w.page}: ${w.quote}`)
      assert.ok(checkQuote(w, pages).ok)
    }
  }
})

test('ask "banjo through a toaster": no guide support', async () => {
  const r = await ask('banjo through a toaster', { ai: false })
  assert.equal(r.json.status, 'no_guide_support')
  assert.equal(r.json.message, "I can't point to the guide for that.")
  assert.deepEqual(r.json.suggestions, [])
})

test('ask: empty, blank, missing and 201-character queries are 400 bad_query; 200 characters is fine', async () => {
  for (const body of [{ query: '' }, { query: '   ' }, {}, { query: 'x'.repeat(201) }, { query: 42 }]) {
    const r = await call('POST', '/api/ask', { body })
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 40))
    assert.equal(r.json.error, 'bad_query')
  }
  assert.equal((await call('POST', '/api/ask', { body: 'not json', raw: true })).status, 400)
  assert.equal((await ask('a'.repeat(200), { ai: false })).status, 200)
})

test('fake-plant through HTTP: only the verified citation survives, drops listed', async () => {
  const r = await ask('Brown Sound Deluxe fake-plant')
  const a = r.json
  assert.equal(a.ai.used, true)
  assert.equal(a.suggestions[0].model_id, '1959slp')
  assert.equal(a.suggestions[0].source, 'ai_checked')
  assert.deepEqual(a.suggestions[0].why.map((w) => w.page), [28])
  assert.deepEqual(a.ai.dropped.map((d) => d.kind), ['unknown_model', 'bad_page', 'quote_not_on_page', 'unknown_model'])
  assert.ok(!a.suggestions.some((s) => s.unit_name === 'Brown Sound Deluxe'))
})

test('fake-puppets through HTTP: USA IIC+ checked by the AI, general knowledge labelled', async () => {
  const a = (await ask('the rhythm tone on Master of Puppets fake-puppets')).json
  assert.equal(a.status, 'ok')
  const s = a.suggestions.find((x) => x.model_id === 'usa-iic-plus-and-usa-iic-plus-plus')
  assert.equal(s.source, 'ai_checked')
  assert.equal(s.why[0].page, 270)
  assert.equal(a.general_knowledge[0].label, 'General knowledge (AI) — not from the guide')
})

test('a second identical AI ask is cached: fake count unchanged', async () => {
  const q = 'Joe Satriani lead fake-puppets'
  await ask(q)
  const before = await fakeCount()
  const r = await ask(q)
  assert.equal(await fakeCount(), before)
  assert.equal(r.json.ai.reason, 'cached')
  assert.equal(r.json.ai.cost_cad, 0)
  const spend = await call('GET', '/api/admin/spend', { token: TOKEN })
  assert.ok(spend.json.calls.length >= 4)
  assert.ok(spend.json.spent_cad > 0)
  const h = await call('GET', '/api/health')
  assert.equal(h.json.ai.calls, spend.json.calls.length)
})

test('spend cap: a Worker with a tiny AI_CAP_CAD makes no request', { skip: !CAP && 'TF_WORKER_CAP_URL not set' }, async () => {
  assert.equal((await loadGuide(CAP)).status, 200)
  const before = await fakeCount()
  const r = await ask('Robben Ford fake-plant', {}, CAP)
  assert.equal(r.json.ai.used, false)
  assert.equal(r.json.ai.reason, 'spend_cap')
  assert.equal(r.json.status, 'ok')
  assert.equal(await fakeCount(), before)
})

test('OPTIONS answered with CORS; JSON responses carry the header', async () => {
  const r = await fetch(`${W}/api/ask`, { method: 'OPTIONS', headers: { origin: 'http://127.0.0.1:8301', 'access-control-request-method': 'POST' } })
  assert.equal(r.status, 204)
  assert.equal(r.headers.get('access-control-allow-origin'), '*')
  assert.match(r.headers.get('access-control-allow-methods'), /POST/)
  for (const path of ['/api/health', '/api/models', '/api/models/nope']) {
    assert.equal((await fetch(W + path)).headers.get('access-control-allow-origin'), '*', path)
  }
})

test('every Answer names only unit names from models.json; the key never appears', () => {
  assert.ok(answers.length >= 8, `control: ${answers.length} answers collected`)
  for (const a of answers) {
    for (const s of a.suggestions) {
      assert.ok(isUnitName(models, s.unit_name), s.unit_name)
      assert.ok(unitNameOf(models, s.model_id, s.unit_name), `${s.unit_name} / ${s.model_id}`)
    }
  }
  for (const text of responses) assert.ok(!text.includes('test-key') && !text.includes(TOKEN))
  assert.ok(loadGuideText().length > 0)
})
