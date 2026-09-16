# Tone Finder

Type a tone ("Van Halen brown sound") and get 2–4 starting points for a Fractal Audio **Axe-Fx II XL+ on Ares**:
amp model, cab and seven starting knobs. Every suggestion quotes yek's guide to the amp models, with the page.

**Live:** **https://tone-finder-app.alexjpower74.workers.dev** (API: https://tone-finder.alexjpower74.workers.dev/api/health).
Deployed 2026-09-15. The live copy answers from the 866 short verified quotes in `data/models.json`; the guide's full
page text is **not** loaded into the cloud database (see "Deployed" below), so live search is quote-only and the AI
step waits for that decision. Source: https://github.com/alexjpower74-create/tone-finder.

## Open it locally

```bash
cd ~/Projects/"Tone Finder" && npm run demo
```

Then open **http://127.0.0.1:8301/**. The demo applies the local database migrations, starts the Worker on 8302
and the app on 8301, and loads the guide's 301 pages from your own copy into the local database. Add `?mock=1` to
any page to use the built-in demo data instead of the Worker.

- **Needs:** Node 26, `wrangler` on PATH, and yek's guide at `~/Claude/Reference/Yek Fractal Amp Guide/`
  (`yek-guide-fulltext.txt` + `yek-guide-sections.json`).
- **AI help** needs `OPENAI_API_KEY` in `worker/.dev.vars` (see `worker/.dev.vars.example`; it's already set on
  this machine). Without it, everything works except the AI step.
- **AI switch:** the Ask page shows AI help with an on/off switch and what's been spent.

Try the chips: "Van Halen brown sound", "clean worship pad with sparkle", "the rhythm tone on Master of Puppets",
"Robben Ford", "AC30 chime", "djent". Add picks to the **Binder** and print it for the rehearsal binder. It prints
white, with ink only on text.

## What's real

- **Everything comes from yek's guide** (rev. April 2017, written for Quantum 7.02). `data/models.json` holds the
  109 model sections: 205 unit names as the guide writes them, the spec tables, page numbers, tips, settings and
  cab lines. It stores 866 short quotes (≤ 2 sentences, 12.75% of the guide's text), each checked as an exact
  substring of its page. The guide itself is **not** in this repo; the app reads your local copy.
- **Splices are blocked.** Quotes never run across two boxes of the guide, never carry a running page header or
  page number, and never open with the previous passage's attribution. The p. 28 text "…like Eddie Van Halen “My
  settings…" is really two passages, and the second is Cliff's.
- **Starting guesses** are labelled "starting guess — not from the guide". Guide numbers, and the guide's rule that
  Master defaults to 10 on amps without a master volume (p. 12), show their page, and the sentence that states the
  value is displayed right under the dials. A knob whose quote doesn't state its value can't carry a page.
- **General knowledge** (songs, artists) only comes from the optional AI step. It's labelled "General knowledge (AI)
  — not from the guide". The AI can only pick models from the list, and its quotes are shown only if they're on
  the page it names.
- **Unsupported queries** get "I can't point to the guide for that.", with or without AI, unless the AI can say
  what the query is about (as it does for "Master of Puppets").
- **Ares:** the guide predates Quantum 9.00, which replaced Motor Drive and Transformer Grind with Speaker
  Compression. The app says so and quotes Fractal's release notes (`data/sources/`).
- **No SAMPLE businesses or people** in this project. The demo data (`?mock=1`) is real guide data; its one planted
  Ares flag is marked "Test sample from the demo data — not a guide quote."

## Tests

Final QA from a QA worktree pinned to `cc5c223`, every exit code gated:

| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| core: data rules, quote checks, box breaks, engine, knob citations, 23 golden queries, AI step on a fake server | 88 | 0 | 0 |
| Worker HTTP API (`wrangler dev --local`) | 16 | 0 | 0 |
| App, Playwright, chromium + webkit, 390 + 1280, real input | 188 | 0 | 120 (by design) |
| Live: app + shape checks against a real local Worker | 12 | 0 | 0 |

More than 40 negative controls were made red and restored (`docs/build-report*.md`).
AI spend: **CA$0.29 of the CA$2 cap**, 45 calls, one row each in `docs/spend.md`.

```bash
npm run test:core     # uses TF_FAKE_AI_PORT (default 8303)
npm run test:worker   # refuses to start if its ports are busy
npm run test:app
```

## Deployed

See `docs/DEPLOY.md` for what exists and how to redeploy (`cd worker && npx wrangler deploy`; `scripts/deploy-app.sh`).
- **Cloudflare:** Worker `tone-finder` + D1 `tone-finder` (migrated with `--remote`), secrets `ADMIN_TOKEN` and
  `OPENAI_API_KEY`, and the app as a static-assets Worker `tone-finder-app`.
- **Settled 2026-09-15:** yek approved the guide's text being in the cloud database; the 301 pages are loaded on the
  live Worker (`npm run load-guide`, sha verified) and AI help is on by default. The app has no login.
- **Not needed:** no cron, no domain chosen.

## Where to pick this up

- **Decisions and contract:** `DECISIONS.md` (why things are the way they are), `docs/API.md` (the contract),
  `data/golden.json` (acceptance queries), `docs/build-report.md` (QA history, lead errors, known gaps).
- **Rebuild the data** after a guide change: `npm run build:models`. Then rebuild the demo data with
  `node app/tools/build-mock.mjs`.
- **Improve answers:** add a query to `data/golden.json` first, watch it fail, then change `core/search.js` or
  `core/answer.js`. The contract rules in API.md §4 are what the tests enforce.
- **Worth doing next:**
  - Knob guesses per amp family (a Plexi and a Twin shouldn't both start at 5).
  - Show a dropped AI quote's reason on request.
  - A per-song memory in the Binder.
  - A check of the guide's cab names against the Ares cab list.
