// Round 4 quote-shape checks shared by the models, box-break and golden tests (API.md §4.2).
import { normText } from '../text.js'

// → problem string or null. `raw` is the raw page text, `titles` a Set of section titles.
export function quoteShapeProblem(quote, raw, titles) {
  if (quote.startsWith('•')) return 'starts with a bullet'
  if (/^[–-]\s/.test(quote)) return 'starts with an attribution dash'
  const lines = String(raw)
    .split('\n')
    .filter((l) => l.trim())
  const text = normText(raw)
  const header = normText(lines[0] ?? '')
  if (
    titles.has(header) &&
    text.startsWith(header + ' ') &&
    quote.startsWith(header + ' ') &&
    text.startsWith(quote.slice(0, header.length + 1))
  ) {
    return `starts with the running header "${header}"`
  }
  const footer = lines[lines.length - 1]?.trim() ?? ''
  if (/^\d+$/.test(footer) && quote.endsWith(' ' + footer) && text.endsWith(quote)) return `ends with the page number ${footer}`
  return null
}
