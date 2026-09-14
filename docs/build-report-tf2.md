# Build report — tf2 (app)

**mock ready, rebuilt from real data** — `app/mock/models.json` is main's `data/models.json` (at `89677e3`,
byte-identical models array), and `app/mock/answers.json` holds canned Answers built from it. **Round 3 done (A–D).
Stopped.** When tf1's next data lands, rebuild with
`git show main:data/models.json > <scratch> && node app/tools/build-mock.mjs --models <scratch>`.

## Round 3

Commits: A `4922cad` · B `7b895e0` · C `f62faea` · C catch-up `241bc68` · D (this commit: shots + report).

**Suite at `241bc68`, from my own worktree (clean tree), chromium + webkit at 390 and 1280: 182 passed, 114
skipped.** The skips are by design: the run-once data and server specs (serve, quotes, shape) on the other three
projects, the phone spec on the desktop projects, and the live spec. These are not QA-worktree numbers.

| Step | What changed | Status |
|---|---|---|
| A | Every quote is a `<blockquote>` with a teal left edge showing the verified text exactly, with no added marks. That covers why, tips, notes, settings, synopsis, cab speaker, stock cabs and notes, direction nudges, the taper note, the Ares flag, Ares sources, binder picks and print. Print uses a 1 pt black left rule. `expectQuotesExact()` checks every rendered quote on Ask (all six chips and "JTM 45"), Model detail (three models), and the Binder on screen and in print. Each quote's text must equal a verified fixture quote, with no `<q>`, no CSS `::before`/`::after` marks, and a left edge. The edge colour is also checked: teal on screen, black in print. | DONE |
| B | The §4.2 box-break rule on raw line breaks replaces my inline-quote heuristic: `boxRuns`, `boxBreaks`, `spansBoxBreak` and `splitAtBoxBreaks` in `app/tools/guide-text.mjs`. The builder cuts picked quotes at box breaks, cuts a trailing " – Name" into `said_by`, and refuses any quote that spans a break or ends with an attribution. `quotes.spec.mjs` checks four things: the contract's six-case table (each quote first confirmed on its page, so "doesn't span" can't pass for the wrong reason); box-break offsets on all 301 pages; that no fixture quote spans a break; and that no fixture quote ends with an attribution. Also from the contract diff: the nudge rule (up → at least 7, down → at most 3), `taper_note` as exactly `{quote, page}`, and eleven more stop words. | DONE |
| C | Mock rebuilt from main's `data/models.json`: 109 models, 6 stubs, 205 unit names, 872 stored quotes. Canned answers rebuilt from it; shape, quotes and the whole suite are green. Catch-up with later contract commits (`8b7de73` … `89677e3`): drop detail is `"<unit name>, p. <n>"`, handled in the fixture, the plain-words parser (which still reads the old form) and a new shape rule. Also clean cuts (no leading bullet; no trailing `, ; :` or dangling and/or/with), card-label boxes never becoming why quotes, and why sentences that name the model coming first. | DONE |
| D | Shots retaken, plus `ask-after-search-1280`; looked at (below). | DONE |

### How step C actually went (main moved under me)

- **Before the rebuild I measured main's data (`fb08bd1` era).** 16 stored quotes spanned a box break and 1 ended
  with "– Manual", so I added `--drop-spanning` to `build-mock.mjs` to list and drop such quotes.
- **tf1's round 2 was merged (`3741ec3`) before the rebuild ran.** The `--models` build then found nothing to drop,
  and I first misread that as a builder bug. Rechecked: main's data at `3741ec3` and at `89677e3` has 0 unverified
  quotes, 0 spanning a box break, 0 attribution tails and 0 starting with a card label. So the committed mock drops
  nothing, and `--drop-spanning` stays available but unused.
- **The rebuild exposed one real mock defect,** in my canned answers rather than tf1's data. Three why quotes
  started with a card label: Bludojai "Amp controls Volume (=Input Drive)…", and Brit JM45 "Clips Marshall JTM-45…"
  and "Amp controls Presence, Bass…". The builder now skips pieces that start with a card label, and they're gone.
  Bludojai's first why is now p. 50 "“The Bludojai is a Robben Ford voiced amp."; Brit JM45 cites p. 62 "…a vintage
  JTM 45 is worth a lot…".

### Negative controls, round 3 (each made red once, restored with `git checkout`, rerun green)

Each control printed its `git diff --stat` before running.

| # | Break | Test | Red with | Restored |
|---|---|---|---|---|
| A | `quoteHtml` wraps the text in “ ” again | quotes are blockquotes with a teal edge… (chromium-390) | `not exactly a verified quote: "“Eddie van Halen’s legendary “Brown Sound” …”"` (10 problems) | green |
| B | the glued 1959SLP tip planted in `models.json` (kept from round 2) | no quote in app/mock/models.json spans a box break | `$.models[6].tips[3] p. 28: Or just crank everything, like Eddie Van Halen “My settings…` | green |
| B | `spansBoxBreak` always returns false | §4.2 table (6 tests) | the three "spans" cases: `Expected: true, Received: false` | green (6 passed) |
| B | a tip ending "– yek" planted in `models.json` | same fixture test | `$.models[81].tips[2]: Turn up Treble a lot to make it less dark – yek` | green |
| C | drop detail put back to `"USA IIC+: page 12"` | every fixture answer has the §6 Answer shape | `answer.ai.dropped[1].detail: "USA IIC+: page 12" (want "<unit name>, p. <n>" for bad_page)` | green |
| C | a quote ending "re-issue," planted in `models.json` | no quote in app/mock/models.json spans… (clean-cut assertion) | `$.models[6].tips[4]: Models of a 100 watt Superlead Plexi re-issue,` | green |

My first B run failed on my own test, not on data. The attribution check used a loose regex (" – " + capitalised
words at the end) and flagged stock-cab list lines like "3x10 Vibrato King – Cab Pack". It now uses the builder's
`cutAttribution()` (known attribution names), and the planted "– yek" control proves it still catches a real one.

### Cross-check of box breaks with tf1 (main `89677e3`)

A scratchpad script (outside git) loads `main:core/text.js` and `main:core/guide.js` via `git show`:

- **`boxBreaks`, all 301 pages:** tf1 and tf2 are identical on every page.
- **`spansBoxBreak`, 974 quotes** (every fixture quote plus the six-case table): 0 disagreements.
- **Fixture quotes under tf1's function:** 0 of 968 span a box break.

The contract now also counts the running page header and the printed page number as box breaks (`8b7de73`). My copy
doesn't implement those, and tf1's `boxBreaks` on main gives the same offsets as mine, so they make no difference
between us today. I haven't checked whether tf1 applies them elsewhere. My branch doesn't carry `core/`, so the
builder keeps its copy rather than importing tf1's. If the lead merges main into `rig/tf2`, the builder can switch to
`core/text.js`.

### What the round 3 shots showed

- **`ask-after-search-390`:** the summary line is at the top, then "Found in the guide", then the Brit Brown card
  and its first quote as a blockquote with a teal edge. The guide's own “Brown Sound” marks appear once, and the
  quote no longer begins or ends with a doubled mark.
- **`ask-results-1280`:** two columns.
  - Brit Brown has seven dashed amber dials, the nudge "Presence nudged up:" above its quote (p. 60), and two cab
    notes from tf1's data (p. 61).
  - 1959SLP has guide Bass/Mid/Treble p. 28, Master rule p. 12, the taper note as a small blockquote, and speaker,
    stock cabs and two cab notes.
- **`ask-ac30-390`:** "Guide section: Class-A 30W (VOX AC30)"; the Ares flag's "SAMPLE (test only)" text in a small
  blockquote; stock-cab and notes quotes with pages.
  - **Weaker than before:** the Class-A 30W TB card's why quotes are now the synopsis unit lines ("Class-A 30W: Normal
    channel of a non-Top Boost AC30"), which match "ac30" but not "chime". The p. 108 "VOX “chime”" sentence isn't
    offered in these fixtures any more. That's honest (both quotes verify and match a term), but I'd rather show the
    chime line.
- **`model-detail-390`:** controls, tips, settings (including "JD Simo’s Settings:" p. 31 from tf1's data),
  directions (Bass down, Mid up, Treble up), cab and notes ("Marshall, quoted in the guide") are all blockquotes.
  Tips that begin or end with the guide's own mark ("“My settings…", "…to taste.”") show that single mark, as
  verified.
- **Binder, screen and print:** picks with teal-edged cab and why quotes on screen. In print everything is black on
  white with a thin black left rule and the footer.
- **Left as is:** `model.html`'s header still reads "Section: … · based on …" (§8 lists name, section, based on for
  the detail page, so it matches the contract).

## Contract questions (round 3)

1. **Box-break false positives in prose?** Measuring the rule on main's earlier data flagged some quotes whose raw
   line happens to start with an ordinary quoted phrase inside a sentence: p. 39 "…intimate and “small” in a good
   way.", p. 42 "…reproduces the “brown sound” of…", p. 203 "…heads, “the world’s greatest rock amp”". Splitting
   there only shortens a quote, so it's safe, but it can cost a good sentence. tf1's current data has none, so this
   is a note, not a blocker.

## Contract questions (round 2) — answered by the lead in round 3

1. The joined-passage rule and card header are in API.md on main (I had read `5c164a8`). DONE.
2. The inline-quote heuristic is replaced by the contract's box-break rule. DONE (step B).
3. Mock unit names are now tf1's (205). DONE (step C).

## Contract questions (round 2)

1. **The joined-passage rule and the new card header aren't in the contract on main.** At `5c164a8`, `docs/API.md`
   §4.2 has no joined-passage rule, and §8 still says the card shows "Section: … · based on …". I built B and C from
   the lead's round-2 message. Please add both to API.md so tf1 builds to the same rule.
2. **The literal join rule would damage good quotes, so I refined it. Please confirm, or pick another definition.**
   - **Opening-quote rule.** `/(?<=[A-Za-z0-9,]) (?=“)/` also matches short quoted words inside one passage, like
     "legendary “Brown Sound” probably is…" (p. 60) and "for a “typical” Plexi tone" (p. 28). Splitting there
     would cut real sentences in half. My rule splits before “ only when it opens a new passage: no closing ” within
     3 words, or another “ before it closes. In the fixtures, 48 quotes (29 in models.json, 19 in answers.json)
     contain such a short inline phrase and are kept whole.
   - **Dash rule.** " – " + a capitalised word also matches list separators, like "Marshall stock cabs – Cab Packs".
     My rule counts the dash only right after a closing quote mark or sentence punctuation ("…to taste.” – Cliff").
   - **Where it lives.** The definition is `joinPoints()` in `app/tools/guide-text.mjs`, with unit cases in
     `app/tests/quotes.spec.mjs`. tf1's engine needs the same definition, or the mock and the Worker will quote
     differently.
3. **Mock unit names are still rough before data lands.** The builder takes them only from section titles and
   synopsis bullets, so for example `fas-custom-models` has the unit name "FAS custom models". Real data replaces this.

### Round 1 questions — answered by the lead (`5c164a8`, DECISIONS #13)

| # | Question | Answer | Status |
|---|---|---|---|
| 1 | `ai.reason` for a fresh successful run | `null` (the mock already did this) | DONE |
| 2 | 44 px for static pills? | Only for what you can tap; static tags ≥ 24 px tall | DONE (step A) |
| 3 | Dweezil's B-man a stub? | Yes, → `65-bassguy`; golden now has six stubs | DONE (mock already had six) |
| 4 | `Answer.query` echo | Trimmed, as typed | DONE (unchanged) |

## Round 2 (lead's list A–I)

Commits in order: A `dbc3c46` · B `cd51aa8` · E `a0feb44` · H `89bba5f` · C `7c23a37` · D `2ad1c44` · shots +
report (this commit). The suite ran green on the full tree before each group of commits; the individual commits
were not each re-run on their own.

**Suite at `2ad1c44`, from my own worktree (clean tree), chromium + webkit at 390 and 1280: 168 passed,
96 skipped.** The skips are the run-once data and server specs on the other three projects (serve, quotes and
shape run on chromium-1280 only), the phone spec on the desktop projects, and the live spec. These are not
QA-worktree numbers.

| Step | What changed | Status |
|---|---|---|
| A | Page, source and brand pills are static tags at 28 px (unit and demo pills 32 px). The hit test now covers only what you can tap: `button, a[href], .chip, summary, label.switch, select` and text inputs; a switch is measured by its label. A new check keeps static tags ≥ 24 px tall on the same 6 page states. | DONE |
| B | `app/tools/guide-text.mjs` holds parsing, the §0 check and passage splitting. The builder cuts joined passages everywhere it picks a quote (page sentences, tips, synopsis, cab fields) and refuses any joined quote (`Q()` dies). `quotes.spec.mjs` checks that no quote in either fixture is joined, plus unit cases. 1959SLP's quotes are now "Or just crank everything, like Eddie Van Halen" and, separately, "“My settings for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5." Its Van Halen card cites p. 29 and p. 30 instead. | DONE |
| C | Card header: "Based on <based_on> · pp. N–M"; "Fractal Audio custom model (no real amp)" when based_on (or the section title, when based_on is null) starts with "FAS custom model"; "Guide section: <section>" only when the unit name isn't one of the title's name parts. Same header on binder picks. The AC30 mock card now uses unit "Class-A 30W TB", so the guide-section line is shown and tested. | DONE |
| D | At ≤ 600 px, the example chips sit in one contained row that scrolls sideways. After a search, focus moves to the results summary (or the no-support heading), which scrolls to the top on phones (`nearest` on desktop). 32 px above the summary at every width. | DONE |
| E | `app/tests/serve.spec.mjs`, with raw `node:http` so paths aren't normalised before sending. Tests 200 + content type for `/`, `/index.html`, `/app.css`, `/api.js`, `/mock/models.json`; 404 for `/tests/`, `/tests/ask.spec.mjs`, `/tools/`, `/tools/build-mock.mjs`, `/mock/`, `/mock`, `/serve.mjs`, `/playwright.config.mjs`, `/../package.json`, `/%2e%2e/package.json`, `/..%2fAGENTS.md`, `/.rig/BRIEF.md`, a dotfile probe inside `app/`, `/nope.html`; 405 for POST. | DONE |
| F | Negative control on the builder's verification (below). | DONE |
| G | Cross-review of tf1 `c346d2f` (below). | DONE |
| H | `app/tests/shape.mjs` checks Health, the models list + Summary, model detail + Model (§3.1), Answer and error bodies. It checks required keys and types; enums for status, source, knob kind, `ai.reason` (null or a named value, null only when `used`), drop kinds, intent, facets and Ares param/where; exactly 7 knobs in order; direction only on a guess; integer pages in 1–301 and inside the suggestion's pages; why quotes 12–320 characters; 1–3 why quotes; rank order; message rules for ok / no support; the GK label; 2 https Ares sources. `shape.spec.mjs` runs it over all 109 fixture models, every fixture answer (AI on and off, and the no-support template), and the mock backend's own responses: health, 4 list filters, 3 model details, the 404 body, 5 queries × AI on/off, and a 400 body. `live.spec.mjs` runs the same checks against the Worker when `TF_LIVE_API` is set. | DONE |
| I | Shots retaken and looked at (below); report updated. | DONE |

### Why some checks needed more than the literal list (E, D)

- **E, dotfile rule.** `/.rig/BRIEF.md` isn't under `app/`, so it 404s even with the dotfile rule removed.
  `/../package.json` and `/%2e%2e/package.json` are normalised to `/package.json` by the server's URL parser
  before the rule runs. Those checks stay in the spec but can't go red on their own. So the spec creates a real
  dotfile inside `app/` (`app/.tf-dotfile-probe.txt`, removed after), and the traversal control uses
  `/..%2fAGENTS.md`, which does reach the guard.
- **D, scroll check.** In emulation there's no on-screen keyboard, so at 390 × 844 the first card title can already
  be on screen without any scroll, and "title hit-tests to itself" alone couldn't fail. The phone test also checks
  that the summary line's top is < 40 px after the search, which the scroll decides. It also checks that focus is on
  the summary, and on the heading for no support.

### Negative controls, round 2 (each made red once, restored with `git checkout`, rerun green)

Each control printed its `git diff --stat` before running, so an edit that didn't apply can't pass as red.

| # | Break | Test | Red with | Restored |
|---|---|---|---|---|
| A (f) | djent chip forced to 30 px | Ask with results: everything you can tap… | `button.chip "djent": 75.3×30.0` | green |
| A | pills shrunk to 12 px type, no min-height | Ask with results: static tags ≥ 24 px | 19 tags listed, e.g. `pill-page "p. 270": 14.0 px tall` | green |
| B | `hasJoin` always false | join detector catches the known glued passage | `Expected: true, Received: false` | green |
| B | the old glued 1959SLP tip planted in `models.json` | no joined passage in app/mock/models.json | `$.models[6].tips[1] p. 28: Or just crank everything, like Eddie Van Halen “My settings…` | green |
| D | `scrollIntoView` removed | type + Enter: focus moves… (chromium-390) | `Expected < 40, Received 506.3` | green |
| D | chip row allowed to wrap | example chips sit in one row (webkit-390) | `Expected 1, Received 5` rows | green |
| E | dotfiles allowed in `serve.mjs` | 404 for /.tf-dotfile-probe.txt | `Expected 404, Received 200` | green |
| E | traversal guard removed | 404 for /..%2fAGENTS.md | `Expected 404, Received 200` | green |
| H | `taper_note` deleted from the JTM 45 card | every fixture answer has the §6 Answer shape | `"jtm 45" (on): answer.suggestions[0].taper_note: missing` | green |

### F — negative control on build-mock verification

| Input | Result |
|---|---|
| Unchanged temp copy of `app/mock/models.json` via `--models` | builds, exit 0 (the control can pass; `app/mock` restored afterwards) |
| Same copy, 1959SLP synopsis `…Plexi re-issue` → `…Plexi re-issuf` | `build-mock: quote not verified on p. 28: "Models of a 100 watt Superlead Plexi re-issuf"`, exit 1, `app/mock` untouched |
| Guide copy in the scratchpad (outside git, deleted after), p. 12 `will default at 10.` → `will default at 11.` | `build-mock: quote not verified on p. 12: "If the original amp has no Master Volume control, the Master control in the amp model will…"`, exit 1, `app/mock` untouched |

**First attempt at the guide-copy control was void.** My first substitution didn't match, because the page-12
sentence wraps across lines in the raw file. The script flagged "guide copy not changed" and the build passed. I
redid it with a whitespace-tolerant substitution, confirmed the copy differs ("default at 11." present,
"default at 10." gone) and got the red above.

### What the round 2 shots showed (I)

The six screens at 390 and 1280 are retaken. Two new shots: `ask-ac30-*` (the "Guide section" line) and
`ask-after-search-390` (the phone viewport right after type + Enter).

- **After a search at 390:** the summary line is at the top, then "Found in the guide", then the Brit Brown
  title and header, all without a manual scroll.
- **Card headers:**
  - "Fractal Audio custom model (no real amp) · pp. 60–61" for Brit Brown.
  - "Based on Marshall SLP1959, Vintage Re-Issue Series · pp. 28–31" for 1959SLP.
  - "Based on VOX AC30 · pp. 107–109" plus "Guide section: Class-A 30W (VOX AC30)" for the Class-A 30W TB card.
  - Binder picks and print use the same header.
- **Tags:** page, source and brand tags are smaller (28 px) and still readable; the Models rows are lighter.
- **Chips:** at 390 they sit in one row cut off at the panel edge, and the row scrolls. There's no fade or arrow
  hinting that it scrolls; I left it plain.
- **Print:** all text black on white, footer present.
- **Not a defect: a band in some phone shots.** Full-page shots of a page that was scrolled before capture
  (`no-support-390`, `ask-results-390`) show a band where the fixed aurora background doesn't line up with the
  stitched capture. It isn't in the viewport shot or on screen.
- **Left as is: the model detail header.** `model.html` still reads "Section: … · based on …". C covered the card
  header, so I didn't change the detail page. Lead: say if it should match.

## Cross-review of tf1 c346d2f

A throwaway script in my scratchpad, outside git. It loads tf1's `core/text.js`, `core/guide.js` and
`core/verify.js`, taken with `git show c346d2f:<path>` (the exact commit; tf1's worktree wasn't read or touched),
and compares them with my `app/tools/guide-text.mjs` on the real guide.

| Check | Result |
|---|---|
| `pageText` for all 301 pages (tf1 `parsePages` by lines vs mine by regex) | identical on every page |
| `splitSentences` for all 301 pages | identical on every page |
| `checkQuote` vs my `isVerified` over every `{quote, page}` in app/mock/*.json | 538 quotes: 519 both ok, 19 both fail (the 19 have `page: null`: the planted SAMPLE Ares flag and the Ares source quotes, which aren't guide quotes), **0 disagreements** |
| Boundary cases, both sides | all agree: exact ok; one character changed → not_on_page; wrong page → not_on_page; page 0 / 302 / "28" (string) → bad_page; leading space, double space, NBSP → not_normalised; real 11-character substring → too_short; real 12-character substring → ok; 320 characters → ok; 321 → too_long; three sentences → too_many_sentences; non-string → not_normalised |

**No boundary defect found.** My first run's "12 characters" case was mis-built: it ended in a space, so both said
`not_normalised` without testing length. I replaced it with real 11- and 12-character substrings, and they agree.
One difference that isn't a defect: tf1's `checkQuote` returns a reason, mine a boolean, and `verifyQuote` (the
boolean form) matches mine.

## Still open

- **Step 3:** rebuild the mock from `main:data/models.json` once the lead says "data ready is on main"
  (`node app/tools/build-mock.mjs --models <file>`). If tf1's quotes contain joined passages under the current
  definition, that build will stop and name them; that's intended.
- **`live.spec.mjs`** (Ask journey + §6 shapes) hasn't run: it needs a Worker (the lead runs it in QA).
- **QA-worktree numbers:** the lead runs `rig qa`.

---

## Round 1 record

### What I built

| Item | Status |
|---|---|
| `app/serve.mjs`: zero-dep static server, `--port` (default 8301), content types, `404.html`, no directory listings, 405 for non-GET/HEAD, refuses traversal, dotfiles, `tests/`, `tools/`, `serve.mjs` and the Playwright config | DONE |
| `app/api.js`: base from `<meta name="api-base">`, `?api=` override (http/https origins only), `?mock=1` swaps in `api.mock.js` behind the same response path, `carry()` keeps `mock`/`api` on internal links | DONE |
| `app/api.mock.js`: `/api/health`, `/api/models` (AND filters, facets over all 109), `/api/models/:id` (404 `not_found`), `/api/ask` (400 `bad_query`, canned answers, no-support answer for anything else, AI-off variant) | DONE |
| `app/store.js`: binder in `localStorage` key `tf.binder.v1`, array of `{query, suggestion, saved_at}`, every access in try/catch | DONE |
| `app/app.css`, `app/shell.js`: dark glass look, faint aurora, gradient wordmark, "Axe-Fx II XL+ · Ares" pill, nav Ask · Models · Binder, footer copy, "Demo data" pill in mock mode, print CSS | DONE |
| `index.html` Ask: examples, AI line with switch, understood line, no support, general knowledge box, AI drops disclosure, Ares line with Sources, `?q=` survives reloads | DONE |
| `app/card.js` suggestion card and `app/knobs.js` SVG dials (0–10 over 270°; solid teal = guide or guide rule, dashed amber = guess; accessible name carries the value and the guess note) | DONE |
| `models.html` browser: name filter, Brand (top 12 + More brands select), Power tubes, Master volume; filters in the URL; stub rows link to their target | DONE |
| `model.html` detail: unit names, spec table ("Not in the guide" for null), synopsis, tips, settings with knob chips, directions, no-master-volume rule, cab, notes, each with its page pill; unknown-id message | DONE |
| `binder.html`: list, remove, Print; print CSS gives one page per ≤ 3 picks, white, black type, no nav, knob table with "guide p. N" / "rule p. 12" / "guess", cab line, first why quote, footer | DONE |
| `app/tools/build-mock.mjs`: builds both fixtures from the local guide; `--models <path>` rebuilds them from tf1's real `data/models.json` | DONE |
| `app/playwright.config.mjs`, `app/tests/*.spec.mjs`, `app/tests/live.spec.mjs` | DONE |

### About the mock fixtures (pre data-ready)

`build-mock.mjs` derives the 109 models from `yek-guide-sections.json` and the page text. It writes derived fields
and short quotes only, and every quote passes the §0 checks and is not a joined passage; a miss stops the build.
The quote budget is 27,984 of 540,437 characters (5.2%). All golden `ids_must_exist` are present, and the six
stubs and their targets match golden.

Stand-in limits:
- **Unit names** come only from section titles and synopsis bullets.
- **Controls, notes and cab notes** are empty.
- **Settings** are sentences with "settings" and a knob number.
- **Scores** in the canned answers are placeholders.

Canned answers cover the six example chips plus "JTM 45":
- **All seven knobs guessed:** Brit Brown, with its Presence nudge.
- **Guide knobs plus a nudge:** Brit JM45.
- **`no-master-volume` guide rule:** 1959SLP.
- **General knowledge plus `ai.dropped`:** "the rhythm tone on Master of Puppets", with `unknown_model` "Brown Sound
  Deluxe" and `bad_page`. With AI off, this query gives no support.
- **Planted Ares flag:** on the AC30 card, quote `SAMPLE (test only): add Transformer Grind to taste`.

### Round 1 checks and negative controls

The Ask, no-support, guesses, general knowledge / drops, Ares, Models, Binder, print, tap-target and
horizontal-scroll checks are described in the specs. Each round 1 control was made red once on chromium-390 and
restored green: (a) guesses drawn with the guide class; (b) `pagePill` returns ""; (c) no-support heading hidden;
(d) binder `setItem` removed; (e) print CSS deleted; (f) djent chip 30 px. Control (f) was re-run in round 2 against
the narrowed tap test (above).
