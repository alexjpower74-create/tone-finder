// How the app talks to the Worker (docs/API.md §1, §6).
// Base URL: <meta name="api-base">, overridden by ?api=<origin>. ?mock=1 swaps in api.mock.js (no network).
const params = new URLSearchParams(globalThis.location?.search ?? '')

export const MOCK = params.get('mock') === '1'

const CARRIED = ['mock', 'api']

function safeOrigin(value) {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null
  } catch {
    return null
  }
}

export function apiBase() {
  const override = params.get('api') && safeOrigin(params.get('api'))
  if (override) return override
  const meta = document.querySelector('meta[name="api-base"]')?.getAttribute('content')
  return (meta && safeOrigin(meta)) || 'http://127.0.0.1:8302'
}

// Internal links keep ?mock= and ?api= so a demo or a QA run never falls back to another backend.
export function carry(href) {
  const u = new URL(href, location.href)
  if (u.origin !== location.origin) return href
  for (const key of CARRIED) {
    const v = params.get(key)
    if (v !== null && !u.searchParams.has(key)) u.searchParams.set(key, v)
  }
  return u.pathname + u.search + u.hash
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code || `HTTP ${status}`)
    this.status = status
    this.code = code || 'error'
  }
}

let mockModule = null

async function request(method, path, body) {
  let status
  let json
  if (MOCK) {
    mockModule ??= import('./api.mock.js')
    ;({ status, json } = await (await mockModule).handle(method, path, body))
  } else {
    let res
    try {
      res = await fetch(apiBase() + path, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch {
      throw new ApiError(0, 'network', "Can't reach the Tone Finder service. Is the Worker running?")
    }
    status = res.status
    try {
      json = await res.json()
    } catch {
      json = null
    }
  }
  if (status < 200 || status >= 300) throw new ApiError(status, json?.error, json?.message)
  return json
}

export const getHealth = () => request('GET', '/api/health')

export function getModels(filters = {}) {
  const q = new URLSearchParams()
  for (const key of ['brand', 'tube', 'mv', 'q']) if (filters[key]) q.set(key, filters[key])
  const qs = q.toString()
  return request('GET', '/api/models' + (qs ? `?${qs}` : ''))
}

export const getModel = (id) => request('GET', `/api/models/${encodeURIComponent(id)}`)

export const ask = (query, ai = true) => request('POST', '/api/ask', { query, ai })
