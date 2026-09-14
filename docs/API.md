# Tone Finder — API and data contract

Owner: the lead. Slices build against this file. If it is wrong or missing something, write it under
**Contract questions** at the top of your build report and carry on with the most sensible reading. Don't quietly
diverge. `data/golden.json` (lead-owned) holds the acceptance expectations that go with it.

## 0. Words that matter

- **Guide**: `yek-guide-fulltext.txt` in `TF_GUIDE_DIR` (default `/home/alexander/Claude/Reference/Yek Fractal Amp
  Guide`), plus `yek-guide-sections.json` beside it (a pre-parsed per-section card + spec table). 301 pages, split on
  lines `===== PAGE n =====`. **Page n is the PDF page and the only page number we ever show or store.** The
  printed number at the foot of a page is n − 1; never use it. The guide never enters git (AGENTS.md).
- `normText(s)`: replace every run of whitespace (space, tab, newline, U+00A0) with one space, then trim. Nothing
  else: no case folding, no quote-mark folding, no hyphen repair.
- `pageText(n)` = `normText(raw text of page n)`, the text after the marker line up to the next marker.
- **Verified quote** `{quote, page}`: all of
  1. `quote === normText(quote)` and `12 <= quote.length <= 320`;
  2. at most 2 sentences: the regex `/[.!?][”"’)]*\s+(?=[A-Z“"‘(])/g` matches at most once inside `quote`;
  3. `Number.isInteger(page)`, `1 <= page <= 301`, and `pageText(page).includes(quote)` (case-sensitive).
  One function, `verifyQuote(q, pages)` in `core/verify.js`, used by the build, the engine, the AI step and the
  Worker. A quote that fails is never shown or stored. Display may add "…" **outside** the quote marks; the quote
  itself is always the exact substring.
- **said_by**: set only when the guide attributes the passage with a dash line right after it (`– yek`, `– Yek`,
  `– Cliff`, `– Legendary Tones`, `– Marshall`, `– MESA`, …), stored without the dash (`"yek"`, `"Cliff"`,
  `"Legendary Tones"`). Otherwise `null`. Boxed tips in the guide often lose their attribution in the text, so
  `null` is common and honest.
- **Unit name**: an amp type name exactly as the guide writes it (§3.3). The engine, the AI step and the app never
  show any other amp model name.
- **General knowledge**: facts about songs, artists or gear that don't come from the guide. Only the AI step
  produces them. Always labelled "General knowledge (AI) — not from the guide", never given a page or `said_by`.
- **Starting guess**: a knob value not taken from the guide. `kind: "guess"`, shown with the words
  "starting guess — not from the guide".
- **Stub section**: a section whose only content is "Please refer to the section on the … models." (`refers_to`
  names the target). Stubs are listed in the model browser but never become suggestions.

## 1. Ports, processes, env

| What | Dev (slice) | QA worktree |
|---|---|---|
| App `node app/serve.mjs --port N` | 8301 (tf2) | 8309 |
| Worker `wrangler dev --local --port N` | 8302 (tf1) | 8308 |
| Fake OpenAI server for tests (`TF_FAKE_AI_PORT`) | 8303 (tf1) | 8307 |

- The app finds the API from `<meta name="api-base" content="http://127.0.0.1:8302">`, overridden by `?api=<origin>`.
  `?mock=1` swaps in `app/api.mock.js` (no network).
- `worker/.dev.vars` (gitignored; `worker/.dev.vars.example` committed with these keys and safe values):
  ```
  ADMIN_TOKEN=local-dev-token
  OPENAI_API_KEY=
  OPENAI_BASE_URL=https://api.openai.com/v1
  AI_MODEL=gpt-5.4-mini
  AI_CAP_CAD=2.00
  USD_CAD=1.3866
  AI_PRICE_IN_PER_M=0.75
  AI_PRICE_CACHED_IN_PER_M=0.075
  AI_PRICE_OUT_PER_M=4.50
  TF_GUIDE_DIR=/home/alexander/Claude/Reference/Yek Fractal Amp Guide
  ```
  An empty `OPENAI_API_KEY` means AI is off and **zero** requests are made. `TF_GUIDE_DIR` is read by scripts only.
  Scripts read `worker/.dev.vars`; real environment variables override it.
- Root `package.json` scripts (lead): `build:models`, `load-guide`, `demo`, `test:core`, `test:worker`, `test:app`,
  `test`, `dev:worker`, `dev:app`.

## 2. Guide pages in each runtime

- `core/guide.js`: `parsePages(fulltext) → Map<number, string>` (raw page text), `pageText(pages, n)`,
  `pagesSha256Input(pages)` = `JSON.stringify([[1, raw1], [2, raw2], …, [301, raw301]])`. The SHA-256 hex of that
  string is `guide.pages_sha256` in `data/models.json`.
- Node (build, tests, scripts): read `TF_GUIDE_DIR/yek-guide-fulltext.txt`. **If it is missing, tests fail** with
  `guide not found at <path>`. They never silently skip.
- Worker: pages live in local D1 `guide_pages`, loaded by `npm run load-guide` (`scripts/load-guide.mjs` →
  `POST /api/admin/guide`, §6). The Worker recomputes the SHA with WebCrypto and refuses a mismatch with
  `models.json` (409). No pages loaded → search falls back to the stored quotes in `models.json` (§4.1), AI is
  unavailable (`ai.reason: "guide_not_loaded"`), and `/api/health` says `guide.loaded: false`.

## 3. `data/models.json`

Built by `node scripts/build-models.mjs` from the guide plus `data/curation.json` (tf1's hand decisions: unit name
evidence, stubs, accepted settings, directions, notes). The build verifies every quote and fails loudly on any
miss. Output is deterministic: stable key order, guide order, no timestamps.

```jsonc
{
  "schema": 1,
  "guide": {
    "title": "Yek's Guide to the Fractal Audio Amp Models",
    "by": "Alexander van Engelen (yek); compiled by simviz",
    "revision": "April 2017",
    "firmware": "Quantum 7.02",
    "pdf_pages": 301,
    "pages_sha256": "…"
  },
  "conventions": [
    { "id": "no-master-volume", "quote": "If the original amp has no Master Volume control, the Master control in the amp model will default at 10.", "page": 12 }
    // also: "high-low-inputs", "two-gain-controls", "single-tone-control", "taper-match", "soft-reset" — all p. 12
  ],
  "models": [ /* exactly 109, in guide order, see §3.1 */ ]
}
```

### 3.1 Model

```jsonc
{
  "id": "1959slp",
  "section": "1959SLP (Marshall SLP1959, Vintage Re-Issue Series)",   // exact section title (sections.json)
  "name": "1959SLP",                                                 // title before " (" (see ids for dup names)
  "based_on": "Marshall SLP1959, Vintage Re-Issue Series",           // text inside the parentheses, or null
  "pages": { "start": 28, "end": 31 },                               // start = section page; end = next section page − 1
  "refers_to": null,                                                 // stub → target id (§0)
  "unit_names": [ { "name": "1959SLP", "evidence": "1959SLP", "page": 28 } ],
  "brands": ["Marshall"],
  "specs": {                                                         // verbatim strings from the spec table, or null
    "years": "1993 to 1995", "circuit": null, "power": "100 watt", "master_volume": "No",
    "negative_feedback": "Yes", "preamp_tubes": "ECC83", "power_tubes": "EL34", "tonestack": "POST"
  },
  "facets": { "master_volume": "no", "power_tubes": ["EL34"] },
  "synopsis": { "quote": "Models of a 100 watt Superlead Plexi re-issue", "page": 28 },
  "controls": { "quote": "Presence, Bass, Middle, Treble and Volume (=Drive)", "page": 28 },
  "tips": [
    { "quote": "Don't hesitate to turn Bass all the way down and turn up Middle and Treble.", "page": 28, "said_by": null }
  ],
  "cab": {
    "speaker": { "quote": "4x12 Marshall cabinet with Celestion G12M (greenbacks) or G12H speakers", "page": 28 },
    "stock_cabs": { "quote": "Marshall stock cabs – Cab Packs", "page": 28 },
    "notes": [ ]                                                     // ≤ 2 body sentences about cabs/speakers
  },
  "settings": [
    {
      "quote": "My settings for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5.", "page": 28, "said_by": null,
      "context": null,                                               // optional verified heading, e.g. "JD Simo’s Settings:"
      "unit_name": null,                                             // set when the guide ties it to one unit name
      "knobs": { "Bass": 2, "Mid": 8, "Treble": 7.5 },
      "other": []                                                    // verbatim fragments for non-knob settings
    }
  ],
  "directions": [ { "knob": "Bass", "dir": "down", "quote": "Don't hesitate to turn Bass all the way down and turn up Middle and Treble.", "page": 28 } ],
  "notes": [ { "quote": "…", "page": 29, "said_by": null } ]         // ≤ 5 per model
}
```

Rules, each with a test in `core/tests/models.test.mjs`:

1. **Count and order.** Exactly 109 models, one per model section of `yek-guide-sections.json` (every entry except
   the 4 appendix entries `VOX-type Amps`, `D-type Amps`, `Preamps`, `Fractal Forum Content`), same order, same
   `section` strings, same start pages. Every `section` title appears in the table of contents (pages 2–7).
   Every TOC entry between "The Amps" and "Amp Categories" is either a model's section title or one of its unit
   names (case-insensitive).
2. **ids.** `slug(name)`: lowercase; delete `’` and `'`; `+` → `-plus`; every run of other characters outside
   `[a-z0-9]` → `-`; trim `-`. Unique. When two sections share a name (the two `Suhr Badger` sections, pp. 238 and
   239), `name` becomes the TOC sub-entry that tells them apart (`Suhr Badger 18`, `Suhr Badger 30`). Examples:
   `usa-iic-plus-and-usa-iic-plus-plus`, `brit-800-brit-800-mod-and-brit-800-34`, `dweezils-b-man`,
   `div-13-cj11`, `ca3-plus`, `cali-leggy-and-legato-100`. `data/golden.json` lists ids that must exist.
3. **Unit names.** Each `{name, evidence, page}` has `evidence` verified on `page` (§0, but no sentence rule and
   `evidence.length >= 3`), and `name` is either exactly `evidence` or a slash expansion of it: evidence
   `Plexi 100W HIGH/JUMP/NRML` gives `Plexi 100W HIGH`, `Plexi 100W JUMP`, `Plexi 100W NRML` (the last k words of
   the first part are replaced by each later part). Names containing a slash that is part of the name stay whole
   (`USA IIC+ BRT/DP`). Case-insensitive duplicates within a model are merged, keeping the section-page spelling,
   then the TOC spelling, then the appendix spelling. Sources: the section title's name parts, TOC sub-entries,
   the appendix tables (pp. 295–298), and variant lists in the section body. A stub's unit names resolve to its
   target. Every name in `golden.json` `names_resolve_to` belongs to exactly that model after resolving stubs;
   no name in `names_never` exists. `See X` pointers (for example `FAS Brown` inside FAS custom models) are not
   unit names of the section that points.
4. **Specs and facets.** `specs` values are the `yek-guide-sections.json` spec strings, each found verbatim in
   `normText` of the section's joined pages, else `null`. `facets.master_volume`: every whitespace token of the
   spec that is `Yes`/`No` agrees → `"yes"`/`"no"`; mixed → `"mixed"`; null → `"unknown"`. `facets.power_tubes`:
   canonical tubes found in `specs.power_tubes`, aliases `6L6GC`/`5881` → `6L6`, `6AQ5` → `EL84`; order EL34, EL84,
   6L6, 6V6, KT88, KT66, 6550, 6973; empty when null. `brands` come from the fixed table in `core/brands.js`
   (Fender, Marshall, MESA/Boogie, VOX, Bogner, Diezel, Engl, Friedman, Soldano, Orange, Dumble, Trainwreck,
   Matchless, Dr. Z, Carol-Ann, Cameron, Splawn, Suhr, Two-Rock, Fuchs, Budda, Bad Cat, Hiwatt, Peavey, EVH, Roland,
   Ampeg, Supro, Gibson, Carvin, Divided By 13, Swart, Komet, Cornford, Morgan, Carr, Blankenship, Bludotone, HOOK,
   Custom Audio, Fryette, Paul Ruby, Fractal Audio); each table row has match tokens, and a brand is assigned only
   when one of its tokens occurs in `section` (`FAS` → Fractal Audio). A model may have several brands or none.
5. **Quotes.** Every `quote` in the file is verified (§0) on its page, and that page lies inside the model's
   `pages` (conventions: p. 12). The total length of all quotes is ≤ 15% of the total length of `pageText` over
   all 301 pages (the test prints both numbers).
6. **Settings.** Knob labels map to the seven knobs: first by the model's `controls` hints written `Label (=Knob)`
   (Suhr Badger: `Drive (=Master)`, `Gain (=Drive)`; many amps: `Volume (=Drive)`), then by this table: `Input
   Drive`, `Drive`, `Gain` → Drive · `Bass` → Bass · `Mid`, `Middle`, `Midrange`, `Midrang` → Mid · `Treble` → Treble ·
   `Master`, `MV`, `Master Volume` → Master · `Presence` → Presence · `Depth` → Depth. `Volume` maps to Drive only
   through a `Volume (=Drive)` hint. A knob value is one number 0–10 written right after its label (separators
   `:`, `=`, space, `at`, `around`); the number's own text must occur in the quote. Ranges (`9-10`), words ("to
   taste") and other controls (Overdrive, Hi Cut, GEQ bands, Level, Bright) go to `other` as verbatim fragments of
   the quote. A settings entry needs at least one knob.
7. **Directions** come from `tips` only, `dir` is `up` or `down`, and the knob's label (per rule 6) occurs in the
   quote.

## 4. Answer engine (`core/answer.js`)

`answer(query, { models, pages, ai = null })` → Answer (§6). Pure apart from the optional `ai` hooks. `pages` may be
null (Worker before load-guide), in which case the only searchable text is the quotes stored in `models.json`.

### 4.1 Terms and search
- Lowercase the query, keep letters, digits, `+`, `#`, `/`, `-` and apostrophes inside words; split on the rest.
- **Stop words** are never searched alone. Two kinds:
  - *Function words*: a an and the of on in at to for with from by like my me i want need get some sort kind type
    please how what that this those these is are be it its his her their do does make give through into onto over
    under about via as or but than (the last eleven from tf1's finding: "banjo through a toaster" matched "through").
    A 2+-word n-gram may not start or end with one (except "the" + proper name, below).
  - *Filler words*: tone tones sound sounds sounding song guitar guitars amp amps model models setting settings
    preset patch play playing. A 2+-word n-gram may END with one but not start with one, so "brown sound" and
    "rhythm tone" are tried as phrases ("brown" alone matched "'60 brown Fender Super").
- **Generic words** are searched and scored but are never *strong*: clean crunch crunchy rhythm lead solo dirty
  distorted distortion overdrive overdriven drive gain master volume bass mid middle treble presence depth
  loud quiet warm bright dark fat big heavy.
- **n-grams**: try word n-grams from 4 down to 1 over the query. An n-gram of 2+ words may not start or end with a
  stop word. An n-gram is *found* when it occurs as whole words (case-insensitive, `’`/`'` and `-` count as word
  breaks on the guide side) in some model's searchable text; a found n-gram consumes its words, longer first.
- **Word variants.** A query word of 5+ letters ending in `y`, `e`, `ing`, `ed`, `es` or `s` also matches guide words
  that share its stem plus one of those endings (`sparkly` ↔ `sparkle`, `sparkling`; `chimey` ↔ `chime`, `chiming`;
  `crunchy` ↔ `crunch`). The stem must keep at least 5 letters. The evidence quote contains the guide's own word.
- **Proper names with "the".** A 2+-word n-gram may start with `the` when the capitalised form (`The Edge`) occurs in
  the guide somewhere other than at a sentence start. Otherwise "The Edge chime" falls back to "edge" and matches
  "edge of breakup". A "the" n-gram whose other words are all generic words is itself generic (a capitalised
  "The Rhythm" in the guide must not make "the rhythm" strong). Likewise any n-gram whose words, minus a leading
  "the" and minus filler words, are all generic words is generic ("rhythm tone", "lead tone").
- A model's searchable text, by field weight: unit names, `name`, `based_on` (4) · synopsis, tips (3) · controls,
  cab, settings (2) · every other sentence of its pages' `pageText` (1). Stubs are merged into their target first.
- `df(term)` = number of models (109 minus stubs) whose searchable text contains the term;
  `idf = ln(1 + N / df)`.
- A term is **strong** for a model when it is not a generic word and either `df <= 0.35 × N` or it hits that model
  in a weight ≥ 3 field.
- `score(model) = Σ over found terms of idf × (best field weight where the term hits that model) × (1.5 if the term
  has 2+ words) × (1 + ln(hits))`, where `hits` is how many times the term occurs across that model's pages (min 1).
  A section that names Metallica four times outranks four sections that list Metallica once among other users.
  **The `(1 + ln(hits))` factor applies only when the term's best field for that model is body text (weight 1)**;
  name, based_on, synopsis and tips hits use factor 1 (otherwise "blues" in "Blues Junior" swamped "SRV").
- **Coverage.** `final score = score × (0.5 + 0.5 × covered / found)`, where `found` is the number of distinct
  found non-generic terms in the query and `covered` how many of them hit this model (both at least 1). A model
  that matches "The Edge" and "chime" outranks one that matches only "chime".
- **Candidates** are models with at least one strong term. Keep those with `score >= 0.4 × top score`, at most 4,
  ordered by score, then guide order.
- `understood.matched_terms`: found terms. `understood.unmatched_terms`: non-stop, non-generic words and n-grams
  with `df = 0`, in query order.
- `understood.intent` (first rule that fires, in this order): `high_gain` (high gain, metal, djent, thrash,
  brutal, chug), `lead` (lead, solo, singing, liquid, sustain), `crunch` (crunch, crunchy, classic rock, rock,
  rhythm), `edge` (edge of breakup, breakup, blues, bluesy), `clean` (clean, sparkle, sparkly, glassy, chime,
  chimey, shimmer, pristine, jazz, country); else `null`.
- No candidates → `status: "no_guide_support"`, `message: "I can't point to the guide for that."`,
  `suggestions: []`.

### 4.2 A suggestion
- `why`: 1–3 verified quotes from the model's pages, each a sentence containing a found term (prefer strong terms,
  then tips/synopsis, then distinct terms).
- **Joined passages (box breaks).** The text extraction glues separate boxes together. On p. 28 the tip "Or just
  crank everything, like Eddie Van Halen" runs straight into Cliff's "“My settings for a “typical” Plexi tone are
  Bass 2, Mid 8, Treble 7.5.", which reads as if Van Halen gave those settings; on p. 33 a Marshall quote runs on
  through "– Marshall" into yek's next sentence. Exact-substring verification can't see that, so:
  - A **box break** is a line break in the raw page text followed (after optional spaces or tabs) by an opening `“`,
    by an attribution dash (`– ` or `- ` then a capital letter), by a bullet (`• `), or by a card label at the start
    of the line: `Synopsis `, `Tips `, `Clips `, `Sound Clips `, `Cabinet/speaker `, `Stock cabs `, `Web, Manual `,
    `Amp controls `, `More videos, clips and comments`. Also a box break: the line break after a page's first raw
    line when that line is the section title (the running header), and the line break before a page's last
    non-empty raw line when that line is only digits (the printed page number). (p. 168's Gilmour quote ran from a tip into "Clips 1972 Hiwatt
    DR103 CRANKED … (Tyler Grund)".) `core/text.js` exports
    `boxBreaks(rawPage) → number[]` (offsets in `pageText`, found by normalising each run between breaks and
    joining the runs with one space, which gives exactly `pageText`) and `spansBoxBreak(quote, rawPage)` (true when
    every occurrence of the quote on the page has a break strictly inside it).
  - Every quote the build stores and every quote the engine shows (why, tips, notes, settings, cab notes) is split
    at box breaks when it is picked, so it can only get shorter. A quote never ends with an attribution (" – Name"):
    cut it and put the name in `said_by`. AI citations that span a box break are dropped as `quote_not_on_page`.
  - Test: no quote in `models.json` and none in any golden-query Answer spans a box break, plus this table (the
    lead checked it on the raw pages): spans → p. 28 "Or just crank everything, like Eddie Van Halen “My settings
    for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5.", p. 33 "These tonal characteristics are what define
    this much respected all-valve head.” – Marshall The re-issue has two EL34 tubes", p. 125 "Set the gain around 6
    and then bring the master to taste” – Manual"; doesn't span → p. 16 "The name “Twin” probably refers to the use
    of two 12” speakers.", p. 28 "Plexis with 4x12 cabinets gave rise to the “Marshall stack”.", p. 146 "Model of the
    Bogner Uberschall, called “Armageddon in a box” by Bogner".
- **Clean cuts.** A quote cut at a box break or clause must not start with a bullet (`• `) and must not end on a
  comma, semicolon, colon or a dangling "and" / "or" / "with": trim them (the result is still an exact substring and must still verify), or drop the quote
  when that leaves under 12 characters ("Models of various Marshall Plexi heads," → "… heads"; Recto stock cabs
  "… 13, 14, 21 and").
- **Which sentence first.** Among a model's why candidates for the same term, prefer a sentence that also contains
  the model's name, one of its unit names, or the last word of a unit name when that word has 3+ characters (for
  "Metallica", p. 270 "…also referred to as “Metallica’s IIC+”" beats p. 267 "Add Santana, Metallica, Keith Richards etc.").
- **Why quality.** A why quote must contain a strong term, except that the second or third quote may carry only
  generic terms when it comes from synopsis or tips. `controls` lines, `stock_cabs` lines and spec-table lines are never why quotes. A
  quote shown under one suggestion is not repeated under another in the same Answer when that model has another
  verified sentence with a found term. A why quote starts at a sentence or box start, never mid-word.
- `unit_name`: the model's unit name that appears in a `why` quote or the query (case-insensitive), else the first.

### 4.3 Knobs
Always seven, in this order: Drive, Bass, Mid, Treble, Master, Presence, Depth.
1. Pick one settings entry: same `unit_name` first, then one whose quote contains a found term or the intent
   word, then the first; or none.
2. Knobs in that entry → `{ knob, value, kind: "guide", quote, page, said_by }`.
3. Master still unset and `facets.master_volume` is `"no"` → `{ kind: "guide_rule", value: 10, quote, page: 12 }`
   with the `no-master-volume` convention quote.
4. Anything still unset → `{ kind: "guess", value, note: "starting guess — not from the guide" }`. Drive by intent:
   clean 2.5, edge 4.5, crunch 6, lead 7, high_gain 7, none 5. Every other knob 5.
5. A `directions` entry for a guessed knob moves it to at least 7 (up) or at most 3 (down); a guess already on that
   side stays as it is (a clean Drive guess of 2.5 with "keep Drive low" stays 2.5, not 0.5). It adds
   `direction: { dir, quote, page }`. Guide values are never nudged.
6. `other_settings`: the picked entry's `other` fragments as `{ text, quote, page }`, else `[]`.
7. `taper_note`: `{ "quote": "…", "page": 12 }` (the `taper-match` convention quote, exactly these two keys) whenever
   any knob has `kind: "guide"`, else `null`.

### 4.4 Cab
`cab` is the model's stored `cab` object (a stub's target), unchanged.

### 4.5 Ares
Every Answer carries the same `ares` object (constant in `core/ares.js`):

```jsonc
{
  "firmware": "Ares",
  "guide_firmware": "Quantum 7.02",
  "note": "yek's guide was written for Quantum 7.02. Your Axe-Fx II runs Ares, which came later. Quantum 9.00 removed Motor Drive and Transformer Grind from the Amp block and replaced them with Speaker Compression (Spkr Comp), and Fractal says Ares amp modeling \"should sound very similar\".",
  "sources": [
    { "url": "https://forum.fractalaudio.com/threads/axe-fx-ii-quantum-rev-9-00-firmware-release.131649/", "fetched": "2026-09-14",
      "quote": "Removed the “Motor Drive” and “Transformer Grind” algorithms and associated parameters from the Amp block. These have been replaced by the new “Speaker Compression” algorithm." },
    { "url": "https://forum.fractalaudio.com/threads/axe-fx-ii-ares-rev-1-00-firmware-release.148248/", "fetched": "2026-09-14",
      "quote": "Not all aspects of the Ares modeling were able to be ported but the most important parts were and the amp modeling should sound very similar." }
  ]
}
```

Per suggestion, `ares_flags`: scan every string shown for it (why quotes, settings quote and `other`, direction
quotes, AI text) with `/motor\s*drive|(transformer|xformer|xfrmr)\s*grind/i`. Each hit →
`{ param: "Motor Drive" | "Transformer Grind", where: "why" | "settings" | "direction" | "ai", quote, page (or null),
advice: "Your firmware doesn't have this control. Skip this step: Fractal replaced it with Speaker Compression (Spkr Comp), which resets to 3.0." }`.
(The guide itself never mentions either control; tests plant one.)

## 5. AI step (optional, `core/ai.js`, run by the Worker)

Runs only when `ai: true` was asked, `OPENAI_API_KEY` is set, guide pages are loaded, and the cap allows it.
Otherwise `ai.used: false` and `ai.reason` is `"off"`, `"no_key"`, `"guide_not_loaded"` or `"spend_cap"`. A fresh
successful run is `ai.used: true, ai.reason: null`; `"cached"` and `"error"` are described below.

1. Guide search first (§4.1) → candidates C0 (possibly none).
2. **Call A, "pick"**: system rules + the query + the full model list (id, unit names, based_on, brands,
   master volume, power tubes; stubs excluded) + C0 with their `why` quotes. Reply JSON:
   `{ "general_knowledge": [{ "text": "…" }], "search_terms": ["…"], "picks": [{ "model_id": "…", "unit_name": "…" }] }`.
   Limits: general_knowledge ≤ 3, each ≤ 200 characters; search_terms ≤ 6; picks ≤ 4. A pick whose `model_id` is
   unknown or whose `unit_name` isn't one of that model's unit names is dropped (`unknown_model`). The rules tell
   the model: only choose from the list; song and artist facts go in general_knowledge; never mention Axe-Fx III,
   FM3 or FM9 models, Motor Drive or Transformer Grind.
3. Guide search again with `query + " " + search_terms` → C1. Terms added this way are listed in
   `understood.ai_terms`.
4. **Call B, "cite"**: for each surviving pick (and C1 not already picked, up to 4 models total), the model's
   pages as `PAGE n:` + `pageText(n)` (cap 12,000 characters per model, start pages first). Reply JSON:
   `{ "suggestions": [{ "model_id": "…", "unit_name": "…", "citations": [{ "page": 270, "quote": "…" }] }] }`.
5. **Verification** of each citation: page inside the model's `pages` (else `bad_page`), quote verified (§0) on that
   page (else `quote_not_on_page`, or `quote_too_long` when over 320 characters or 2 sentences). Model id and unit
   name are checked again (`unknown_model`). A suggestion with no verified citation is dropped
   (`no_verified_quote`). Every drop is listed in `ai.dropped` as `{ kind, detail }`. `detail` is exactly
   `"<unit name>, p. <n>"` (for example `"1959SLP, p. 60"`), or just the name for `unknown_model` and
   `no_verified_quote`.
6. Kept AI suggestions get `source: "ai_checked"`, `why` = their verified citations, and knobs/cab/Ares per
   §4.2–4.5. Final list: kept AI suggestions in the AI's order, then C1 candidates not already present
   (`source: "guide_search"`), at most 4. No AI suggestion kept → C1, or C0 when C1 is empty. General knowledge
   is shown only when at least one suggestion survives. General knowledge is about songs, artists and gear only: an
   item that mentions the guide, the candidates or the model list (case-insensitive `guide`, `candidate`,
   `provided`, `model list`, `the list`) is dropped before it is shown, and the pick prompt says so. (A real call
   returned "The provided guide candidate points to Fractal Audio’s own Brown Sound-style models", which is not
   general knowledge and was labelled "not from the guide".)
   `understood.matched_terms` and `understood.ai_terms` are de-duplicated, keeping first occurrence order.
7. **Requests**: `POST {OPENAI_BASE_URL}/chat/completions`, header `authorization: Bearer <key>`, body
   `{ model, messages, max_completion_tokens, reasoning_effort: "low", response_format: { type: "json_object" } }`,
   max_completion_tokens 1200 (A) and 2500 (B), 30 s timeout. Usage from `usage.prompt_tokens`,
   `usage.prompt_tokens_details.cached_tokens`, `usage.completion_tokens`. An error, timeout or bad JSON →
   `ai.reason: "error"` and the guide-search answer.
8. **Spend**: `usd = (input − cached) × in + cached × cached_in + output × out` (per 1M, from env);
   `cad = usd × USD_CAD`. Before each call, estimate the worst case (`prompt characters / 3` input tokens +
   max_completion_tokens output). If `spent_cad + estimate > AI_CAP_CAD`, make **no request** and answer with
   `ai.reason: "spend_cap"`. Each finished call is a row in `ai_calls`. Nothing logs the key or the prompt.
9. **Cache**: key = SHA-256 of `normText(query).toLowerCase() | pages_sha256 | AI_MODEL | PROMPT_VERSION`. A hit
   returns the stored Answer with `ai.used: true, ai.reason: "cached", ai.cost_cad: 0` and makes no request.

## 6. HTTP API (Worker)

JSON everywhere, `Access-Control-Allow-Origin: *`, `OPTIONS` answered. Errors: `{ "error": "<code>", "message": "…" }`.

- `GET /api/health` →
  `{ "ok": true, "models": 109, "guide": { "loaded": true, "pages": 301, "sha_ok": true },
     "ai": { "configured": true, "model": "gpt-5.4-mini", "cap_cad": 2, "spent_cad": 0.0412, "calls": 6 } }`
- `GET /api/models?brand=&tube=&mv=&q=` → `{ "count": 23, "total": 109, "models": [Summary], "facets": {
  "brands": [{ "value": "Fender", "count": 21 }], "power_tubes": [{ "value": "EL34", "count": 38 }],
  "master_volume": [{ "value": "yes", "count": 60 }] } }`. Filters combine with AND; `q` is a case-insensitive
  substring over name, unit names, based_on. Facet counts are over all 109. Summary =
  `{ id, name, section, based_on, brands, unit_names: [string], pages, facets, refers_to, synopsis }`.
- `GET /api/models/:id` → `{ "model": Model, "conventions": [...], "guide": {...} }`; unknown id → 404
  `not_found`.
- `POST /api/ask` body `{ "query": "…", "ai": true }` (query trimmed, 1–200 characters, else 400 `bad_query`;
  `ai` defaults to `true`) → Answer. `Answer.query` echoes the trimmed query as typed (case kept):

```jsonc
{
  "query": "Van Halen brown sound",
  "status": "ok",                                   // or "no_guide_support"
  "message": null,                                  // "I can't point to the guide for that." when no support
  "understood": { "matched_terms": ["van halen", "brown sound"], "unmatched_terms": [], "ai_terms": [], "intent": null },
  "ai": { "used": false, "reason": "off", "dropped": [], "cost_cad": 0 },
  "general_knowledge": [],                          // [{ "text": "…", "label": "General knowledge (AI) — not from the guide" }]
  "suggestions": [
    {
      "rank": 1,
      "model_id": "brit-brown-and-fas-brown",
      "unit_name": "Brit Brown",
      "section": "Brit Brown and FAS Brown (FAS custom models)",
      "based_on": "FAS custom models",
      "brands": ["Fractal Audio"],
      "pages": { "start": 60, "end": 61 },
      "source": "guide_search",                     // or "ai_checked"
      "score": 12.4,
      "why": [ { "quote": "…", "page": 60, "said_by": null, "matched": ["brown sound", "van halen"] } ],
      "knobs": [
        { "knob": "Drive", "value": 5, "kind": "guess", "note": "starting guess — not from the guide" },
        { "knob": "Presence", "value": 7, "kind": "guess", "note": "starting guess — not from the guide",
          "direction": { "dir": "up", "quote": "Turn up Presence in the Brit Brown model", "page": 60 } }
        // … seven in total, fixed order
      ],
      "taper_note": null,
      "other_settings": [],
      "cab": { "speaker": null, "stock_cabs": null, "notes": [] },
      "ares_flags": []
    }
  ],
  "ares": { /* §4.5 */ },
  "guide": { "title": "…", "revision": "April 2017", "firmware": "Quantum 7.02" }
}
```

- `POST /api/admin/guide` (header `authorization: Bearer <ADMIN_TOKEN>`) body
  `{ "pages_sha256": "…", "pages": [[1, "raw…"], …, [301, "raw…"]] }` → `{ "ok": true, "pages": 301 }`. 401 without the
  token; 409 `sha_mismatch` when the recomputed SHA differs from the body's or from `models.json`; 400 when the
  pages aren't exactly 1–301.
- `GET /api/admin/spend` (Bearer) → `{ "cap_cad": 2, "spent_cad": …, "spent_usd": …, "calls": [last 50 ai_calls rows] }`.

## 7. D1 (`tone-finder`, binding `DB`, local only)

```sql
CREATE TABLE guide_pages (page INTEGER PRIMARY KEY, text TEXT NOT NULL);
CREATE TABLE guide_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);           -- pages_sha256, loaded_at
CREATE TABLE ai_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, model TEXT NOT NULL,
  step TEXT NOT NULL, input_tokens INTEGER NOT NULL, cached_input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL, usd REAL NOT NULL, cad REAL NOT NULL, query_hash TEXT NOT NULL, ok INTEGER NOT NULL);
CREATE TABLE answer_cache (key TEXT PRIMARY KEY, at TEXT NOT NULL, answer_json TEXT NOT NULL);
```

## 8. Screens and copy (app)

Dark, stage-readable: 18 px base, body contrast ≥ 7:1, tap targets ≥ 44 × 44 px for everything you can tap or click
(buttons, links, example chips, filter pills, switches; static tags such as page pills and brand tags on rows may
be smaller, ≥ 24 px tall), system fonts, tabular numbers,
inline SVG icons (no emoji). The approved portfolio look: dark navy/slate base, glass surfaces with hairline
borders, soft shadows, a faint aurora at ~0.2 opacity, gradient wordmark "Tone Finder". Colour goes on data:
**teal** = from the guide (page pills, solid knob rings), **amber, dashed** = starting guess, **violet** = AI pick
(quotes checked), **slate** = general knowledge. Phone-first at 390, and 1280.

Header: wordmark, pill "Axe-Fx II XL+ · Ares", nav **Ask · Models · Binder**. Footer: "Every quote is checked
against yek's guide (rev. April 2017, written for Quantum 7.02). Page numbers are PDF pages."

- **Ask** (`index.html`): label "What tone are you after?", input placeholder "e.g. Van Halen brown sound", button
  "Find starting points". Example chips: "Van Halen brown sound", "clean worship pad with sparkle", "the rhythm
  tone on Master of Puppets", "Robben Ford", "AC30 chime", "djent". AI line from `/api/health`: "AI help: on ·
  CA$0.04 of CA$2.00 used" with a switch, or "AI help: off" (no switch when not configured). The query survives
  reloads via `?q=`.
  - Understood line: "Found in the guide: van halen, brown sound" and, if any, "Not in the guide: worship, pad"
    and, if any, "Words the AI added: metallica".
  - No support: heading "I can't point to the guide for that.", the unmatched words, and "Try an artist, an amp or
    a sound word, like “Plexi crunch”, “sparkly clean” or “Robben Ford”."
  - General knowledge box (slate): heading "General knowledge (AI) — not from the guide", the items.
  - AI drops: "The AI suggested N things we couldn't find in the guide, so they're not shown." with a
    disclosure listing each `{kind, detail}` in plain words ("Brown Sound Deluxe: not an Axe-Fx II model in the
    guide", "USA IIC+: quote not on page 12").
  - Ares: one quiet line under the results with the note and a "Sources" disclosure (both URLs + quotes).
- **Suggestion card**: unit name (≥ 28 px); header line "Based on <based_on> · pp. 28–31", or "Fractal Audio custom
  model (no real amp)" when based_on (or the section title, when based_on is null) starts with "FAS custom model";
  "Guide section: <section>" only when the unit name isn't one of the section title's name parts; source pill
  ("Guide search" or "AI pick · quotes checked"); **Why**: each quote as a blockquote with a teal left edge and **no
  added quote marks** (the verified text exactly, so the guide's own “ ” are never doubled), with a page pill "p. 60"
  and attribution ("yek" / "Cliff,
  quoted in the guide" / nothing when null); **Knobs**: seven SVG dials (0–10 sweep) with the value in ≥ 22 px
  type. Guide: solid teal ring + page pill. Guide rule: solid teal ring + "p. 12". Guess: dashed amber ring,
  the word "guess", and the visible sentence "starting guess — not from the guide" once under the dials whenever
  a guess is present (each guessed dial also carries it in its accessible name). Direction nudges listed under
  the dials: "Presence nudged up: “Turn up Presence in the Brit Brown model” p. 60". `taper_note` in small type.
  **Cab**: speaker and stock cab quotes with pages (hidden when both null and no notes). Ares flags as an amber
  callout. Buttons: "Model details" and "Add to binder" / "In binder".
- **Models** (`models.html`): "Filter by name" box; filter pill groups Brand (top 12 by count + "More brands"
  select), Power tubes, Master volume (Yes / No / Mixed / Unknown); "Showing 23 of 109"; rows show name, based
  on, brand pills, tubes, master volume, "pp. 28–31"; stub rows read "See Brit AFS100 and Brit Super" and link to
  the target. Filters live in the URL (`?brand=&tube=&mv=&q=`).
- **Model detail** (`model.html?id=`): name, section, based on, unit names, spec table (verbatim values, "Not in
  the guide" for null), synopsis, tips, settings (each with its knob chips and quote), directions, cab, notes;
  every item with its page pill. "Pages 28–31 in the guide." Unknown id: "No model with that id." + link to Models.
- **Binder** (`binder.html`): picks saved on the device (`localStorage` key `tf.binder.v1`, array of
  `{ query, suggestion, saved_at }`; wrap every access in try/catch), remove buttons, "Print". **Print** CSS: one
  page per ≤ 3 picks, white ground, black type, thin rules, no dark fills or aurora, no nav; per pick: the query,
  unit name, a seven-knob table (value + "guide p. N" / "rule p. 12" / "guess"), cab line, the first why quote
  with page, and a footer "From yek's guide to the Fractal Audio amp models (rev. April 2017). Guesses are not
  from the guide."

## 9. Fixtures, mock and fakes

- `app/api.mock.js` (`?mock=1`) follows §6 exactly; the lead diffs its JSON shapes against the real Worker. Its
  models and quotes are copied from the real `data/models.json` (`git show main:data/models.json` once tf1's data
  lands; before that, the §3.1 example is real and usable). Canned answers: the six example chips, a
  no-support answer for anything else, one answer with `general_knowledge` + `ai.dropped` (kinds
  `unknown_model` for "Brown Sound Deluxe" and `bad_page`), one card with all seven knobs guessed, one card with
  guide knobs + a direction nudge, and one card with a planted `ares_flags` entry whose quote starts
  `SAMPLE (test only):`. Mock mode shows a small "Demo data" pill.
- Fake OpenAI server (`worker/tests/fake-openai.mjs`, port `TF_FAKE_AI_PORT`): `POST /v1/chat/completions`,
  replies scripted per scenario (chosen by a word in the query, e.g. `fake-plant`), returns `usage`, counts
  requests (`GET /count`, `POST /reset`). Its canned quotes are short strings the tests choose, verified or
  deliberately broken; never page dumps.
