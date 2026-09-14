// Guide text helpers for the mock builder and the app's tests: page parsing, the §0 quote check, and box breaks
// (API.md §4.2). Pure ESM, no dependencies. tf1's core/text.js will export boxBreaks/spansBoxBreak with the same
// contract; once that is on main the builder can import it instead of this copy.

// Every run of whitespace (space, tab, newline, U+00A0) → one space, then trim. Nothing else.
export const normText = (s) => String(s ?? '').replace(/[\s ]+/g, ' ').trim();

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
    raw: (n) => rawPages.get(n) ?? null,
    pageText: (n) => text.get(n) ?? null,
    // §0: normalised, 12–320 characters, at most 2 sentences, integer page 1–301, exact substring of that page.
    isVerified(quote, page) {
      if (typeof quote !== 'string' || quote !== normText(quote) || quote.length < 12 || quote.length > 320) return false;
      if (sentenceBreakCount(quote) > 1) return false;
      return Number.isInteger(page) && page >= 1 && page <= 301 && (text.get(page) ?? '').includes(quote);
    },
  };
}

// ---------- box breaks (API.md §4.2) ----------
// A box break is a raw line break followed (after optional spaces or tabs) by an opening “, an attribution dash
// ("– " or "- " then a capital), a bullet "• ", or a card label at the start of the line.
const BOX_BREAK =
  /\r?\n(?=[ \t]*(?:“|[–-] [A-Z]|• |(?:Synopsis|Tips|Clips|Sound Clips|Cabinet\/speaker|Stock cabs|Web, Manual|Amp controls) |More videos, clips and comments))/g;

// The page split into box runs, each normalised: joining them with one space gives exactly pageText.
export function boxRuns(rawPage) {
  const raw = String(rawPage ?? '');
  const runs = [];
  let from = 0;
  for (const m of raw.matchAll(BOX_BREAK)) {
    runs.push(raw.slice(from, m.index));
    from = m.index;
  }
  runs.push(raw.slice(from));
  return runs.map(normText).filter(Boolean);
}

// Offsets in pageText where a new box starts (never 0).
export function boxBreaks(rawPage) {
  const offsets = [];
  let length = 0;
  for (const run of boxRuns(rawPage)) {
    if (length) {
      length += 1;
      offsets.push(length);
    }
    length += run.length;
  }
  return offsets;
}

// True when every occurrence of the quote on the page has a break strictly inside it.
export function spansBoxBreak(quote, rawPage) {
  const q = String(quote ?? '');
  const text = normText(rawPage);
  let at = q ? text.indexOf(q) : -1;
  if (at < 0) return false;
  const breaks = boxBreaks(rawPage);
  for (; at >= 0; at = text.indexOf(q, at + 1)) {
    const end = at + q.length;
    if (!breaks.some((o) => o > at && o < end)) return false;
  }
  return true;
}

// A picked quote cut at the box breaks inside it (only ever shorter). A quote that doesn't span comes back whole.
export function splitAtBoxBreaks(quote, rawPage) {
  if (!spansBoxBreak(quote, rawPage)) return [quote];
  const text = normText(rawPage);
  const at = text.indexOf(quote);
  const end = at + quote.length;
  const pieces = [];
  let from = at;
  for (const cut of boxBreaks(rawPage).filter((o) => o > at && o < end)) {
    pieces.push(text.slice(from, cut).trim());
    from = cut;
  }
  pieces.push(text.slice(from, end).trim());
  return pieces.filter(Boolean);
}

// Clean cuts (API.md §4.2): never start with a bullet, never end on a comma, semicolon, colon or a dangling
// "and" / "or" / "with". Trimming keeps an exact substring; the caller drops the quote if it gets too short.
export function cleanCut(quote) {
  let q = String(quote).trim().replace(/^•\s+/, '');
  let prev;
  do {
    prev = q;
    q = q.replace(/\s*[,;:]$/, '').replace(/\s+(?:and|or|with)$/, '').trim();
  } while (q !== prev);
  return q;
}

// A quote never ends with an attribution: " – yek" is cut off and becomes said_by.
const ATTRIBUTION_TAIL = /\s[–-]\s(yek|Yek|Cliff|Legendary Tones|Marshall|MESA|Manual)$/;
export function cutAttribution(quote) {
  const m = String(quote).match(ATTRIBUTION_TAIL);
  if (!m) return { quote, said_by: null };
  return { quote: quote.slice(0, m.index).trim(), said_by: m[1] === 'Yek' ? 'yek' : m[1] };
}
