// The one quote check (docs/API.md §0). Used by the build, the engine, the AI step and the Worker.
import { normText, sentenceBreakCount } from './text.js'
import { pageText, PDF_PAGES } from './guide.js'

export const QUOTE_MIN = 12
export const QUOTE_MAX = 320

// → { ok: true } or { ok: false, reason } where reason is one of
//   "not_normalised" | "too_short" | "too_long" | "too_many_sentences" | "bad_page" | "not_on_page".
// Options (for unit-name evidence, §3 rule 3): { minLength, sentences: false }.
export function checkQuote(q, pages, opts = {}) {
  const quote = q?.quote
  const page = q?.page
  const min = opts.minLength ?? QUOTE_MIN
  if (typeof quote !== 'string' || quote !== normText(quote)) return { ok: false, reason: 'not_normalised' }
  if (quote.length < min) return { ok: false, reason: 'too_short' }
  if (quote.length > QUOTE_MAX) return { ok: false, reason: 'too_long' }
  if (opts.sentences !== false && sentenceBreakCount(quote) > 1) return { ok: false, reason: 'too_many_sentences' }
  if (!Number.isInteger(page) || page < 1 || page > PDF_PAGES) return { ok: false, reason: 'bad_page' }
  const text = pages ? pageText(pages, page) : null
  if (text === null || !text.includes(quote)) return { ok: false, reason: 'not_on_page' }
  return { ok: true }
}

export function verifyQuote(q, pages, opts) {
  return checkQuote(q, pages, opts).ok
}
