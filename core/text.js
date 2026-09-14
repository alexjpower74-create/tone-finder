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
// Attribution names (same list as the build's SAID_BY and the engine's why path).
export const ATTRIBUTION_NAMES = [
  'yek', 'Yek', 'Cliff', 'Legendary Tones', 'Marshall', 'MESA', 'Manual', 'Alan Phillips', 'Fenderguru.com',
  'Fenderguru', 'Wikipedia', 'Orange', 'Bogner', 'Soldano', 'Fryette', 'Friedman', 'Diezel', 'Supro', 'Suhr',
  'Peavey', 'Komet', 'Ken Fischer', 'Dr. Z', 'Bob Bradshaw', 'Vintage Guitar', 'ToneQuest', 'The Gear Page',
  'Swart', 'Splawn', 'Premier Guitar', 'Trainwreck.com', 'Richard Hallebeek', 'Rob Navarette', 'Ultra Sound',
]
let leadingAttribution = null

// Round 7: also strip a leading attribution ("– Manual Fractal Audio’s model…"): it belongs to the previous passage.
export function cleanCut(quote) {
  leadingAttribution ??= new RegExp(`^[–-]\\s+(?:${ATTRIBUTION_NAMES.map((n) => escapeRegex(n)).join('|')})(?![A-Za-z])\\s*`)
  let s = String(quote).trim()
  let prev
  do {
    prev = s
    s = s.replace(leadingAttribution, '').replace(/^•\s*/, '').replace(/[\s,;:]+$/, '').replace(/\s+(?:and|or|with)$/i, '').trim()
  } while (s !== prev)
  return s
}

// Locate (API.md §5.5): fold quote marks, apostrophes, dashes, case and spacing; keep a map back to the original.
const FOLD = { '“': '"', '”': '"', '„': '"', '‘': "'", '’': "'", '–': '-', '—': '-' }
export function foldWithMap(s) {
  const src = String(s)
  let out = ''
  const map = []
  let space = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (/\s/.test(ch)) {
      if (!space && out) {
        out += ' '
        map.push(i)
      }
      space = true
      continue
    }
    space = false
    let f = FOLD[ch] ?? ch
    const low = f.toLowerCase()
    if (low.length === f.length) f = low
    out += f
    for (let k = 0; k < f.length; k++) map.push(i)
  }
  if (out.endsWith(' ')) {
    out = out.slice(0, -1)
    map.pop()
  }
  return { text: out, map }
}

// → { start, end } offsets in `text` (a pageText): the exact quote's first occurrence, else the folded quote when it
// occurs exactly once; null otherwise.
export function locateQuote(quote, text) {
  const q = normText(quote)
  if (!q) return null
  const exact = text.indexOf(q)
  if (exact >= 0) return { start: exact, end: exact + q.length }
  const fq = foldWithMap(q).text
  const fp = foldWithMap(text)
  const i = fp.text.indexOf(fq)
  if (i < 0 || fp.text.indexOf(fq, i + 1) >= 0) return null
  return { start: fp.map[i], end: fp.map[i + fq.length - 1] + 1 }
}

const CARD_PREFIX = /^(?:Synopsis|Tips|Clips|Sound Clips|Cabinet\/speaker|Stock cabs|Web, Manual|Amp controls) /

// Expand [start, end) of pageText to its containing sentence(s) inside one box run (card label stripped).
// → { start, end } or null when the span crosses a run or the result breaks the ≤ 320 / ≤ 2 sentence limits.
export function expandToSentence(rawPage, span, titles = null, max = 320) {
  const text = normText(rawPage)
  const breaks = boxBreaks(rawPage, titles)
  const starts = [0, ...breaks]
  let r = starts.length - 1
  while (r > 0 && starts[r] > span.start) r--
  let runStart = starts[r]
  const runEnd = r + 1 < starts.length ? starts[r + 1] - 1 : text.length
  if (span.end > runEnd) return null
  const label = CARD_PREFIX.exec(text.slice(runStart, runEnd))
  if (label && runStart + label[0].length <= span.start) runStart += label[0].length
  const run = text.slice(runStart, runEnd)
  const sStarts = [0]
  const sEnds = []
  const re = sentenceBreakRegex()
  let m
  while ((m = re.exec(run))) {
    sEnds.push(m.index + m[0].trimEnd().length)
    sStarts.push(m.index + m[0].length)
  }
  sEnds.push(run.length)
  const rel = { start: span.start - runStart, end: span.end - runStart }
  let a = 0
  while (a + 1 < sStarts.length && sStarts[a + 1] <= rel.start) a++
  let b = a
  while (b + 1 < sStarts.length && sEnds[b] < rel.end) b++
  const out = { start: runStart + sStarts[a], end: runStart + sEnds[b] }
  const q = text.slice(out.start, out.end)
  if (q.length > max || sentenceBreakCount(q) > 1) return null
  return out
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
