# Build report — tf1 (guide data, answer engine, AI step, Worker + D1)

## Round 7 (honest attribution)

**Status:** DONE. Code commit **8bc2a58**. From my own worktree, off your demo's ports: core **83/83** (fake AI on
8313), worker **16/16** (8322/8323/8372). `models.json` rebuilt with no changes: no stored quote opened with an
attribution. Thanks for correcting the round-6 count (6 calls, CA$0.0468, not my estimate of 2).

- **Leading attribution stripped.** `cleanCut` (core/text.js) now removes a leading "– Name " / "- Name ", using the
  same attribution names as the build's `SAID_BY` (exported as `ATTRIBUTION_NAMES`). It never strips a dash
  followed by a word that isn't a name ("– Cab Packs 5, 7" stays). Both paths call `cleanCut`: the AI citation
  path after locate and expand, and the engine's why path, which already cut leading names and now also goes
  through `cleanCut`. The cause on p. 188: "– Manual" is its own raw line, so it starts a box run, and the next line
  "Fractal Audio’s model…" doesn't. Expanding the citation to its sentence therefore brought the attribution along.
- **Tests.**
  - Fake scenario `fake-attrib` cites the exact p. 188 text "– Manual Fractal Audio’s model is based on channel 1
    (12AX7) with Master bypassed. It’s a favorite of many players, for clean tones with chime as well as crunchy
    work." Matchbox D-30 is kept as `ai_checked`, and its why quote starts "Fractal Audio’s model is based on
    channel 1…". A control checks the attribution really runs into the sentence on the page.
  - `quote-shape.mjs` now also flags a quote that starts with an attribution dash. It runs on every quote in
    `models.json`, every golden why quote and the fake-attrib answer.
  - A `cleanCut` unit test covers a known name, a lower-case "yek" with a hyphen, and a non-name that is kept.

| Control | Break | Result |
|---|---|---|
| lead-attrib | the leading-attribution replace removed from `cleanCut` | RED: fake-attrib (shown as "– Manual Fractal Audio’s model…") and the cleanCut unit test. Restored. |
| after restore | — | core 83/83, worker 16/16 |

Stopping here.

---

## Round 6 (fixes from the lead's final real AI pass)

**Read this first: my worker tests hit your running demo Worker once.** Your detached demo (main checkout, real
key) holds 8301/8302. `worker/tests/run.mjs` used 8302 by default. My `wrangler dev` couldn't bind it, the runner's
health wait was answered by your Worker, and the HTTP tests ran against it (7 of 16 failed, which is how I noticed).
Your `/api/health` went from the 20 calls / CA$0.1509 you reported to **22 calls / CA$0.1624**. So the run most
likely made **2 real calls, about CA$0.0115**, probably "Brown Sound Deluxe fake-plant" (pick + cite). Your cache
may also now hold answers for my test questions. My admin posts used the test token and were refused with 401, so
your guide and D1 pages are unchanged. I didn't touch your processes. **Fixed:** `run.mjs` now checks every port
(worker, fake, cap and their inspector ports) before starting anything and exits with "port(s) already in use: 8302
… Nothing was started or sent." I checked that on the busy default port: exit 1, and your call count stayed at 22.
Then the suite ran on 8322/8323/8372: 16/16, with your count still 22. Please add those 2 calls to `docs/spend.md`
if you track them.

**Status:** DONE. Code commit **b76eb03**. From my own worktree: core **81/81** (fake AI on 8313), worker **16/16**
(8322/8323/8372). `models.json` is unchanged.

1. **Locate, then verify (§5.5).** `core/text.js`:
   - `foldWithMap`: “ ” „ " → ", ‘ ’ ' → ', – — - → -, lower case, whitespace runs → one space, with a map back to
     the original offsets.
   - `locateQuote`: the exact first occurrence, else the folded citation when it occurs exactly once.
   - `expandToSentence`: the containing sentence(s) inside one box run, card label stripped, ≤ 320 characters and
     ≤ 2 sentences, else no expansion.

   `checkCitation` then does page range → locate → expand → clean cut → box-break check (falling back to the located
   text) → `verifyQuote`. The shown quote is always a slice of the page. `PROMPT_VERSION` is now `tf-ai-3`, so your
   cached demo answers are rebuilt.

   Fake scenario `fake-fold` (query "Van Halen brown sound fake-fold"):
   - The straight-quote, lower-case p. 60 synopsis is kept and shown as "Custom amp models by Fractal Audio,
     recreating EVH’s “Brown Sound”".
   - "Brawn" (one letter) and the same line cited on p. 61 drop as `quote_not_on_page`.
   - The p. 201 fragment "which produces an up front sparkling tone," is shown as its full sentence: "As the gain
     increases the tone is shifted from a treble and upper mid emphasis, which produces an up front sparkling tone,
     to a lower mid and bass emphasis, which produces a thick meaty tone."

   `fake-plant` and `fake-puppets` still pass: expansion stays inside the synopsis box, so the p. 28 quote is
   unchanged. Unit test: two folded matches → not located.
2. **Two-suggestion floor (§4.1).** When the 0.4 × top cut leaves one candidate, the next-best strong candidate is
   kept. "Van Halen brown sound" with AI off now gives Brit Brown and FAS Brown, then USA Clean / Lead / Rhythm
   (p. 265 "…replicate Van Halen’s Brown Sound…"). Golden: min_suggestions 2, top1 brit-brown, and none_of the '60
   brown Fenders all pass.
3. **Never the running header (§4.2).** A why candidate equal to a section title is rejected. Test: Tremolo Lux with
   the term "blackface" (p. 253 starts with its header) never returns the header, and no answer for three related
   queries shows a section title as a why quote.

| Control | Break | Result |
|---|---|---|
| locate | `checkCitation` default `locate = false` (exact match only) | RED: fake-fold. Restored. |
| header-why | the section-title rejection removed from `pickWhy` | RED: the Tremolo Lux header test. Restored. |
| floor | the two-suggestion floor removed | RED: golden "Van Halen brown sound" and the floor test. Restored. |
| port guard | default ports while your demo holds 8302 | Refused, exit 1, nothing started or sent (your call count unchanged). |
| after restore | — | core 81/81, worker 16/16 |

Stopping here.

---

## Round 5 (fixes from the lead's first real AI calls)

**Status:** DONE. Code commit **d85c4fb** (on top of main 89677e3). From my own worktree (fake AI on 8313 for core,
Worker on 8302/8303/8352): core **77/77**, worker **16/16**. `models.json` is unchanged from round 4.

1. **General knowledge about the guide is dropped (§5.6).** `sanitisePick` removes any item matching
   `/guide|candidate|provided|model list|the list/i` before it can be shown. The pick prompt now says "Never write
   general_knowledge about the guide, the guide candidates or the model list; only facts about songs, artists and
   gear." `PROMPT_VERSION` moved from `tf-ai-1` to `tf-ai-2`, so cached answers made with the old prompt aren't
   served. New fake scenario `fake-gk` sends three items: the real model's "The provided guide candidate points
   to…", "From the model list, Brit Brown fits best." and one real fact. Only the fact survives.
2. **`understood.matched_terms` and `ai_terms` are de-duplicated**, first occurrence kept. The AI's search terms
   repeat the query's own phrases, so the re-search found them twice. `fake-gk` asks "Van Halen brown sound master"
   with search terms ["van halen", "brown sound", "master"]; the test checks both lists have no repeats and that
   "master" appears once.

| Control | Break | Result |
|---|---|---|
| gk | the `GK_ABOUT_GUIDE` filter removed from `sanitisePick` | RED: fake-gk (all three items shown). Restored. |
| dedupe | `uniq` made a no-op | RED: fake-gk ("matched_terms repeat: van halen,brown sound,master,van halen,brown sound,master"). Restored. |
| after restore | — | core 77/77, worker 16/16 |

Stopping here.

---

## Round 4 (after the lead's grading of 01dce76)

**Status:** DONE. Code commit **63a6e85**. Numbers from my own worktree (fake AI on 8313 for core; Worker on
8302/8303/8352): core **75/75** (all 23 golden queries green with AI off), worker **16/16**. Quote budget 866 quotes,
68,920 of 540,437 characters (**12.75%**, down from 12.81%: header prefixes and page-number tails are gone).

### Done
1. **Running header and page-number footer are box breaks.** `boxBreaks(rawPage, titles)` adds a break after the
   page's first raw line when it is a section title, and a break before the last non-empty raw line when that line
   is only digits. `titleSet()` in `core/text.js` builds the title Set, and `sectionTitles(data)` in `core/models.js`
   caches it per `models.json`, adding the appendix headers by name. `spansBoxBreak` and `splitAtBoxBreaks` take the
   same optional `titles`. The build, the engine's why pool and span check, and the AI citation check all pass it.
   Callers without titles still get the footer break. Results: p. 108 now gives "The Edge’s famous amp is a ’64
   Top Boost AC30/6 model."; p. 270 gives "Quantum firmware 3.03 brought us the ”IIC++” model, also referred to as
   “Metallica’s IIC+” ."; p. 263's "…Crunch.” – MESA 262" splits off the page number and the attribution.
2. **Leading bullet trimmed** by `cleanCut`. ODS-100 for "clean worship pad with sparkle": "Bright: adds sparkle,
   less noticeable when the volume is turned up".
3. **Stock-cab lines are never why quotes.** They left the why pool, and page sentences containing the stock-cabs
   quote are rejected like controls lines. "Petrucci lead" → USA Clean / USA Lead / USA Rhythm, USA IIC+, USA Pre,
   with no Recto cab line.
4. **Tests.**
   - Box-break table: the p. 108 and p. 270 headers span with titles and not without them (control), the p. 263
     footer spans, and the p. 108 sentence without its header doesn't span.
   - `core/tests/quote-shape.mjs` flags a quote that starts with "•", carries the page's running-header prefix, or
     ends with the page's bare number. It runs on every quote in `models.json` and every golden why quote.
   - New engine test: "Petrucci lead" has no stock-cabs or "Cab Packs" why quote.
   - One build note: `build-models.mjs` already had a local `titleSet` (the TOC title set), so the new helper is
     imported as `makeTitleSet`. Before that rename, the first rebuild failed with a clear error.

### Negative controls (round 4, core on 8313)
| # | Break | Result |
|---|---|---|
| a | `checkQuote` returns ok first | RED: 8 tests (changed character, wrong page, 3 sentences, page range, fake-plant, curated quote stops the build, determinism). Restored. |
| d | generic words can be strong | RED: golden "lead tone", "the rhythm tone on Master of Puppets", AI fake-puppets. Restored. |
| i | stubs indexed as their own models | RED: golden never_ids, "Slash", "Steve Vai", AI fake-puppets. Restored. |
| box | `splitAtBoxBreaks` returns the quote unsplit | RED: 5 (split test, header/footer table, determinism, golden "The Edge chime", the Metallica sentence test: both now need the header split). Restored. |
| coverage | factor removed | RED: the exact 0.75 coverage test. Restored. |
| filler | filler words may not end an n-gram | RED: golden "Van Halen brown sound". Restored. |
| header (new) | the running-header break disabled (`const header = -1`) | RED: 7 (header/footer table, determinism, and golden Brown Sound Deluxe, Metallica, Robben Ford, The Edge chime and Twin Reverb clean, whose why quotes carried a header prefix). Restored. |
| after restore | — | core 75/75, worker 16/16 |

Nothing else is open on my side. Stopping here for your AI calls and final QA.

---

## Round 3 (after the lead's grading of 61f197a)

**Status:** DONE. All 23 golden queries pass with AI off. Numbers come from my own worktree (not `rig qa`: QA and
ports 8306–8309 now belong to the lead), with the fake AI on 8313 for core and the Worker on 8302/8303/8352:
core **73/73**, worker **16/16**, code commit **4a8b5b4**. The worker run printed HEAD 3741ec3 but ran against the uncommitted round-3 working tree, which is 4a8b5b4 minus the new coverage test in engine.test.mjs. The quote budget
is 866 quotes, 69,256 of 540,437 characters (12.81%). The 16:37 flake is explained by DECISIONS 19; I've stopped
using the QA worktree.

### Done
1. **Function vs filler words.** A filler word may end an n-gram but not start one. "Van Halen brown sound" now
   matches "van halen" + "brown sound" and shows only Brit Brown and FAS Brown (score 24.94). 6G4 Super and 6G12
   Concert are gone (golden `matched_includes` and `none_of` pass).
2. **Term frequency only for body-text hits.** "SRV Texas blues" → Super Verb first ("popular for the SRV sound",
   p. 241), then Capt Hook, Vibrato Verb and TX Star. Jr Blues and USA Sub Blues are gone.
3. **Coverage.** Final score × (0.5 + 0.5 × covered / found), counting non-generic terms. "The Edge chime" →
   Class-A 30W first (11.68), and Car Roamer drops to 4th (5.92 = 0.75 × its "chime"-only score).
   "edge of breakup blues" → Ruby Rocket only.
4. **Clean cuts.** `cleanCut` in `core/text.js` is applied to every box-break piece and attribution cut in the build
   and to every why candidate and clause cut in the engine. It only trims, then the result is verified again.
   PLEXI synopsis is now "Models of various Marshall Plexi heads"; Recto stock cabs end "… 13, 14, 21". The tests
   check that no quote in models.json and no golden why quote ends on , ; : or and/or/with.
5. **Which sentence first.** A why candidate that names the model (name, unit name, or a unit name's last word of
   3+ characters) ranks above one that doesn't, after the strong-term and synopsis/tips keys. "Metallica" → USA IIC+
   with the p. 270 "Metallica’s IIC+" sentence first (engine test).
6. **golden.test** supports `matched_includes` and `none_of`; all 23 queries are green.

### Reading I chose (please confirm or reject)
- **R3-1. Filler words and generic phrases.** Once filler words can end a phrase, "rhythm tone" becomes a found term.
  CA Tucana's tip says "a very modern heavy rhythm tone", which would make it strong (weight 3) and break golden
  "the rhythm tone on Master of Puppets". The engine therefore treats any n-gram as generic when its words, minus a
  leading "the" and minus filler words, are all generic words ("the rhythm", "rhythm tone", "lead tone"). That
  extends the R2-2 rule from "the" n-grams to filler words. It isn't written in §4.1 yet.

### Observed, not in the contract
- **R3-2. Running page headers glue onto the first sentence.** Every page starts with the section title line, and
  it has no full stop, so the first sentence of a page can read "Class-A 30W (VOX AC30) The Edge’s famous amp is a
  ’64 Top Boost AC30/6 model." (p. 108) or "USA IIC+ and USA IIC++ (MESA/Boogie Mark IIC+) Quantum firmware 3.03
  brought us…" (p. 270). It's an exact substring and not misleading, just noisy. A fix in the same spirit as box
  breaks: treat the break after the page's first raw line as a box break when that line equals the section title.
  Your call.

### Negative controls (round 3, core suite on 8313)
| # | Break | Result |
|---|---|---|
| a | `checkQuote` returns ok first | RED: 8 tests (changed character, wrong page, 3 sentences, page range, fake-plant, curated quote stopping the build, determinism). Restored. |
| d | generic words can be strong | RED: golden "lead tone", "the rhythm tone on Master of Puppets", AI fake-puppets. Restored. |
| i | search indexes stubs as their own models | RED: golden never_ids, "Slash", "Steve Vai", AI fake-puppets. Restored. |
| box | `splitAtBoxBreaks` returns the quote unsplit | RED: the split test and build determinism (the engine's own spansBoxBreak rejection still keeps splices out of answers). Restored. |
| coverage (first try) | coverage factor removed | **VOID**: 72/72 still passed. Body-only term frequency alone already puts Class-A 30W over Car Roamer (7.89 vs 11.68) and Super Verb first, so no golden query depended on coverage. Test gap, fixed: new engine test asserts Car Roamer's "The Edge chime" score is exactly 0.75 × its "chime" score. |
| coverage (retry) | same break | RED: the new coverage test ("7.89 vs 0.75 × 7.89"). Restored, 73/73. |
| filler | filler words treated as function words at the end of an n-gram | RED: golden "Van Halen brown sound" (matched_includes "brown sound"). Restored. |
| after restore | — | core 73/73, worker 16/16 |

---

# Round 2

## Round 2 (after the lead's review of 80f4ccb)

**Status:** DONE except one golden expectation I couldn't meet under the contract's scoring (question R2-1). Code
commit 61f197a. QA from `rig qa --ref 61f197a` (fake 8307 / worker 8308 / cap 8358): `npm run test:worker` **16/16**; `npm run test:core` **67/68** (the one red is golden "The Edge chime", R2-1), quote budget 866 quotes, 69,267 of 540,437 characters (12.82%). Honest note: the first core run in that worktree gave 57/69, with all 11 AI-suite tests failing in about 0.1 ms (the fake server's `before` hook, which binds 8307). An immediate rerun in the same worktree at the same sha gave the AI suite 10/10 and the core suite 67/68, and nothing was listening on 8307 when I checked. Most likely something else held 8307 briefly (another QA run?); not proven.

### Contract answers applied
- `ai.reason` is `null` on a fresh successful AI run (was `"ok"`). Answer.query echoes the query trimmed as typed.
- Golden's six stubs are asserted exactly (the special case for Dweezil’s B-man is gone). Stop words and
  `taper_note { quote, page }` as adopted.

### Box breaks: DONE
- `core/text.js`: `boxBreaks(rawPage)`, `spansBoxBreak(quote, rawPage)`, plus `splitAtBoxBreaks` (shortens only)
  and `cutAttribution` (trailing " – Name" → `said_by`; a leading "– Name" is removed).
- Build: every stored quote is split when picked; 21 got shorter. The curated JD Simo settings (p. 31) spanned a
  bullet break, so the build refused it; it's now "Bass:0, Mid:10, Treble:10, Volume:10". All the known defects
  are gone: 1987X p. 33, Band-Commander p. 45, Dizzy V4 p. 134, Dirty Shirley tip p. 125 (now ends
  "…master to taste”", said_by "Manual").
- Engine: page sentences are split at breaks before they become why candidates, and a candidate that still spans
  a break is rejected. Super Verb p. 242, JMPre-1 p. 175 and Hipower p. 168 no longer splice.
- AI: a citation that spans a break is dropped as `quote_not_on_page`. New fake scenario `fake-span` cites the exact
  p. 28 splice: the drops are `quote_not_on_page` and then `no_verified_quote`.
- Tests: `core/tests/boxbreaks.test.mjs` has the §4.2 six-case table (plus a control that each string really is on
  its page), a break offset check on all 301 pages, the split and attribution helpers, and a check that none of the
  866 quotes in models.json spans a break or ends with an attribution. Golden `no_why_spans_box_break` is checked
  on every golden answer.

### Quality: DONE
- Score × (1 + ln(hits)). "Metallica" now puts USA IIC+ first (golden green).
- Word variants: "sparkly clean" gives 4 cards, all quoting "sparkling clean" (golden `min_suggestions` 2 green).
- "the" n-grams: allowed when "The X" occurs with a capital T not at a sentence start. Matching and hits for such a
  term use that capitalised form, so Ruby Rocket's "edge-of-breakup" no longer counts.
- Why quality: the first quote needs a strong term; the 2nd and 3rd need a strong term or must come from synopsis
  or tips. Controls lines are never offered, and spec-table lines are rejected. A quote already shown under an
  earlier card is skipped when the model has another usable sentence. A sentence over 320 characters is cut after
  the clause holding the term, so it still starts at the sentence start; mid-sentence clause cuts are gone. A
  candidate left with no why quote after these rules is dropped and ranks are renumbered.
- Nudges: up → max(guess, 7), down → min(guess, 3). The direction is still attached when the value doesn't move
  (clean Drive 2.5 with "keep Drive low" stays 2.5 and shows the tip).
- Golden: 20 of 21 queries green with AI off; `min_suggestions` and `no_why_spans_box_break` supported.

### Contract questions (round 2)
- **R2-1. "The Edge chime" can't put Class-A 30W first under §4.1 as written.** Found terms: "the edge" (df 3)
  and "chime" (df 8). Car Roamer: "chime" in its synopsis (weight 3) with 2 hits on its pages → 2.63 × 3 × (1 + ln 2)
  = **13.36**. Class-A 30W: "The Edge" twice and "chime" once, both only in page text (weight 1). Its stored
  synopsis is just "Four models of a VOX AC30:" → 3.57 × 1 × 1.5 × (1 + ln 2) + 2.63 = **11.68**. Class-A 30W
  comes second, Deluxe Tweed ("Fender’s The Edge Deluxe amp") third. The engine isn't bent to pass. Options if you
  want Class-A 30W first: weight a proper-name term above a single common word (for example ×2 for a "the" n-gram),
  or count a multi-word proper name as weight 3 when it names the amp's owner. Either one is your call to put in §4.1.
- **R2-2. "the" + generic word.** "the rhythm tone on Master of Puppets" found "the rhythm" (a capitalised
  "The Rhythm" occurs mid-sentence), which made a generic word strong and broke golden. The engine treats a "the"
  n-gram as generic when all its other words are generic. Please add that sentence to §4.1.
- **R2-3. Drop detail wording.** §5.5 says "the model or unit name, and the page". The engine sends
  `"1959SLP, p. 60"`; tf2's mock has `"USA IIC+: page 12"`. One format should go in the contract; I suggest
  `"<unit name>, p. <n>"`, or just the name for `unknown_model` / `no_verified_quote`.
- **R2-4 (quality, not contract).** For "Metallica" the USA IIC+ why quote is "Add Santana, Metallica, Keith Richards
  etc." (p. 267, the first sentence in guide order), not the stronger p. 270 "Metallica’s IIC+" line. §4.2 has no
  rule that prefers one weight-1 sentence over another. If you want one: prefer the sentence where the term sits
  next to the model's unit name.

### Cross-review of tf2 (rig/tf2 at 89bba5f; no tf2 files edited)
Shapes, checked by running tf2's `app/tests/shape.mjs` on the mock and by diffing key paths against my engine's
answers for the same queries:
1. **`taper_note` has an extra `id` key** in every mock card (`id, quote, page`). The contract is exactly
   `{ quote, page }`.
2. **Drop detail wording differs** (R2-3): mock `"USA IIC+: page 12"`, real `"1959SLP, p. 60"`. If the app parses
   the detail, it will break on real data.
3. **Mock `ares_flags[].page` is `null` on a `where: "why"` flag.** The real engine sets the why quote's page there
   (null only for `where: "ai"`).
4. **Mock `app/mock/models.json` is pre data-ready.** Its `pages_sha256` differs from the real one, and 102 of 109
   models differ in content. Every mock model has `controls: null`, empty `cab.notes` and empty `notes`, while the
   real file fills them (key paths only in real: `controls.quote/page`, `cab.notes[]`, `notes[]` with `said_by`).
   The Model detail page is untested against notes and cab notes. tf2's brief step 3 (copy from main) looks not done.
5. **Mock canned answers predate round 2.** Mock "van halen brown sound" shows a `"brown sound"` matched term;
   the real engine can't produce that ("sound" is a stop word, so the 2-gram is never formed). Real answers for the
   mock's own queries now: Van Halen → Brit Brown, PVH 6160 Block, PVH 6106+, 6G4 Super; clean worship pad →
   Capt Hook, AC-20, Bludojai, ODS-100; AC30 chime → Class-A 30W, Class-A 15W TB; JTM 45 → Brit JM45, Dirty Shirley.
6. **Mock `off` variants are `null`** for six of seven queries. tf2's shape checker reports them as missing every key
   if iterated. Harmless in the app if it only reads `on`, but worth a guard.
7. Mock nudges `Bass 3 down` and `Presence 7 up` already match the new §4.3.5 rule. `ai.reason` null on used runs
   matches.

Live: tf2's shape checker against my Worker (scratch state, fake AI on 8303, guide loaded by
`scripts/load-guide.mjs`) reported **no problems** for `/api/health`, `/api/models`,
`/api/models?brand=Marshall&mv=no`, `/api/models/1959slp`, the 404 error body, and four `/api/ask` answers:
"Van Halen brown sound" (ok, AI used, 4 cards), "banjo through a toaster" (no support), "…Master of Puppets
fake-puppets" (ok, 2 cards) and "Brown Sound Deluxe fake-plant" (ok, 4 cards).

### Demo against tf2's real app: DONE
`npm run demo` logic with tf2's own `app/` from `git archive rig/tf2 app` (untracked copy under
`worker/.wrangler/`): migrations applied, 301 pages loaded (sha256 6a0b9d75…), "Open http://127.0.0.1:8301/"; GET /
→ 200 with `<meta name="api-base" content="http://127.0.0.1:8302">`; the Worker answered with
`Access-Control-Allow-Origin: *`; Ctrl+C left 8301 and 8302 free. Not driven in a browser (tf2 / QA).

### Negative controls (round 2)
| # | Break | Result |
|---|---|---|
| a | `checkQuote` returns ok first | RED: 9 tests (changed character, wrong page, 3 sentences, page range, fake-plant, curated quote stopping the build, determinism). Restored. |
| d | generic words can be strong | RED: golden "lead tone", "the rhythm tone on Master of Puppets", and AI fake-puppets. Restored. |
| i | search indexes stubs as their own models | RED: golden never_ids, "Slash", "Steve Vai". Restored. |
| box | `splitAtBoxBreaks` returns the quote unsplit | RED: the split test and build determinism (a rebuild keeps the p. 28, 33 and 125 splices). The golden no-span check stayed green, because the engine also rejects any candidate that spans a break, so there are two layers of protection. Restored. |
| after restore | — | core 67/68 (only R2-1), worker 16/16 |

---

# Round 1

**data ready** — `data/models.json` (109 models, schema 1) is committed on `rig/tf1` with `data/curation.json`,
`core/models.js`, `core/brands.js`, `core/labels.js`, `scripts/build-models.mjs`, `core/tests/models.test.mjs` and
`docs/DATA.md`. Ready for tf2's cross-review of the shapes.

**All six steps DONE.** QA numbers from `rig qa --ref e8e456d` (QA worktree, ports fake 8307 / worker 8308 / cap
8358): `npm run test:core` **56/56**, quote budget 876 quotes, 70,042 of 540,437 characters (12.96%);
`npm run test:worker` **16/16**.

## Contract questions

1. **Dweezil’s B-man is a stub by §0, but golden `stub_ids` leaves it out.** p. 139 holds only "Please refer to
   the section on the 65 Bassguy model." The data marks it `refers_to: "65-bassguy"`. Without that it would be a
   suggestable model with no quotes of its own. `models.test.mjs` asserts golden's five stubs exactly and names this
   one extra explicitly. Suggest adding `"dweezils-b-man": "65-bassguy"` to `stub_ids`/`stub_targets`/`never_ids`.
2. **The §4.1 stop list is missing some function words.** With the list as written, "banjo through a toaster"
   finds `through` in the tips/synopsis (weight 3) of Euro Blue and Tube Pre, so `through` counts as strong and
   the answer is `ok`, against golden. `core/search.js` adds `EXTRA_STOP_WORDS` = through into onto over under
   about via as or but than, kept in one place so the lead can adopt or drop it.
3. **`taper_note` shape.** §4.3.7 says "the taper-match convention quote (p. 12)" and the §6 example shows
   `null`. The engine emits `{ "quote": "…", "page": 12 }` or `null`. tf2's mock should use the same.

## Step 1 — Foundations: DONE (c346d2f)

`core/text.js` (`normText`, `splitSentences`, `findWholeWord`), `core/guide.js` (`parsePages`, `pageText`,
`pagesSha256Input`, `pagesSha256`), `core/verify.js` (`verifyQuote` / `checkQuote` with a reason),
`core/tests/foundations.test.mjs` on the real guide: the API.md example quotes verify; one changed character fails;
the 1959SLP synopsis against p. 29 fails; a real 3-sentence passage from p. 12 fails (its first two sentences pass);
321 characters fails while 320 of the same text passes the length rule; pages 0, 302, 28.5 and "28" fail; a missing
`TF_GUIDE_DIR` makes a child process exit non-zero with `guide not found at /nonexistent-tf-guide/yek-guide-fulltext.txt`.
The test file itself loads the guide at top level, so a missing guide fails the run rather than skipping.

## Step 2 — Data: DONE

See `docs/DATA.md` for method, counts and what was left out. `core/tests/models.test.mjs`: rules 1–7, golden
`model_count`, `ids_must_exist`, `names_resolve_to` (all 110 names), `names_never`, `stub_ids`/`stub_targets`,
determinism against the committed file, and a curated quote with one changed word stopping the build.
Quote budget printed: 876 quotes, 70,042 of 540,437 characters (12.96%).

## Step 3 — Engine: DONE

`core/search.js` (§4.1 terms, n-grams, weights, df/idf, strong terms, candidates, intent), `core/answer.js`
(§4.2 why picking, unit name, suggestion and Answer shape), `core/knobs.js` (§4.3), `core/ares.js` (§4.5).
`core/tests/golden.test.mjs` runs all 15 golden queries with AI off and checks every expectation plus invariants
(never_ids, 1–3 verified why quotes, unit name belongs to the model, seven knobs in order, no-support shape);
`core/tests/engine.test.mjs`: guide knobs with the quote (1959SLP Bass 2), guide_rule Master 10 with the p. 12
quote, a no-settings model gives seven guesses with the exact note, the Brit Brown "Turn up Presence" tip nudges
the Presence guess to 7 while 1959SLP's Bass/Mid/Treble directions leave its guide values alone, clamping, the
same-unit-name settings pick, `pages: null` answers from stored quotes only, the planted "SAMPLE (test only): add
Transformer Grind" tip gives exactly one `ares_flags` entry (and the unplanted data none), and `ares` deep-equals
§4.5 (and the lead's `data/sources` quotes).

Engine choices worth knowing:
- `understood.unmatched_terms` lists unconsumed non-stop, non-generic single words (not every zero-df n-gram).
- With pages loaded, every why quote is re-verified at answer time; with `pages: null` only stored quotes are used.
- `ai.reason` is `"ok"` when the AI step ran fresh (§5 names only the not-used reasons and `"cached"`).

## Step 4 — AI step: DONE

`core/ai.js`: pick → re-search with `search_terms` → cite → verify (page inside the model, then `verifyQuote`;
too long / 3 sentences → `quote_too_long`) → merge, with the §5.8 estimate before each call, `ai_calls` rows via an
injected store, the §5.9 cache key, and `error` on HTTP error, timeout, bad JSON or a thrown fetch. Errors carry a
code only. `worker/tests/fake-openai.mjs`: scenarios by word, `/count`, `/reset`, `/last` (request shape, never the
key). `core/tests/ai.test.mjs` (fake on 8303): fake-plant keeps only (i) and lists the four drops; fake-puppets gives
USA IIC+ `ai_checked` with the p. 270 quote and labelled general knowledge; cap below the estimate → `spend_cap` and
0 requests (also with a store already at CA$1.999); cache hit → count unchanged, `cost_cad: 0`; fake 500 and bad
JSON → `error` with the same suggestions as the guide search; off / no_key / guide_not_loaded → 0 requests; request
shape; spend math; a key-bearing thrown fetch error and an unreachable base URL never put the key in any Answer.

## Step 5 — Worker: DONE

`worker/wrangler.toml` (name `tone-finder`, `main = "src/index.js"`, `compatibility_date = "2026-09-01"` — the bundled
workerd is 1.20260911 — D1 `DB` / `tone-finder` / `LOCAL-ONLY-set-at-deploy`, non-secret `[vars]` defaults),
`migrations/0001_init.sql` (§7), `src/index.js` (§6 routes, CORS + OPTIONS 204, D1 spend/cache store, guide pages
cached per isolate and keyed by the stored SHA, `models.json` imported as JSON, 500s never echo internals),
`.dev.vars.example`, my gitignored `.dev.vars`, `package.json` (`dev`, `migrate:local`, `test`).
`tests/run.mjs` wipes and migrates `.wrangler/test-state` and `.wrangler/test-state-cap`, starts the fake and two
`wrangler dev --local` instances (8302, and 8352 with `AI_CAP_CAD:0.0001`; `TF_WORKER_CAP_PORT` overrides), waits for
health, runs `node --test tests/`, and kills the process groups it started (ports checked free afterwards).
`WRANGLER_SEND_METRICS=false` on every wrangler call. `tests/api.test.mjs`: 16/16, covering every item in the brief,
plus a same-length wrong token, blank / missing / non-string / non-JSON queries, the 200-character edge, admin spend
rows, and that `test-key` and the admin token never appear in any response body.

## Step 6 — Scripts: DONE

- `scripts/load-guide.mjs`: reads `worker/.dev.vars` (real env wins), posts pages 1–301, prints
  `Loaded 301 pages into <url> (sha256 …)`. Errors print only the HTTP status and error code: a dead Worker gives
  "could not reach the Worker at http://127.0.0.1:8399 (is it running?)" (81 bytes of output), a bad
  `TF_GUIDE_DIR` gives `guide not found at …`; both exit 1.
- `scripts/demo.mjs`: applies local migrations, starts the Worker (8302) and `node app/serve.mjs --port 8301`,
  waits for both, loads the guide, prints "Open http://127.0.0.1:8301/". Checked with a throwaway app server
  (`TF_APP_SERVE`, a test hook only, because `app/serve.mjs` is tf2's and not in this tree): health said
  `loaded: true, sha_ok: true`, the app answered 200, Ctrl+C left 8301/8302 free; killing the app printed
  "demo: app stopped (SIGTERM); stopping the rest." and both ports were free 5 s later. No guide text in either log.
  Not yet run against tf2's real `app/serve.mjs`.

## Negative controls

| # | Break | Expected red | Result |
|---|---|---|---|
| a (core) | `checkQuote` returns `{ ok: true }` first | changed-character tests | RED: 5 tests failed (changed character, wrong page, 3 sentences, 321 chars, page 0/302). Restored with `git checkout`, 11/11 green. |
| a (AI) | same break | fake-plant changed-character citation | RED: fake-plant failed (the "Plexy" citation survived). Restored, 9/9. |
| b | `checkPick` accepts any unit name (`\|\| p.unit_name`) | "Brown Sound Deluxe" test | RED: fake-plant failed. Restored, 9/9. |
| c | citation page range check removed | `bad_page` test | RED: fake-plant failed (the p. 60 quote survived for 1959SLP). Restored, 9/9. |
| d | generic words can be strong | golden "Master of Puppets", "lead tone" | RED: exactly those two failed. Restored, 16/16. |
| e | `if (spent + est > p.cap)` → `if (false)` | zero-request cap test | RED: cap test failed. Restored, 9/9. |
| i | search indexes stubs as their own models | golden `never_ids` | RED: never_ids test + golden "Slash" and "Steve Vai" (stubs outranked their targets). Restored, 16/16. |
| h (first try) | final comparison in `authorised()` → `return true` | 401 test | **VOID**: 16/16 still passed. The test only sent no token and "nope", which the length check refuses before the comparison. Test gap, fixed: a same-length wrong token is now sent to both admin routes (f23b0f7). |
| h | (h1) the same break again; (h2) `authorised()` returns `true` on its first line | 401 test | RED both times: the 401 test and the 400/409 test (the refused post had loaded nothing; with the check gone it loads). Restored with `git checkout`, 16/16. |
| f | one model spliced out of `data/models.json` | count/order test | RED: both rule 1 tests + 3 others. Restored from backup, 11/11 green. |
| g | `QUOTE_BUDGET` 0.15 → 0.01 | budget test | RED: "quote budget 0.1296 > 0.01". Restored, 11/11 green. |

## Cross-slice needs

- tf2: `scripts/demo.mjs` runs `node app/serve.mjs --port 8301` from the repo root and waits for `GET /` to answer
  200. Please keep that contract.
- tf2 mock: `taper_note` is `{ quote, page }` or `null` (Contract question 3); `ai.reason` is `"ok"` on a fresh AI
  answer; drop details read `"1959SLP, p. 60"` (unit name, page) or just the name for `unknown_model` /
  `no_verified_quote`.

## Left undone

- Nothing in the brief is left out. Not run by me: the demo against tf2's real `app/serve.mjs`, and any real AI
  call (the lead's, under the CA$2 cap).
