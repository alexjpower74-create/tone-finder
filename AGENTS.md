# Tone Finder — rulebook

**What it is.** Alexander plays a Fractal Audio **Axe-Fx II XL+ on Ares firmware**. He types a tone ("Van Halen
brown sound") and gets 2–4 starting points: amp model, cab, and seven starting knob values. Every suggestion cites a
page of yek's guide to the amp models and quotes the line it is based on. It never names a model the guide doesn't
name, and anything not from the guide is labelled as such.

**Stack.**
- `core/`: pure ESM, zero dependencies. Guide pages, quote verification, the model index, the answer engine,
  knobs, Ares notes and the optional AI step. Runs in Node (scripts, tests) and inside the Worker.
- `data/models.json`: derived structured data built by `scripts/build-models.mjs` from the local guide (names,
  specs, page numbers, short verified quotes). `data/golden.json` is lead-owned acceptance data.
- `worker/`: Cloudflare Worker + D1 (`tone-finder`, binding `DB`); local dev with `wrangler dev --local`, live at
  tone-finder.alexjpower74.workers.dev since 2026-09-15.
- `app/`: static HTML/CSS/JS, no build step, served by `node app/serve.mjs`; live as a static-assets Worker
  (`scripts/deploy-app.sh`, `deploy/app/wrangler.toml`).
- Contract `docs/API.md` · build plan `PLAN.md` · decisions `DECISIONS.md`.

**Ports.** app 8301 · worker 8302 · fake OpenAI server for tests 8303 · QA: app 8309, worker 8308, fake AI 8307.

**The guide is not ours.** `yek-guide-fulltext.txt` lives in `TF_GUIDE_DIR`
(`~/Claude/Reference/Yek Fractal Amp Guide`). It never enters git: no page text, no copies, no
fixtures made from it. The repo holds only derived data and short quotes (≤ 2 sentences, ≤ 320 characters), each
verified as an exact substring of its page.

## Standing rules
- `AGENTS.md` is the rulebook; `CLAUDE.md` is a symlink to it. `PLAN.md` is the build contract; read it first.
- Own your slice's paths only. Commit with `git commit -- <paths>`. Verify → commit → report.
- Numbers come from a QA worktree pinned to a sha (`rig qa --ref <sha>`), never from the shared tree.
- A check that cannot fail measured nothing. Every important check has a negative control, recorded in the
  build report.
- Browser tests use Playwright on chromium + webkit, at phone 390 and desktop 1280, with real input
  (click/tap/type). Tap targets are hit-tested with `document.elementFromPoint`. Screenshots with `pwshot` go
  into `docs/shots/`.
- **Honesty.** A quote is shown only if it is verified on its page. A model name is shown only if it is one of
  the guide's unit names. Knob values not from the guide say "starting guess — not from the guide". Song and
  artist facts the guide doesn't hold are "General knowledge (AI) — not from the guide" and are never attributed
  to yek. When nothing in the guide supports a query, the answer is "I can't point to the guide for that."
- Ares: the guide was written for Quantum 7.02. Anything touching Motor Drive or Transformer Grind is flagged
  with the Ares note (API.md §4.5).
- AI: optional, OpenAI `gpt-5.4-mini`, hard cap **CA$2** for the project, every paid call logged in D1 and in
  `docs/spend.md`. Tests use the fake server only. Never echo, log or commit a key.
- **Deploys only when Alexander says so** (he did on 2026-09-15: Worker, D1, secrets and the app are live). Nothing
  is sent. The guide's full page text is not loaded into the live database until Alexander decides (docs/DEPLOY.md §1).
- **Public repo hygiene.** The repo is public: `check-no-personal-data .` must print clean before every push; no home
  paths, keys, tokens or guide page text in git.
- Plain English. Dark, stage-readable UI (print view is white, low ink). No emoji as icons. No devils or demons
  imagery.
