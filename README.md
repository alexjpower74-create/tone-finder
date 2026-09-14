# Tone Finder

Type a tone ("Van Halen brown sound") and get 2–4 starting points for a Fractal Audio **Axe-Fx II XL+ on Ares**:
amp model, cab and seven starting knobs. Every suggestion quotes yek's guide to the amp models, with the page.

## Open it

```bash
cd ~/Projects/"Tone Finder" && npm run demo
```

Then open **http://127.0.0.1:8301/**. The demo applies the local database migrations, starts the Worker on 8302 and
the app on 8301, and loads the guide's pages from your own copy into the local database. `?mock=1` on any page
shows the built-in demo data instead of the Worker.

Needs: Node 26, `wrangler` on PATH, and yek's guide at `~/Claude/Reference/Yek Fractal Amp Guide/`
(`yek-guide-fulltext.txt` + `yek-guide-sections.json`). AI help needs `OPENAI_API_KEY` in `worker/.dev.vars`
(see `worker/.dev.vars.example`); without it everything works except the AI step.

## What's real

- **Everything comes from yek's guide** (rev. April 2017, written for Quantum 7.02). `data/models.json` holds the
  109 model sections: names as the guide writes them, specs, page numbers and short quotes (≤ 2 sentences, each
  checked as an exact substring of its page). The guide itself is **not** in this repo; the app reads your local
  copy.
- **Starting guesses** are labelled "starting guess — not from the guide". Guide numbers and the guide's
  no-master-volume rule (p. 12) are shown with their page.
- **General knowledge** (songs, artists) only comes from the optional AI step and is labelled "General knowledge
  (AI) — not from the guide". The AI can only pick models from the list, and its quotes are dropped unless they are
  on the page it names.
- **Ares:** the guide predates the Amp block change in Quantum 9.00 (Motor Drive and Transformer Grind replaced by
  Speaker Compression). The app says so and quotes Fractal's release notes (`data/sources/`).
- There are no SAMPLE businesses or people in this project. The mock (`?mock=1`) uses real guide data; its one
  planted Ares flag is marked `SAMPLE (test only)`.

## Tests

_Numbers from the final QA run go here._

```bash
npm run test:core     # data rules, quote checks, engine, golden queries, AI step (fake OpenAI server)
npm run test:worker   # HTTP API against wrangler dev --local
npm run test:app      # Playwright, chromium + webkit, 390 + 1280
```

## What deploying needs

See `docs/DEPLOY.md`. In short: D1 database `tone-finder`, secrets `ADMIN_TOKEN` (and optionally
`OPENAI_API_KEY`), a one-off `load-guide` into the deployed database, and a decision about hosting the guide's text.
No cron. Nothing has been deployed.

## Where to pick this up

_Filled in at the end of the build._
