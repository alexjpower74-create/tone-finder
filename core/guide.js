// Guide pages (docs/API.md §0, §2). Pure: the caller reads the file (Node) or D1 (Worker).
import { normText } from './text.js'

export const PDF_PAGES = 301
const MARKER = /^===== PAGE (\d+) =====$/

// fulltext → Map<page, raw page text>. Raw text is everything after the marker line up to the next
// marker line (the line breaks around the markers are not part of either page).
export function parsePages(fulltext) {
  const pages = new Map()
  const lines = String(fulltext).split('\n')
  let current = null
  let buf = []
  const flush = () => {
    if (current !== null) pages.set(current, buf.join('\n'))
  }
  for (const line of lines) {
    const m = MARKER.exec(line.replace(/\r$/, ''))
    if (m) {
      flush()
      current = Number(m[1])
      buf = []
    } else if (current !== null) {
      buf.push(line)
    }
  }
  flush()
  return pages
}

// Accepts a Map<number,string> or an array of [n, raw] pairs.
export function toPageMap(pages) {
  if (pages instanceof Map) return pages
  if (Array.isArray(pages)) return new Map(pages.map(([n, t]) => [Number(n), String(t)]))
  throw new TypeError('pages must be a Map or an array of [page, text] pairs')
}

const normCache = new WeakMap()

export function pageText(pages, n) {
  if (!pages || !Number.isInteger(n)) return null
  let cache = normCache.get(pages)
  if (!cache) {
    cache = new Map()
    normCache.set(pages, cache)
  }
  if (cache.has(n)) return cache.get(n)
  const raw = pages.get(n)
  const t = raw === undefined ? null : normText(raw)
  cache.set(n, t)
  return t
}

export function pagesSha256Input(pages) {
  const arr = []
  for (let n = 1; n <= PDF_PAGES; n++) arr.push([n, pages.get(n) ?? ''])
  return JSON.stringify(arr)
}

// SHA-256 hex via WebCrypto (Node ≥ 20 and workerd both have globalThis.crypto.subtle).
export async function sha256Hex(s) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function pagesSha256(pages) {
  return sha256Hex(pagesSha256Input(pages))
}
