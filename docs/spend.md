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

| 2026-09-14T19:30:59Z | tf1 tests (by accident) | gpt-5.4-mini | pick | 5,717 | 0 | 198 | 0.00517875 | 0.00718 | tf1's worker test run reached the lead's demo Worker on 8302 (DECISIONS 23); ledger id 17 |
| 2026-09-14T19:31:05Z | tf1 tests (by accident) | gpt-5.4-mini | cite | 5,172 | 0 | 434 | 0.00583200 | 0.00809 | tf1's worker test run reached the lead's demo Worker on 8302 (DECISIONS 23); ledger id 18 |
| 2026-09-14T19:31:08Z | tf1 tests (by accident) | gpt-5.4-mini | pick | 5,590 | 0 | 254 | 0.00533550 | 0.00740 | tf1's worker test run reached the lead's demo Worker on 8302 (DECISIONS 23); ledger id 19 |
| 2026-09-14T19:31:10Z | tf1 tests (by accident) | gpt-5.4-mini | cite | 9,247 | 0 | 317 | 0.00836175 | 0.01159 | tf1's worker test run reached the lead's demo Worker on 8302 (DECISIONS 23); ledger id 20 |
| 2026-09-14T19:31:13Z | tf1 tests (by accident) | gpt-5.4-mini | pick | 5,621 | 0 | 199 | 0.00511125 | 0.00709 | tf1's worker test run reached the lead's demo Worker on 8302 (DECISIONS 23); ledger id 21 |
| 2026-09-14T19:31:16Z | tf1 tests (by accident) | gpt-5.4-mini | cite | 3,145 | 0 | 342 | 0.00389775 | 0.00540 | tf1's worker test run reached the lead's demo Worker on 8302 (DECISIONS 23); ledger id 22 |

| 2026-09-14T19:35:59Z | lead | gpt-5.4-mini | pick | 5,716 | 5,376 | 217 | 0.00163470 | 0.00227 | Round-6 check on the demo Worker (main 24a54f4, citation locating): "Van Halen brown sound"; ledger id 23 |
| 2026-09-14T19:36:01Z | lead | gpt-5.4-mini | cite | 5,437 | 0 | 390 | 0.00583275 | 0.00809 | Round-6 check on the demo Worker (main 24a54f4, citation locating): "Van Halen brown sound"; ledger id 24 |
| 2026-09-14T19:36:04Z | lead | gpt-5.4-mini | pick | 5,878 | 5,376 | 241 | 0.00186420 | 0.00258 | Round-6 check on the demo Worker (main 24a54f4, citation locating): "AC30 chime"; ledger id 25 |
| 2026-09-14T19:36:06Z | lead | gpt-5.4-mini | cite | 6,277 | 2,816 | 411 | 0.00465645 | 0.00646 | Round-6 check on the demo Worker (main 24a54f4, citation locating): "AC30 chime"; ledger id 26 |
| 2026-09-14T19:36:08Z | lead | gpt-5.4-mini | pick | 5,723 | 5,376 | 152 | 0.00134745 | 0.00187 | Round-6 check on the demo Worker (main 24a54f4, citation locating): "Robben Ford"; ledger id 27 |
| 2026-09-14T19:36:10Z | lead | gpt-5.4-mini | cite | 5,040 | 4,864 | 443 | 0.00249030 | 0.00345 | Round-6 check on the demo Worker (main 24a54f4, citation locating): "Robben Ford"; ledger id 28 |
| 2026-09-14T19:36:13Z | lead | gpt-5.4-mini | pick | 5,745 | 5,376 | 186 | 0.00151695 | 0.00210 | Round-6 check on the demo Worker (main 24a54f4, citation locating): "clean worship pad with sparkle"; ledger id 29 |
| 2026-09-14T19:36:14Z | lead | gpt-5.4-mini | cite | 6,909 | 6,400 | 271 | 0.00208125 | 0.00289 | Round-6 check on the demo Worker (main 24a54f4, citation locating): "clean worship pad with sparkle"; ledger id 30 |

| 2026-09-14T19:41:09Z | lead | gpt-5.4-mini | pick | 5,586 | 5,376 | 238 | 0.00163170 | 0.00226 | Final screenshots on the restarted demo (main dab11d8, answer cache cleared): "the rhythm tone on Master of Puppets"; ledger id 31 |
| 2026-09-14T19:41:11Z | lead | gpt-5.4-mini | cite | 7,464 | 4,864 | 276 | 0.00355680 | 0.00493 | Final screenshots on the restarted demo (main dab11d8, answer cache cleared): "the rhythm tone on Master of Puppets"; ledger id 32 |
| 2026-09-14T19:41:24Z | lead | gpt-5.4-mini | pick | 5,716 | 5,376 | 217 | 0.00163470 | 0.00227 | Final screenshots on the restarted demo (main dab11d8, answer cache cleared): "Van Halen brown sound"; ledger id 33 |
| 2026-09-14T19:41:26Z | lead | gpt-5.4-mini | cite | 4,893 | 0 | 417 | 0.00554625 | 0.00769 | Final screenshots on the restarted demo (main dab11d8, answer cache cleared): "Van Halen brown sound"; ledger id 34 |
| 2026-09-14T19:41:39Z | lead | gpt-5.4-mini | pick | 5,878 | 5,376 | 172 | 0.00155370 | 0.00215 | Final screenshots on the restarted demo (main dab11d8, answer cache cleared): "AC30 chime"; ledger id 35 |
| 2026-09-14T19:41:41Z | lead | gpt-5.4-mini | cite | 6,277 | 5,888 | 186 | 0.00157035 | 0.00218 | Final screenshots on the restarted demo (main dab11d8, answer cache cleared): "AC30 chime"; ledger id 36 |
| 2026-09-14T19:41:54Z | lead | gpt-5.4-mini | pick | 5,583 | 0 | 241 | 0.00527175 | 0.00731 | Final screenshots on the restarted demo (main dab11d8, answer cache cleared): "banjo through a toaster"; ledger id 37 |
| 2026-09-14T19:41:56Z | lead | gpt-5.4-mini | cite | 4,636 | 0 | 543 | 0.00592050 | 0.00821 | Final screenshots on the restarted demo (main dab11d8, answer cache cleared): "banjo through a toaster"; ledger id 38 |

| 2026-09-14T19:46:46Z | lead | gpt-5.4-mini | pick | 5,614 | 0 | 211 | 0.00516000 | 0.00715 | Guard check on the demo Worker (main 287c9a4, tf-ai-4): "banjo through a toaster" (guard: no-support answer, pick call only); ledger id 39 |
| 2026-09-14T19:46:48Z | lead | gpt-5.4-mini | pick | 5,617 | 0 | 326 | 0.00567975 | 0.00788 | Guard check on the demo Worker (main 287c9a4, tf-ai-4): "the rhythm tone on Master of Puppets" (still USA IIC++); ledger id 40 |
| 2026-09-14T19:46:51Z | lead | gpt-5.4-mini | cite | 9,243 | 2,816 | 598 | 0.00772245 | 0.01071 | Guard check on the demo Worker (main 287c9a4, tf-ai-4): same question; ledger id 41 |

Check (smoke test): input 25,244 × 0.75 / 1M + output 1,450 × 4.50 / 1M = 0.018933 + 0.006525 = **US$0.025458**;
× 1.3866 = CA$0.035300. Matches the Worker ledger (`GET /api/admin/spend`: spent_usd 0.025458, spent_cad 0.035300).

Check (final demo run, 16 calls, ledger `GET /api/admin/spend` on the demo Worker): input 85,541 (cached 2,816) and output 4,699 tokens = **US$0.083400** × 1.3866 = CA$0.115643. A ninth question repeated "Van Halen brown sound" and came back `cached`, cost 0.

Check (accidental test calls, ids 17–22): 3 questions × pick + cite, input 34,492 and output 1,744 tokens = US$0.033717 × 1.3866 = CA$0.046752. tf1 first estimated 2 calls; the ledger shows 6.

Check (round-6 check, ids 23–30): US$0.021424 × 1.3866 = CA$0.029707; OpenAI prompt caching now covers most of each pick prompt. Demo ledger after it: 30 calls, US$0.138542, CA$0.192102.

Check (final screenshots, ids 31–38): US$0.026686 × 1.3866 = CA$0.037002. Before them the answer cache was cleared (`DELETE FROM answer_cache` on the local database) so no answer made before the round-7 attribution fix is served; the ledger was kept. Demo ledger after it: 38 calls, US$0.165227, CA$0.229104.

Check (guard check, ids 39–41): US$0.018562 × 1.3866 = CA$0.025738. Demo ledger after it: 41 calls, US$0.183789, CA$0.254842.

**Running total: US$0.2092 · CA$0.2901 of CA$2.00** (45 calls: 4 in the QA smoke test, 41 in the demo database).
