# Build report — tf2 (app)

**mock ready** — `808dea5`. The mock JSON is `app/mock/models.json` (the `data/models.json` shape, §3) and
`app/mock/answers.json` (Answers in the §6 shape, plus the health fixture). tf1 cross-review welcome.

## Contract questions

1. **`ai.reason` when AI ran fresh.** §5 lists `off`, `no_key`, `guide_not_loaded`, `spend_cap`, `cached` and
   `error`, but no value for a fresh successful run. The mock uses `null`. tf1: please confirm or name the value.
2. **"Every button, chip and pill ≥ 44 × 44."** I read it literally, so static pills are also ≥ 44 px tall and
   wide: page pills (`p. 60`), brand pills and the unit pill. That makes the Models rows heavier than plain tags
   would. If the lead meant interactive pills only, page and brand pills can shrink to about 32 px.
3. **Is Dweezil's B-man a stub? (golden may be missing one).** Its section (p. 139) holds nothing but the running
   header and "Please refer to the section on the 65 Bassguy model." That is exactly §0's stub definition, and the
   sections file gives it an empty card and empty specs. But `data/golden.json` `stub_ids` / `stub_targets` list only
   5 stubs and leave it out. The mock follows §0, so it has 6 stubs (`dweezils-b-man` → `65-bassguy`) and differs from
   golden here. I haven't bent the mock to match. Lead: please either add it to golden or say why it isn't a stub.
4. **`Answer.query`.** §6 shows the query echoed back. The mock echoes the trimmed query as typed, case kept.

## What I built

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
| Step 3: rebuild the mock from `main:data/models.json` | NOT DONE: waiting for "data ready is on main" (checked: `data/models.json` isn't on main yet) |
| `app/playwright.config.mjs`, `app/tests/*.spec.mjs`, `app/tests/live.spec.mjs` | DONE |
| Screenshots in `docs/shots/` (390 and 1280): `ask-results`, `no-support`, `models-filtered`, `model-detail`, `binder`, `binder-print` | DONE, looked at (below) |

### What the screenshots showed

- **Ask results:** Brit Brown has seven dashed amber dials, each with the word "guess", the guess sentence and the
  Presence nudge line with p. 60. 1959SLP has solid teal Bass/Mid/Treble dials with p. 28, Master 10 with p. 12,
  guesses for the rest, the taper note and the cab. Two columns at 1280, one at 390, no overflow.
- **No support:** heading, unmatched words and the suggestion copy, then the Ares line and Sources.
- **Models filtered:** "Showing 12 of 109" with Marshall pressed. Stub rows (Brit Pre, Brit Super) read "See …".
- **Model detail:** spec table with "Not in the guide", and every item with a page pill.
- **Binder, screen:** two picks with knob tables ("guide p. 28", "rule p. 12", "guess").
- **Binder, print:** white ground, no nav, thin rules, footer copy.
- **Fixed after looking:** in print, the "Section:" line was still light grey (its screen colour), so print CSS now
  forces all text black, and the binder-print shots were retaken.
- **Noticed, left as is:**
  - Some quotes show doubled marks (“Adjust Presence to taste.””). The guide's own closing mark is part of the
    exact substring, and §0 forbids trimming it.
  - The mock's 1959SLP directions miss "turn Bass all the way down". That comes from the mock's simple parser;
    real data replaces it.

### About the mock fixtures (pre data-ready)

tf1's `data/models.json` doesn't exist yet, so `build-mock.mjs` derives the 109 models itself from
`yek-guide-sections.json` and the page text. It writes derived fields and short quotes only, and **every quote goes
through the §0 checks** (normalised, 12–320 characters, ≤ 2 sentences, exact substring of its page); a miss stops
the build. The quote budget is 29,446 of 540,437 characters (5.4%). All golden `ids_must_exist` are present.

This is a stand-in, and it is less careful than tf1's build will be:
- **Unit names** come only from the section title and the synopsis bullet lists, not from the TOC or appendix, so
  some are rough (for example, "Euro Blue and Red" gives "Euro Blue" and "Red").
- **Controls, notes and cab notes** are left empty.
- **Settings** are sentences containing "settings" that carry a knob number.
- **Scores** in the canned answers are placeholders.

All of this is replaced by `node app/tools/build-mock.mjs --models <real models.json>` once data lands.

Canned answers cover the six example chips plus "JTM 45":
- **All seven knobs guessed:** Brit Brown, whose Presence tip nudges the guessed Presence up.
- **Guide knobs plus a direction nudge:** Brit JM45 has guide Drive and Presence, and its tip nudges the guessed Bass down.
- **`no-master-volume` guide rule:** 1959SLP.
- **General knowledge plus `ai.dropped`:** "the rhythm tone on Master of Puppets", with `unknown_model` "Brown Sound
  Deluxe" and `bad_page`. With AI off, this query gives the no-support answer.
- **Planted Ares flag:** on the AC30 card, quote `SAMPLE (test only): add Transformer Grind to taste`.

## What I verified, and how it could have failed

Playwright on chromium + webkit at 390 × 844 (touch) and 1280 × 800, against `?mock=1`. State changes use real
input only: tap on the touch projects, click on desktop, keyboard typing and select-all + Backspace to clear. The
DOM is read with `evaluate`, never written. **Result at `808dea5`, from my own worktree (clean tree): 104 passed,
8 skipped (live spec, 2 tests × 4 projects).** These are not QA-worktree numbers. The lead's `rig qa` run is the
one to quote.

| Check | What makes it red |
|---|---|
| Ask: typing "Van Halen brown sound" + Enter gives 1–4 cards, each with ≥ 1 quote and page pills matching `/^p\. \d+$/`; reload keeps `?q=`, the input value and the same card count | pills missing, a pill that doesn't read `p. N`, `?q=` not written or not read |
| Example chip "Robben Ford" fills the input and shows Bludojai first | chip not wired |
| No support: exact heading "I can't point to the guide for that." visible and zero cards | heading hidden or reworded |
| Guesses: all 7 dials `data-kind="guess"`, dashed amber ring (computed `stroke-dasharray` ≠ none, stroke rgb 255,194,77), accessible name ends with the guess note, visible sentence "starting guess — not from the guide"; the guide dial on 1959SLP is solid and never carries the note; the JTM 45 card's guide dials each have a page pill, and "Bass nudged down: …" has a page pill | guesses drawn like guide values |
| General knowledge heading exact; "Words the AI added: metallica"; source pill "AI pick · quotes checked"; the drops disclosure is hidden until tapped, then lists "Brown Sound Deluxe: not an Axe-Fx II model in the guide"; switching AI off gives no support and no GK box | label changed, disclosure missing |
| Ares: exactly one flag callout with "Transformer Grind", "SAMPLE (test only):" and the Spkr Comp advice; both release-note URLs hidden until Sources is tapped, then visible | flag not rendered |
| Models: Marshall chip changes "Showing 109 of 109" and every row carries a Marshall pill; mv "No" rows all read "Master volume: No"; name filter "IIC"; stub `brit-super` links to `brit-afs100-and-brit-super` and keeps `mock=1`; the 1959SLP row opens the detail with the spec table, EL34 / No and page pills; unknown id message and Back link | filter ignored |
| Binder: Add to binder → Binder nav → reload lists Brit Brown with 7 knob rows; Remove empties it and stays empty after a reload | not persisted |
| Print: body is dark on screen and nav visible; under `emulateMedia({media:'print'})` body is `rgb(255, 255, 255)`, nav hidden, footer copy exact | print CSS gone |
| Tap targets on 6 page states (Ask with AI answer + disclosures open, Ask with Ares flag, no support, Models with 109 rows, Model detail, Binder with a pick): every `button, .btn, .chip, .pill, .nav-link, summary, .src-link` is ≥ 44 × 44 and `elementFromPoint` at its centre, after scrolling into view, is the element or inside it. The check also fails if it finds nothing to measure | a small or covered target |
| No horizontal scroll on the same 6 page states | overflow |

### Negative controls (each made red once on chromium-390, restored with `git checkout`, rerun green)

| # | Break | Test | Red with | Restored |
|---|---|---|---|---|
| (a) | `knobs.js`: guesses drawn with the guide class | guesses look like guesses | `guess ring must be dashed — Expected: not "none"` | green |
| (b) | `shell.js`: `pagePill` returns `""` | typing a tone gives 1–4 cited cards | `card 1 has no page pill — Expected >= 1, Received 0` | green |
| (c) | `index.js`: no-support `<h2 hidden>` | no support: exact heading | `toBeVisible() failed — element(s) not found` | green |
| (d) | `store.js`: `setItem` removed | listed in the binder after a reload | `toHaveCount — Expected 1, Received 0` | green |
| (e) | `app.css`: `@media print` block deleted | print view: white ground | `Expected "rgb(255, 255, 255)", Received "rgb(10, 17, 32)"` | green |
| (f) | `app.css`: djent chip forced to 30 px | Ask with results: every button… | failures list not empty (chip 30 px, and it now covers nothing at its centre) | green |

Each control's script printed the `git diff --stat` of its mutation first, so no edit that failed to apply could pass as a red.

### Checked by hand, not automated

- `serve.mjs` (curl on port 8301): 200 with the right content type for `/app.css` and `/api.js`; 404 for
  `/tests/`, `/tools/build-mock.mjs`, `/mock/` (no listing), `/serve.mjs`, `/../package.json`,
  `/%2e%2e/package.json`, `/..%2fAGENTS.md` and `/.rig/BRIEF.md`; 405 for POST.
- A headless pass over all pages in mock mode showed no console errors.

## Left undone

- **Step 3** (rebuild the mock from real data) waits for the lead's "data ready is on main".
- **`live.spec.mjs`** hasn't run; it needs a Worker (the lead runs it in QA).
- **No automated test for `serve.mjs`** (the traversal and 404 checks above were manual), and no negative control
  on `build-mock.mjs`'s quote verification.
- **QA-worktree numbers:** the lead runs `rig qa`.

## Needs from other slices

- **tf1:** confirm the fresh-run `ai.reason` value (question 1) and cross-review the mock JSON shapes.
- **Lead:** questions 2 and 3.
