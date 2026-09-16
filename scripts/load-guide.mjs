#!/usr/bin/env node
// npm run load-guide: post the guide's 301 pages from TF_GUIDE_DIR to the local Worker (docs/API.md §2, §6).
// Reads worker/.dev.vars; real environment variables override it. Prints pages + SHA only, never page text.
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { homedir } from 'node:os'
import { parsePages, pagesSha256, PDF_PAGES } from '../core/guide.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export function readDevVars(path = join(root, 'worker/.dev.vars')) {
  const vars = {}
  if (!existsSync(path)) return vars
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && !line.trim().startsWith('#')) vars[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
  return vars
}

export function config(env = process.env) {
  const dev = readDevVars()
  const pick = (k, d) => (env[k] !== undefined && env[k] !== '' ? env[k] : dev[k] !== undefined && dev[k] !== '' ? dev[k] : d)
  return {
    url: pick('TF_WORKER_URL', 'http://127.0.0.1:8302').replace(/\/+$/, ''),
    token: pick('ADMIN_TOKEN', ''),
    dir: pick('TF_GUIDE_DIR', join(homedir(), 'Claude/Reference/Yek Fractal Amp Guide')),
  }
}

export async function loadGuide({ url, token, dir } = config()) {
  const file = join(dir, 'yek-guide-fulltext.txt')
  if (!existsSync(file)) throw new Error(`guide not found at ${file}`)
  if (!token) throw new Error('ADMIN_TOKEN is not set (worker/.dev.vars or the environment)')
  const pages = parsePages(readFileSync(file, 'utf8'))
  if (pages.size !== PDF_PAGES) throw new Error(`expected ${PDF_PAGES} pages, found ${pages.size}`)
  const sha = await pagesSha256(pages)
  const body = JSON.stringify({ pages_sha256: sha, pages: [...pages.entries()].sort((a, b) => a[0] - b[0]) })
  let res
  try {
    res = await fetch(`${url}/api/admin/guide`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body })
  } catch {
    throw new Error(`could not reach the Worker at ${url} (is it running?)`)
  }
  let json = {}
  try {
    json = await res.json()
  } catch {}
  // Only the status and error code/message: never the request body.
  if (!res.ok) throw new Error(`Worker refused the guide: HTTP ${res.status} ${json.error || ''} ${json.message || ''}`.trim())
  return { pages: json.pages, sha }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = config()
  try {
    const r = await loadGuide(cfg)
    console.log(`Loaded ${r.pages} pages into ${cfg.url} (sha256 ${r.sha})`)
  } catch (e) {
    console.error(`load-guide: ${e.message}`)
    process.exit(1)
  }
}
