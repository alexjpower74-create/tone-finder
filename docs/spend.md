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
| 2026-09-14T19:17:31Z | lead | gpt-5.4-mini | pick | 5,560 | 0 | 300 | 0.00552000 | 0.00765 | Smoke test at main d24e11e (QA Worker 8308): "the rhythm tone on Master of Puppets" |
| 2026-09-14T19:17:35Z | lead | gpt-5.4-mini | cite | 9,243 | 0 | 330 | 0.00841725 | 0.01167 | same question: kept USA IIC++ (p. 270 "Metallica’s IIC+"), 0 drops |
| 2026-09-14T19:17:38Z | lead | gpt-5.4-mini | pick | 5,627 | 0 | 136 | 0.00483225 | 0.00670 | "Van Halen brown sound" |
| 2026-09-14T19:17:40Z | lead | gpt-5.4-mini | cite | 4,814 | 0 | 684 | 0.00668850 | 0.00927 | same question: kept Brit Brown, 5153, PVH 6160 Block, PVH 6106+, 0 drops |

Check (smoke test): input 25,244 × 0.75 / 1M + output 1,450 × 4.50 / 1M = 0.018933 + 0.006525 = **US$0.025458**;
× 1.3866 = CA$0.035300. Matches the Worker ledger (`GET /api/admin/spend`: spent_usd 0.025458, spent_cad 0.035300).

**Running total: US$0.0255 · CA$0.0353 of CA$2.00** (4 calls).
