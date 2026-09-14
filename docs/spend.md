# AI spend ledger

Cap: **CA$2** for the whole project. The Worker refuses any call whose worst case would cross it
(`AI_CAP_CAD`, docs/API.md §5). Every paid model call is one row here, copied from the local D1 `ai_calls` table
(`GET /api/admin/spend`).

Prices used (`worker/.dev.vars`): OpenAI `gpt-5.4-mini` US$0.75 per 1M input tokens, US$0.075 per 1M cached input
tokens, US$4.50 per 1M output tokens (checked by jr-lead on 2026-09-14 at
https://developers.openai.com/api/docs/pricing). CA$ = US$ × 1.3866, the Bank of Canada USD/CAD rate for
2026-09-11 (latest observation when fetched on 2026-09-14 from the Valet API).

Slices make no paid calls: their tests use the fake OpenAI server.

| date (UTC) | who | model | step | input tokens | cached | output tokens | US$ | CA$ | what for |
|---|---|---|---|---|---|---|---|---|---|

**Running total: US$0.0000 · CA$0.0000 of CA$2.00** (0 calls).
