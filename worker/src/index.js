// Tone Finder Worker (docs/API.md §6, §7). Local only: `wrangler dev --local`.
import models from '../../data/models.json'
import { pagesSha256, PDF_PAGES } from '../../core/guide.js'
import { summary, filterModels, facetCounts, indexModels } from '../../core/models.js'
import { aiAnswer } from '../../core/ai.js'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-max-age': '86400',
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } })
}
const error = (status, code, message) => json(status, { error: code, message })

const num = (v, d) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

// Guide pages from D1, cached per isolate and keyed by the stored SHA so a reload is picked up.
let guideCache = { sha: null, pages: null }

async function guideState(env) {
  const meta = await env.DB.prepare("SELECT value FROM guide_meta WHERE key = 'pages_sha256'").first()
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM guide_pages').first()
  const sha = meta?.value ?? null
  const shaOk = sha !== null && sha === models.guide.pages_sha256
  const loaded = n === PDF_PAGES && shaOk
  return { sha, count: n, shaOk, loaded }
}

async function loadPages(env) {
  const st = await guideState(env)
  if (!st.loaded) return null
  if (guideCache.sha === st.sha && guideCache.pages) return guideCache.pages
  const { results } = await env.DB.prepare('SELECT page, text FROM guide_pages ORDER BY page').all()
  const pages = new Map(results.map((r) => [r.page, r.text]))
  guideCache = { sha: st.sha, pages }
  return pages
}

function d1Store(env) {
  return {
    async spentCad() {
      const r = await env.DB.prepare('SELECT COALESCE(SUM(cad), 0) AS s FROM ai_calls').first()
      return num(r?.s, 0)
    },
    async recordCall(c) {
      await env.DB.prepare(
        'INSERT INTO ai_calls (at, model, step, input_tokens, cached_input_tokens, output_tokens, usd, cad, query_hash, ok) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(c.at, c.model, c.step, c.input_tokens, c.cached_input_tokens, c.output_tokens, c.usd, c.cad, c.query_hash, c.ok)
        .run()
    },
    async getCache(key) {
      const r = await env.DB.prepare('SELECT answer_json FROM answer_cache WHERE key = ?').bind(key).first()
      return r ? JSON.parse(r.answer_json) : null
    },
    async putCache(key, answer) {
      await env.DB.prepare('INSERT OR REPLACE INTO answer_cache (key, at, answer_json) VALUES (?, ?, ?)')
        .bind(key, new Date().toISOString(), JSON.stringify(answer))
        .run()
    },
  }
}

// Constant-time-ish comparison; an unset ADMIN_TOKEN never authorises.
function authorised(request, env) {
  const want = env.ADMIN_TOKEN ? `Bearer ${env.ADMIN_TOKEN}` : null
  const got = request.headers.get('authorization') || ''
  if (!want || got.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i)
  return diff === 0
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

async function health(env) {
  const st = await guideState(env)
  const spend = await env.DB.prepare('SELECT COALESCE(SUM(cad), 0) AS s, COUNT(*) AS n FROM ai_calls').first()
  return json(200, {
    ok: true,
    models: models.models.length,
    guide: { loaded: st.loaded, pages: st.count, sha_ok: st.shaOk },
    ai: {
      configured: Boolean(env.OPENAI_API_KEY),
      model: env.AI_MODEL || 'gpt-5.4-mini',
      cap_cad: num(env.AI_CAP_CAD, 2),
      spent_cad: Math.round(num(spend?.s, 0) * 1e4) / 1e4,
      calls: num(spend?.n, 0),
    },
  })
}

function listModels(url) {
  const p = url.searchParams
  const filters = { brand: p.get('brand') || '', tube: p.get('tube') || '', mv: p.get('mv') || '', q: p.get('q') || '' }
  const rows = filterModels(models, filters)
  return json(200, { count: rows.length, total: models.models.length, models: rows.map(summary), facets: facetCounts(models) })
}

function oneModel(id) {
  const m = indexModels(models).byId.get(id)
  if (!m) return error(404, 'not_found', 'No model with that id.')
  return json(200, { model: m, conventions: models.conventions, guide: models.guide })
}

async function ask(request, env) {
  const body = await readJson(request)
  const query = typeof body?.query === 'string' ? body.query.trim() : ''
  if (query.length < 1 || query.length > 200) return error(400, 'bad_query', 'The query must be 1 to 200 characters.')
  const ai = body.ai === undefined ? true : body.ai === true
  const pages = await loadPages(env)
  const answer = await aiAnswer(query, { models, pages, env, ai, store: d1Store(env) })
  return json(200, answer)
}

async function adminGuide(request, env) {
  if (!authorised(request, env)) return error(401, 'unauthorized', 'Admin token required.')
  const body = await readJson(request)
  const list = body?.pages
  const seen = new Set()
  const ok =
    Array.isArray(list) &&
    list.length === PDF_PAGES &&
    list.every(
      (e) =>
        Array.isArray(e) &&
        e.length === 2 &&
        Number.isInteger(e[0]) &&
        e[0] >= 1 &&
        e[0] <= PDF_PAGES &&
        typeof e[1] === 'string' &&
        !seen.has(e[0]) &&
        seen.add(e[0]),
    )
  if (!ok) return error(400, 'bad_pages', `Send exactly pages 1-${PDF_PAGES} as [page, text] pairs.`)
  const pages = new Map(list)
  const sha = await pagesSha256(pages)
  if (sha !== body.pages_sha256 || sha !== models.guide.pages_sha256) {
    return error(409, 'sha_mismatch', 'The pages do not match the guide that models.json was built from.')
  }
  const stmts = [env.DB.prepare('DELETE FROM guide_pages')]
  const insert = env.DB.prepare('INSERT INTO guide_pages (page, text) VALUES (?, ?)')
  for (const [n, text] of list) stmts.push(insert.bind(n, text))
  const meta = env.DB.prepare('INSERT OR REPLACE INTO guide_meta (key, value) VALUES (?, ?)')
  stmts.push(meta.bind('pages_sha256', sha), meta.bind('loaded_at', new Date().toISOString()))
  await env.DB.batch(stmts)
  guideCache = { sha, pages }
  return json(200, { ok: true, pages: PDF_PAGES })
}

async function adminSpend(request, env) {
  if (!authorised(request, env)) return error(401, 'unauthorized', 'Admin token required.')
  const tot = await env.DB.prepare('SELECT COALESCE(SUM(cad), 0) AS cad, COALESCE(SUM(usd), 0) AS usd FROM ai_calls').first()
  const { results } = await env.DB.prepare('SELECT * FROM ai_calls ORDER BY id DESC LIMIT 50').all()
  return json(200, { cap_cad: num(env.AI_CAP_CAD, 2), spent_cad: num(tot?.cad, 0), spent_usd: num(tot?.usd, 0), calls: results })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'
    try {
      if (request.method === 'GET' && path === '/api/health') return await health(env)
      if (request.method === 'GET' && path === '/api/models') return listModels(url)
      if (request.method === 'GET' && path.startsWith('/api/models/')) {
        let id
        try {
          id = decodeURIComponent(path.slice('/api/models/'.length))
        } catch {
          return error(404, 'not_found', 'No model with that id.')
        }
        return oneModel(id)
      }
      if (request.method === 'POST' && path === '/api/ask') return await ask(request, env)
      if (request.method === 'POST' && path === '/api/admin/guide') return await adminGuide(request, env)
      if (request.method === 'GET' && path === '/api/admin/spend') return await adminSpend(request, env)
      return error(404, 'not_found', 'No such route.')
    } catch {
      // Never echo internals: they could hold request data.
      return error(500, 'internal', 'Something went wrong.')
    }
  },
}
