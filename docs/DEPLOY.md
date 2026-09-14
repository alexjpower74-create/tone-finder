# Deploying Tone Finder (not done — Alexander reviews first)

Nothing has been deployed. Everything below is what a deploy would need. Run none of it without Alexander's go.

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
wrangler d1 create tone-finder                      # copy the database_id into wrangler.toml
wrangler d1 migrations apply tone-finder --remote   # deploy does not migrate
wrangler secret put ADMIN_TOKEN                     # a long random string
wrangler secret put OPENAI_API_KEY                  # optional
wrangler deploy
```
Vars in `wrangler.toml` (not secrets): `AI_MODEL`, `AI_CAP_CAD`, `USD_CAD`, `AI_PRICE_*`, `OPENAI_BASE_URL`.
No cron: Tone Finder has no scheduled work.

Load the guide once into the deployed database (pages come from your local copy, never from git):
```bash
TF_WORKER_URL=https://tone-finder.<account>.workers.dev TF_ADMIN_TOKEN=<token> npm run load-guide
```
Then check `GET /api/health`: `models: 109`, `guide.loaded: true`, `guide.sha_ok: true`.

## 3. App
Static files in `app/`. Either Workers static assets or Pages. Set the API origin in each page's
`<meta name="api-base">` (or serve the app from the same origin as the Worker). No domain has been chosen.

## 4. Smoke test after deploy
- Ask "Van Halen brown sound" → cards with page pills; open one page in the PDF and find the quote.
- Ask "banjo through a toaster" → "I can't point to the guide for that."
- `GET /api/admin/spend` with the token → spend matches `docs/spend.md` plus anything new.
