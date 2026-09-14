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
