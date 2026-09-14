// Text helpers shared by the build, the engine, the AI step and the Worker (docs/API.md §0, §4.1).
// Pure ESM, no dependencies.

// Every run of whitespace (space, tab, newline, U+00A0, …) → one space, then trim. Nothing else.
export function normText(s) {
  return String(s ?? '').replace(/[\s ]+/g, ' ').trim()
}

// The sentence-boundary regex from §0 rule 2. A fresh RegExp each call: /g regexes carry state.
export function sentenceBreakRegex() {
  return /[.!?][”"’)]*\s+(?=[A-Z“"‘(])/g
}

export function sentenceBreakCount(s) {
  return (String(s).match(sentenceBreakRegex()) || []).length
}

// Split normalised text into sentences on the §0 boundary. Each piece keeps its closing punctuation
// (and closing quote marks), so every piece is an exact substring of the input.
export function splitSentences(text) {
  const t = normText(text)
  const out = []
  const re = sentenceBreakRegex()
  let start = 0
  let m
  while ((m = re.exec(t))) {
    // The match is punctuation + closers + whitespace; the sentence ends before the whitespace.
    const endOfSentence = m.index + m[0].trimEnd().length
    const piece = t.slice(start, endOfSentence).trim()
    if (piece) out.push(piece)
    start = m.index + m[0].length
  }
  const tail = t.slice(start).trim()
  if (tail) out.push(tail)
  return out
}

// Box breaks (docs/API.md §4.2): the extraction glues separate boxes together. A new box starts on a raw line that
// begins (after spaces/tabs) with an opening “, an attribution dash, a bullet, or a card label.
const BOX_START = /^[ \t]*(?:“|[–-] [A-Z]|• |(?:Synopsis|Tips|Clips|Sound Clips|Cabinet\/speaker|Stock cabs|Web, Manual|Amp controls) |More videos, clips and comments)/

// → offsets in pageText (= normText(rawPage)) where a new box starts. Runs between breaks are normalised and
// joined with one space, which reproduces pageText exactly.
// Also (round 4): the break after the page's first raw line when it is a section title (the running header), and
// the break before the last non-empty raw line when it is only digits (the printed page number).
// `titles`: a Set from titleSet(); without it only the footer break is added.
export function titleSet(list) {
  return new Set([...list].map((t) => normText(t)))
}

export function boxBreaks(rawPage, titles = null) {
  const lines = String(rawPage ?? '').split('\n')
  const first = lines.findIndex((l) => l.trim())
  let last = -1
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim()) { last = i; break }
  const header = titles && first >= 0 && titles.has(normText(lines[first])) ? first + 1 : -1
  const footer = last > first && /^\s*\d+\s*$/.test(lines[last]) ? last : -1
  const runs = [[]]
  lines.forEach((line, i) => {
    if (i > 0 && (BOX_START.test(line) || i === header || i === footer)) runs.push([])
    runs[runs.length - 1].push(line)
  })
  const offsets = []
  let text = ''
  for (const run of runs) {
    const t = normText(run.join('\n'))
    if (!t) continue
    if (text) {
      text += ' '
      offsets.push(text.length)
    }
    text += t
  }
  return offsets
}

function occurrences(hay, needle) {
  const out = []
  if (!needle) return out
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) out.push(i)
  return out
}

// True when the quote occurs on the page and every occurrence has a box break strictly inside it.
export function spansBoxBreak(quote, rawPage, titles = null) {
  const text = normText(rawPage)
  const occ = occurrences(text, quote)
  if (!occ.length) return false
  const breaks = boxBreaks(rawPage, titles)
  return occ.every((s) => breaks.some((b) => b > s && b < s + quote.length))
}

// A quote's pieces between box breaks (its first clean occurrence → [quote]; else the first occurrence split).
export function splitAtBoxBreaks(quote, rawPage, titles = null) {
  const text = normText(rawPage)
  const occ = occurrences(text, quote)
  if (!occ.length) return [quote]
  const breaks = boxBreaks(rawPage, titles)
  const inside = (s) => breaks.filter((b) => b > s && b < s + quote.length)
  const clean = occ.find((s) => !inside(s).length)
  if (clean !== undefined) return [quote]
  const s = occ[0]
  const cuts = [s, ...inside(s), s + quote.length]
  const pieces = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const p = text.slice(cuts[i], cuts[i + 1]).trim()
    if (p) pieces.push(p)
  }
  return pieces
}

// Attribution at the end (" – Name", "” – Name") is cut off; at the start ("– Name …") too. Names from `names`.
export function cutAttribution(quote, names) {
  const alt = names.map((n) => escapeRegex(n)).join('|')
  let q = quote
  let said_by = null
  const end = new RegExp(`\\s*[–-]\\s+(${alt})\\.?$`).exec(q)
  if (end) {
    said_by = end[1]
    q = q.slice(0, end.index).trim()
  }
  const start = new RegExp(`^[–-]\\s+(${alt})(?![A-Za-z])\\s*`).exec(q)
  if (start) q = q.slice(start[0].length).trim()
  else if (/^[–-] [A-Z]/.test(q)) q = ''
  return { quote: q, said_by }
}

// Clean cuts (API.md §4.2): a cut quote never ends on , ; : or a dangling and/or/with. Only trims, so the result is
// still a substring; callers verify it again.
export function cleanCut(quote) {
  let s = String(quote).trim()
  let prev
  do {
    prev = s
    s = s.replace(/^•\s*/, '').replace(/[\s,;:]+$/, '').replace(/\s+(?:and|or|with)$/i, '').trim()
  } while (s !== prev)
  return s
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Guide-side folding for whole-word search: case-insensitive, and ’ ' - count as word breaks.
export function foldForSearch(s) {
  return ' ' + String(s).toLowerCase().replace(/[’'‘\-–]/g, ' ').replace(/[\s ]+/g, ' ') + ' '
}

// Whole-word find of `term` inside `text`. Both sides are folded the same way, and a hit must not be
// flanked by a letter or digit. `+`, `#` and `/` are part of words (USA IIC+, Div/13), so they are
// allowed inside the term and must match literally.
export function findWholeWord(text, term) {
  const hay = typeof text === 'string' && text.startsWith(' ') && text.endsWith(' ') ? text : foldForSearch(text)
  const needle = foldForSearch(term).trim()
  if (!needle) return -1
  const re = new RegExp('(?<![a-z0-9+#/])' + escapeRegex(needle).replace(/ /g, ' +') + '(?![a-z0-9+#/])')
  const m = re.exec(hay)
  return m ? m.index - 1 : -1
}

export function hasWholeWord(text, term) {
  return findWholeWord(text, term) >= 0
}
