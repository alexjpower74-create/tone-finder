# Tone Finder — build contract

One plan file. It is the contract, at the repo root, and every agent reads the same copy.
Read `AGENTS.md` (rules), `docs/API.md` (the data + HTTP contract between slices), `data/golden.json` (lead-owned
acceptance data) and `DECISIONS.md` first.

## The brief (Onyx for Alexander, 2026-09-14)
Alexander plays a **Fractal Audio Axe-Fx II XL+ on Ares firmware** (not an Axe-Fx III / FM3 / FM9). He types a tone
("Van Halen brown sound", "clean worship pad with sparkle", "the rhythm tone on Master of Puppets") and gets 2–4
starting points: amp model, cab suggestion and starting knob values (Drive, Bass, Mid, Treble, Master, Presence,
Depth). **Every suggestion cites a page of yek's guide and quotes the line it is based on.** It never names a model
that isn't one of the guide's Axe-Fx II amp models. Knob values not from the guide are marked "starting guess — not
from the guide". Song/artist facts the guide doesn't cover are "General knowledge (AI) — not from the guide", never
attributed to yek. A query the guide can't support gets "I can't point to the guide for that."

Source: yek's guide (rev. April 2017, Quantum 7.02), local and private in `TF_GUIDE_DIR`. It stays out of the repo;
the repo keeps derived data and short verified quotes only. Ares note: Quantum 9.00 removed Motor Drive and
Transformer Grind (replaced by Speaker Compression); anything touching them is flagged (API.md §4.5).

Screens: Ask (examples, 2–4 result cards), Models browser (filter by brand / power tube / master volume), Model
detail (every cited note), Binder with a one-page print for the rehearsal binder. Dark and stage-readable at 390 and
1280; the print view is white and low-ink.

**Design.** The approved portfolio look (Shop Board calm pass): dark navy/slate base, glass surfaces with hairline
borders, soft shadows, faint aurora ~0.2, gradient wordmark. Colour on data: teal = from the guide, dashed amber =
starting guess, violet = AI pick with checked quotes, slate = general knowledge. 18 px base, body contrast ≥ 7:1,
unit name ≥ 28 px, knob values ≥ 22 px, tap targets ≥ 44 px. System fonts, tabular numbers, inline SVG icons (no
emoji). Copy is in API.md §8.

**Stack.** `core/` pure ESM with zero deps (Node + workerd) · `data/models.json` built by `scripts/build-models.mjs`
· `worker/` Cloudflare Worker + D1 `tone-finder`, local only · `app/` static HTML/CSS/JS served by
`node app/serve.mjs`. Root `package.json` (lead) scripts: `build:models`, `load-guide`, `demo`, `dev:worker`,
`dev:app`, `test:core`, `test:worker`, `test:app`, `test`. Ports: app 8301 (tf2) · worker 8302 (tf1) · fake OpenAI
8303 (tf1) · QA app 8309, worker 8308, fake AI 8307. **Ignore any port rig prints; these are the ports.** The root
`node_modules` (only `@playwright/test` 1.63.0) is symlinked into each worktree by the lead. `wrangler` is on PATH.
Node 26.

## Rules
- You own the files under your id and nothing else; `rig guard` enforces it. Commit only your own paths
  (`git commit -- <paths>`). Verify → commit → report in `docs/build-report-<id>.md` (committed). Commit at every
  green stage: a usage-limit pause can land mid-task.
- If the contract (`docs/API.md`) or `data/golden.json` is wrong or missing something, write it at the top of your
  report under **Contract questions** and carry on with the most sensible reading. The lead reads reports and
  updates the contract. Don't bend the engine to dodge a golden expectation.
- Never grade the shared tree. No visible Chrome. Playwright only; `pwshot` for screenshots.
- **The QA worktree (`.worktrees/qa`) and the QA ports (8306–8309) belong to the lead.** Slices never run `rig qa`
  and never bind QA ports: report numbers from your own clean worktree on your own ports, and say the sha. (Two
  runs sharing the QA worktree at 16:37 wiped each other's wrangler state and port 8307.)
- A check that cannot fail measured nothing: for each important check, say what would make it red, make it red
  once, restore, and record it in your report.
- **The guide stays out of git.** Read it from `TF_GUIDE_DIR` (`~/Claude/Reference/Yek Fractal Amp
  Guide`). No page dumps in fixtures, snapshots, logs or reports; quotes ≤ 320 characters only.
- **No paid AI calls from slices.** Use the fake OpenAI server. Don't read `~/.claude/imagegen/.env` or any key
  file. The lead makes the real calls at the end.
- **Forbidden:** any deploy, `wrangler secret put`, `wrangler d1 create`, anything `--remote`; sending anything;
  touching other projects; creating herdr workspaces/tabs; helper agents. Keep scratch files inside your worktree.

## Agents

### tf1 — Guide data, answer engine, AI step, Worker + D1
Owns:
- core/**
- scripts/**
- worker/**
- data/models.json
- data/curation.json
- docs/DATA.md

Report: docs/build-report-tf1.md

Task:
Build `docs/API.md` §0–§7. Work in this order and commit at each green step.

1. **Foundations** (`core/text.js`: `normText`, sentence split, whole-word find; `core/guide.js`: `parsePages`,
   `pageText`, `pagesSha256Input`; `core/verify.js`: `verifyQuote`) with tests on the real guide: the §3.1 example
   quotes verify; one changed character fails; a real quote checked against the wrong page fails; a 3-sentence
   passage fails; 321 characters fails; page 0 and 302 fail; a missing `TF_GUIDE_DIR` makes the test run fail with
   `guide not found at <path>`.
2. **Data** (`scripts/build-models.mjs`, `data/curation.json`, `core/brands.js`, `core/models.js`: load, resolve
   stubs, unit-name lookup, facets) → `data/models.json`, per API.md §3 rules 1–7. Read the guide properly: the TOC
   (pp. 2–7), the appendix tables (pp. 295–298), the section bodies' variant lists, the stub sections, the tips
   and "My settings…" passages, the cab lines. `sections.json` card fields carry extraction junk (for example
   `Stock cabs` runs into "Web, Manual …"): cut it and let verification prove the cut. `core/tests/models.test.mjs`
   covers every §3 rule plus `data/golden.json` `model_count`, `ids_must_exist`, `stub_ids`/`stub_targets`,
   `names_resolve_to`, `names_never`, and prints the quote-budget numbers. `docs/DATA.md`: how the curation was
   done, what was left out and why, counts (unit names, settings, directions, notes), the quote budget.
   **Commit and write "data ready" at the top of your report**: the lead merges it and has tf2 cross-review the
   shapes at this point.
3. **Engine** (`core/search.js`, `core/answer.js`, `core/knobs.js`, `core/ares.js`) per §4. Tests:
   `core/tests/golden.test.mjs` runs every `data/golden.json` query with AI off and checks every expectation,
   plus `never_ids` on every answer; knobs: a model with a guide settings set gives `kind: "guide"` values with
   the quote, a no-master-volume model with no Master in its set gives `guide_rule` 10 with the p. 12 quote, a
   model without settings gives seven guesses with the exact note, a tip direction nudges only a guess; the
   answer with `pages: null` still works from stored quotes; a planted tip "SAMPLE (test only): add Transformer
   Grind" in an in-memory copy of one model yields one `ares_flags` entry with the advice text; the `ares`
   object equals §4.5.
4. **AI step** (`core/ai.js`, `worker/tests/fake-openai.mjs`) per §5, tested in core with the fake server on
   `TF_FAKE_AI_PORT` (8303): scenario `fake-plant` returns picks "Brown Sound Deluxe" (unknown) and a real model,
   and citations with (i) a verified quote, (ii) a real quote from another page (`bad_page`), (iii) a quote with
   one changed character (`quote_not_on_page`) → only (i) survives, all drops listed; scenario `fake-puppets`
   (query "the rhythm tone on Master of Puppets fake-puppets") returns general knowledge + search terms
   `["metallica", "mark iic+"]` + a pick of `usa-iic-plus-and-usa-iic-plus-plus` with a verified p. 270 quote →
   status ok, that model present with `source: "ai_checked"`, general knowledge labelled; cap: with `AI_CAP_CAD`
   below the estimate → `spend_cap` and the fake's request count unchanged; cache hit → count unchanged;
   fake 500 → `ai.reason: "error"` and the guide-search answer; the key string never appears in any Answer or
   thrown error.
5. **Worker** (`worker/`): `wrangler.toml` name `tone-finder`, `main = "src/index.js"`, a current
   `compatibility_date`, D1 binding `DB` (`database_name = "tone-finder"`, `database_id =
   "LOCAL-ONLY-set-at-deploy"`), migrations per §7, `data/models.json` imported as JSON, routes per §6,
   `worker/.dev.vars.example` per §1, your own gitignored `worker/.dev.vars`. `worker/package.json` scripts: `dev`
   = `wrangler dev --local --port 8302`, `migrate:local`, `test` = `node tests/run.mjs`, which reads
   `TF_WORKER_PORT` (default 8302) and `TF_FAKE_AI_PORT` (default 8303), wipes and uses `--persist-to
   .wrangler/test-state`, applies migrations `--local`, starts the fake server and `wrangler dev --local` with
   `--var ADMIN_TOKEN:test-admin-token --var OPENAI_API_KEY:test-key --var OPENAI_BASE_URL:http://127.0.0.1:<fake>/v1`
   (and a low `AI_CAP_CAD` for the cap test, or a second instance), waits for `/api/health`, runs
   `node --test tests/`, and always stops what it started. `worker/tests/api.test.mjs`: health before and after a
   guide load (`guide.loaded`, `sha_ok`); `/api/admin/guide` 401 without token, 409 with one page altered, 400
   with 300 pages; `/api/models` total 109, `brand=Marshall` rows all carry Marshall, `tube=EL84`, `mv=no`, `q=`;
   `/api/models/1959slp` and a 404; `POST /api/ask` "Van Halen brown sound" ok with every why quote verified
   against the real page, "banjo through a toaster" no support, empty and 201-character queries 400; `fake-plant`
   and `fake-puppets` through HTTP; a second identical AI ask is cached (fake count unchanged); the spend cap;
   `OPTIONS` + CORS header; every Answer's model names are unit names in `models.json`. NEVER `--remote`.
6. **Scripts**: `scripts/load-guide.mjs` (`npm run load-guide`: reads `TF_GUIDE_DIR` and `worker/.dev.vars`, posts
   the 301 pages to `TF_WORKER_URL` default `http://127.0.0.1:8302`, prints pages + sha, never prints page text);
   `scripts/demo.mjs` (`npm run demo`): applies local migrations, starts the Worker on 8302 and
   `node app/serve.mjs --port 8301` (tf2's file, call it by that path), waits for health, runs load-guide, prints
   "Open http://127.0.0.1:8301/", and stops its children on Ctrl+C or when either dies.

Negative controls (red once each, restore, record): (a) `verifyQuote` accepts everything → the changed-character
tests go red (core and AI); (b) the AI unit-name check disabled → the "Brown Sound Deluxe" test red; (c) the page
range check disabled → the `bad_page` test red; (d) generic words counted as strong → golden "the rhythm tone on
Master of Puppets" and "lead tone" red; (e) the cap check removed → the zero-request cap test red; (f) one model
dropped from `models.json` → the count/order test red; (g) the quote budget limit set to 1% → the budget test red;
(h) the admin token check removed → the 401 test red; (i) stubs not merged → golden `never_ids` red.

### tf2 — App: Ask, results, Models, Model detail, Binder + print
Owns:
- app/**
- docs/shots/**

Report: docs/build-report-tf2.md

Task:
Static app, no build step, per `docs/API.md` §6 (JSON shapes), §8 (screens and copy) and §9 (mock).

1. **Plumbing first** (commit, and write "mock ready" at the top of your report: the lead has tf1 cross-review the
   mock JSON at this point): `app/serve.mjs` (zero-dep static server, `--port` default 8301, content types, no
   directory listing, 404 page, serves only `app/`); `app/api.js` (base from `<meta name="api-base">`, `?api=`
   override, `?mock=1` → `app/api.mock.js`, carries `mock`/`api` across internal links); `app/api.mock.js` per §9;
   `app/store.js` (binder in `localStorage` with try/catch everywhere); `app/app.css`; shared header/footer.
2. **Screens** per §8: `index.html` (Ask + results + no support + general knowledge + AI drops + Ares line),
   `models.html`, `model.html`, `binder.html` with print CSS. A small SVG knob dial module (0–10 sweep; solid teal
   for guide / guide rule, dashed amber for guess, accessible name includes the value and "starting guess — not
   from the guide" for guesses).
3. When the lead says "data ready is on main": copy the models your mock uses from `git show main:data/models.json`
   into `app/mock/` (real quotes and pages, shapes unchanged) and rebuild the canned answers from them. Keep the
   planted Ares flag marked `SAMPLE (test only):`.
4. **Playwright** `app/playwright.config.mjs`: projects chromium-390, chromium-1280, webkit-390, webkit-1280 (phone
   390×844 with touch); `webServer` = `node app/serve.mjs --port ${TF_APP_PORT||8301}`, `reuseExistingServer: false`.
   Tests in `app/tests/*.spec.mjs`, against `?mock=1`, with **real input** (click / tap / type, never set state via
   evaluate):
   - Ask: type "Van Halen brown sound" + Enter → 1–4 cards, each with ≥ 1 quote and a page pill matching
     `/^p\. \d+$/`; tapping an example chip shows its answer; reload with `?q=` keeps the query and results.
   - No support: "banjo through a toaster" → the exact heading "I can't point to the guide for that." and zero cards.
   - Guesses: the all-guess card shows dashed dials and the visible sentence "starting guess — not from the guide";
     the guide-knob card shows a page pill on its guide dials and a direction nudge line.
   - General knowledge box labelled "General knowledge (AI) — not from the guide"; the drops disclosure lists
     "Brown Sound Deluxe".
   - Ares: the planted flag callout shows; the Sources disclosure shows both release-note URLs.
   - Models: tap brand "Marshall" → "Showing N of 109" changes and every visible row has a Marshall pill; master
     volume "No"; filter by name; a stub row links to its target; tap a row → detail shows the spec table and page
     pills; unknown id message.
   - Binder: "Add to binder" → binder page lists it after a reload; remove works; `page.emulateMedia({ media:
     'print' })` → body background computes to white and the nav is hidden.
   - Everything you can tap (buttons, links, chips, filter pills, switches): ≥ 44 × 44 and `document.elementFromPoint`
     at its centre is the element (or inside it), after scrolling it into view. Static tags may be smaller (API.md §8).
   - No horizontal scroll at 390 on every page.
   - `app/tests/live.spec.mjs`, skipped unless `TF_LIVE_API` is set: the same Ask journey against a real Worker
     (the lead runs it in QA).
   Screenshots with `pwshot` into `docs/shots/` (390 + 1280): Ask results, no support, Models filtered, Model
   detail, Binder, Binder print-emulated. Look at them before you report.

Negative controls (red once each, restore, record): (a) guesses rendered like guide values → the guess test red;
(b) page pills removed → the citation test red; (c) the no-support heading hidden → red; (d) the binder not
persisted → the reload test red; (e) print CSS removed → the white-ground test red; (f) one chip shrunk to 30 px →
the hit-test red.

## Main (tf-lead, not a slice)
Owns `PLAN.md`, `AGENTS.md`, `DECISIONS.md`, `docs/API.md`, `data/golden.json`, `data/sources/**`, `package.json`,
`README.md`, `docs/DEPLOY.md`, `docs/build-report.md`, `docs/spend.md`, `docs/lead-shots/**`. Merges each slice
after reading its diff, runs the cross-reviews, diffs the mock's JSON against the real Worker, runs QA in a pinned
worktree (`rig qa --ref <sha>`), makes the real AI calls with the CA$2 cap and logs them, writes the README, pushes
the private repo.
