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

| 2026-09-14T19:25:40Z | lead | gpt-5.4-mini | pick | 5,653 | 0 | 155 | 0.00493725 | 0.00685 | Final demo run at main a911158: "Van Halen brown sound" |
| 2026-09-14T19:25:44Z | lead | gpt-5.4-mini | cite | 781 | 0 | 237 | 0.00165225 | 0.00229 | Final demo run at main a911158: "Van Halen brown sound" |
| 2026-09-14T19:25:47Z | lead | gpt-5.4-mini | pick | 5,745 | 0 | 165 | 0.00505125 | 0.00700 | Final demo run at main a911158: "clean worship pad with sparkle" |
| 2026-09-14T19:25:49Z | lead | gpt-5.4-mini | cite | 6,909 | 0 | 310 | 0.00657675 | 0.00912 | Final demo run at main a911158: "clean worship pad with sparkle" |
| 2026-09-14T19:25:52Z | lead | gpt-5.4-mini | pick | 5,586 | 0 | 309 | 0.00558000 | 0.00774 | Final demo run at main a911158: "the rhythm tone on Master of Puppets" |
| 2026-09-14T19:25:55Z | lead | gpt-5.4-mini | cite | 8,872 | 2,816 | 688 | 0.00784920 | 0.01088 | Final demo run at main a911158: "the rhythm tone on Master of Puppets" |
| 2026-09-14T19:25:59Z | lead | gpt-5.4-mini | pick | 5,723 | 0 | 185 | 0.00512475 | 0.00711 | Final demo run at main a911158: "Robben Ford" |
| 2026-09-14T19:26:02Z | lead | gpt-5.4-mini | cite | 5,040 | 0 | 385 | 0.00551250 | 0.00764 | Final demo run at main a911158: "Robben Ford" |
| 2026-09-14T19:26:04Z | lead | gpt-5.4-mini | pick | 5,878 | 0 | 178 | 0.00520950 | 0.00722 | Final demo run at main a911158: "AC30 chime" |
| 2026-09-14T19:26:06Z | lead | gpt-5.4-mini | cite | 6,277 | 0 | 519 | 0.00704325 | 0.00977 | Final demo run at main a911158: "AC30 chime" |
| 2026-09-14T19:26:09Z | lead | gpt-5.4-mini | pick | 5,618 | 0 | 179 | 0.00501900 | 0.00696 | Final demo run at main a911158: "djent" |
| 2026-09-14T19:26:11Z | lead | gpt-5.4-mini | cite | 1,208 | 0 | 281 | 0.00217050 | 0.00301 | Final demo run at main a911158: "djent" |
| 2026-09-14T19:26:13Z | lead | gpt-5.4-mini | pick | 5,830 | 0 | 232 | 0.00541650 | 0.00751 | Final demo run at main a911158: "SRV Texas blues" |
| 2026-09-14T19:26:15Z | lead | gpt-5.4-mini | cite | 5,538 | 0 | 289 | 0.00545400 | 0.00756 | Final demo run at main a911158: "SRV Texas blues" |
| 2026-09-14T19:26:18Z | lead | gpt-5.4-mini | pick | 5,714 | 0 | 178 | 0.00508650 | 0.00705 | Final demo run at main a911158: "Brown Sound Deluxe" |
| 2026-09-14T19:26:20Z | lead | gpt-5.4-mini | cite | 5,169 | 0 | 409 | 0.00571725 | 0.00793 | Final demo run at main a911158: "Brown Sound Deluxe" |

Check (smoke test): input 25,244 × 0.75 / 1M + output 1,450 × 4.50 / 1M = 0.018933 + 0.006525 = **US$0.025458**;
× 1.3866 = CA$0.035300. Matches the Worker ledger (`GET /api/admin/spend`: spent_usd 0.025458, spent_cad 0.035300).

Check (final demo run, 16 calls, ledger `GET /api/admin/spend` on the demo Worker): input 85,541 (cached 2,816) and output 4,699 tokens = **US$0.083400** × 1.3866 = CA$0.115643. A ninth question repeated "Van Halen brown sound" and came back `cached`, cost 0.

**Running total: US$0.1089 · CA$0.1509 of CA$2.00** (20 calls).
