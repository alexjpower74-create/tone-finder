# Deploying Tone Finder

**Deployed 2026-09-15** on Alexander's go.
- App: https://tone-finder-app.alexjpower74.workers.dev (static-assets Worker `tone-finder-app`, built by
  `scripts/deploy-app.sh` from `app/` into `deploy/dist/`, api-base rewritten to the API Worker).
- API Worker: https://tone-finder.alexjpower74.workers.dev (`worker/`, `npx wrangler deploy`).
- D1: `tone-finder`, id `765d3265-7af8-4bc4-b889-b6f64974faed`, migration `0001_init.sql` applied `--remote`.
- Secrets: `ADMIN_TOKEN` (local copy in `~/.config/tone-finder/env`, mode 600) and `OPENAI_API_KEY`. AI help is
  on by default with the CA$2 cap in `wrangler.toml`.
- **Not done:** `load-guide` into the live database. The guide's page text is not in the cloud until Alexander
  decides (§1). Live search runs on the stored quotes only; `/api/health` shows `guide.loaded: false`.

Redeploy: `cd worker && npx wrangler deploy` for the API; `scripts/deploy-app.sh` for the app. The checklist below is
kept as written.

## 1. Decide first
- **The guide's text in a cloud database.** The Worker searches yek's guide page by page, so a deployed Worker
  needs the 301 pages in its D1 database. The repo never holds them. A private deploy for your own use is the
  natural reading; anything public should ask yek (Alexander van Engelen, via the Fractal forum) first. Without
  the pages the app still works from the short stored quotes, but search gets much weaker and AI help is off.
- **AI help.** Keep it (OpenAI key, CA$2 cap, answers cached) or leave `OPENAI_API_KEY` unset for guide search only.
- **Who can open it.** It has no login. Put it behind Cloudflare Access, or keep it local.

## 2. Worker + D1
```bash
cd worker
wrangler d1 create tone-finder                      # replace database_id = "LOCAL-ONLY-set-at-deploy" in wrangler.toml
wrangler d1 migrations apply tone-finder --remote   # deploy does not migrate
wrangler secret put ADMIN_TOKEN                     # a long random string
wrangler secret put OPENAI_API_KEY                  # optional
wrangler deploy
```
Vars already in `wrangler.toml` (not secrets): `OPENAI_BASE_URL`, `AI_MODEL`, `AI_CAP_CAD` (2.00), `USD_CAD`
(1.3866, update it), `AI_PRICE_IN_PER_M`, `AI_PRICE_CACHED_IN_PER_M`, `AI_PRICE_OUT_PER_M`. The spend cap counts
what the deployed database has recorded, so a fresh database starts at CA$0 again: lower `AI_CAP_CAD` by what
`docs/spend.md` already shows if the CA$2 is meant to cover local testing too. The top comment in `wrangler.toml`
now records the deploy.
No cron: Tone Finder has no scheduled work.

Load the guide once into the deployed database (pages come from your local copy, never from git):
```bash
TF_WORKER_URL=https://tone-finder.<account>.workers.dev ADMIN_TOKEN=<token> npm run load-guide
```
Then check `GET /api/health`: `models: 109`, `guide.loaded: true`, `guide.sha_ok: true`.

## 3. App
Static files in `app/`. Either Workers static assets or Pages. Set the API origin in each page's
`<meta name="api-base">` (or serve the app from the same origin as the Worker). No domain has been chosen.

## 4. Smoke test after deploy
- Ask "Van Halen brown sound" → cards with page pills; open one page in the PDF and find the quote.
- Ask "banjo through a toaster" → "I can't point to the guide for that."
- `GET /api/admin/spend` with the token → spend matches `docs/spend.md` plus anything new.
