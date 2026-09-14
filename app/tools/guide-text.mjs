// Guide text helpers for the mock builder and the app's tests: page parsing, the §0 quote check, and splitting
// passages the text extraction glued together. Pure ESM, no dependencies.

// Every run of whitespace (space, tab, newline, U+00A0) → one space, then trim. Nothing else.
export const normText = (s) => String(s ?? '').replace(/[\s ]+/g, ' ').trim();

// §0 rule 2. A fresh RegExp per call: /g regexes carry state.
const sentenceBreak = () => /[.!?][”"’)]*\s+(?=[A-Z“"‘(])/g;
export const sentenceBreakCount = (s) => (String(s).match(sentenceBreak()) || []).length;

export const splitSentences = (t) => normText(t).split(/(?<=[.!?][”"’)]*)\s+(?=[A-Z“"‘(])/).filter(Boolean);

// fulltext → Map<page, raw text>: everything after a marker line up to the next marker.
export function parsePages(full) {
  const pages = new Map();
  const re = /^===== PAGE (\d+) =====$/gm;
  let m;
  let last = null;
  let from = 0;
  while ((m = re.exec(full))) {
    if (last !== null) pages.set(last, full.slice(from, m.index));
    last = Number(m[1]);
    from = m.index + m[0].length;
    if (full[from] === '\n') from++;
  }
  if (last !== null) pages.set(last, full.slice(from));
  return pages;
}

export function makeVerifier(rawPages) {
  const text = new Map([...rawPages].map(([n, t]) => [n, normText(t)]));
  return {
    text,
    pageText: (n) => text.get(n) ?? null,
    // §0: normalised, 12–320 characters, at most 2 sentences, integer page 1–301, exact substring of that page.
    isVerified(quote, page) {
      if (typeof quote !== 'string' || quote !== normText(quote) || quote.length < 12 || quote.length > 320) return false;
      if (sentenceBreakCount(quote) > 1) return false;
      return Number.isInteger(page) && page >= 1 && page <= 301 && (text.get(page) ?? '').includes(quote);
    },
  };
}

// ---------- joined passages (lead, round 2) ----------
// The extraction glues separate boxes without punctuation: `…like Eddie Van Halen “My settings for a …`.
// Split before an opening “ that follows a letter, digit or comma and a space, and before an attribution dash.
// Two refinements, so real quoted words survive (see the build report's contract questions):
//  - a short inline quote is not a new passage: “Brown Sound”, “typical” (closing ” within 3 words, no “ inside);
//  - the dash only counts when it directly follows a closing quote mark or sentence punctuation
//    (“… to taste.” – Cliff), not a list separator like "Marshall stock cabs – Cab Packs".
const OPEN_QUOTE_JOIN = /(?<=[A-Za-z0-9,]) (?=“)/g;
const DASH_JOIN = /(?<=[”"’.!?]) (?=– (?:[A-Z]|yek\b))/g;

function isInlineQuote(s, open) {
  const close = s.indexOf('”', open + 1);
  if (close < 0) return false;
  const inner = s.slice(open + 1, close);
  return !inner.includes('“') && inner.trim().split(/\s+/).length <= 3;
}

// Indexes of the spaces where a joined passage should be cut.
export function joinPoints(s) {
  const cuts = new Set();
  for (const m of String(s).matchAll(OPEN_QUOTE_JOIN)) if (!isInlineQuote(s, m.index + 1)) cuts.add(m.index);
  for (const m of String(s).matchAll(DASH_JOIN)) cuts.add(m.index);
  return [...cuts].sort((a, b) => a - b);
}

export const hasJoin = (s) => joinPoints(s).length > 0;

// Raw regex hits the refinement lets through (reported, not failed).
export const rawOpenQuoteHits = (s) => [...String(s).matchAll(OPEN_QUOTE_JOIN)].length;

// Sentences, then cut at joins. Every piece is an exact substring of the normalised input.
export function splitPassages(text) {
  const out = [];
  for (const s of splitSentences(text)) {
    let start = 0;
    for (const cut of joinPoints(s)) {
      out.push(s.slice(start, cut).trim());
      start = cut + 1;
    }
    out.push(s.slice(start).trim());
  }
  return out.filter(Boolean);
}
