# Tone Finder — build report (lead)

Overnight build, 2026-09-14. Lead tf-lead (Opus 5 xhigh), slices tf1 (guide data, engine, AI step, Worker: 7
rounds) and tf2 (app: 4 rounds + a final rebuild), both Opus 5 medium. Contract: `PLAN.md`, `docs/API.md`,
`data/golden.json`. Every decision with its reason: `DECISIONS.md` (25 entries). Slice detail, with every negative
control and its failure message: `docs/build-report-tf1.md`, `docs/build-report-tf2.md`.

## Final QA

From the lead's QA worktree pinned with `rig qa --ref cc5c223` (ports 8305–8309), every exit code gated:

| Suite | Sha | Passed | Failed | Skipped | Exit |
|---|---|---|---|---|---|
| core (`node --test core/tests`: data rules, quote checks, box breaks, engine, knob citations, 23 golden queries, AI step on a fake OpenAI server) | cc5c223 | 88 | 0 | 0 | 0 |
| worker (`npm --prefix worker test`: HTTP API on `wrangler dev --local`, fake AI, low-cap instance) | cc5c223 | 16 | 0 | 0 | 0 |
| app (Playwright, chromium + webkit, 390 + 1280, real input, mock) | cc5c223 | 188 | 0 | 120 | 0 |
| live (the Ask journey + §6 shape checks against a real local Worker with the guide loaded) | cc5c223 | 12 | 0 | 0 | 0 |

The 120 app skips are by design: run-once data and server specs (serve, quotes, shape) skip on three of the four
projects, the phone-only spec skips on desktop, and `live.spec` skips without `TF_LIVE_API` (it ran separately, above).

## Real AI calls

45 calls, **CA$0.29 of the CA$2 cap** (`docs/spend.md`, one row per call, checked against the Worker's own ledger).
Brief examples with AI on: "the rhythm tone on Master of Puppets" → USA IIC++ as an AI pick quoting p. 270
"Metallica’s IIC+", with labelled general knowledge; "Van Halen brown sound" → Brit Brown, then 1959SLP / PLEXI
100W ("Eddie Van Halen had all controls on his Plexi dimed."); "banjo through a toaster" → "I can't point to the
guide for that." No key material in any log, answer or tracked file.

## Grading history (lead's QA worktree)

| Sha | What | core | worker | app / live |
|---|---|---|---|---|
| 30cd516 | tf1 data | 22/22 | — | — |
| fb08bd1 | main after data merge + six stubs in golden | 21/22 (golden stub test hard-coded five) | — | — |
| 80f4ccb | tf1 engine, AI step, Worker | 56/56 | 16/16 | — |
| 9777206 | main with both slices | — | — | live + shape 15 passed, 9 skipped by design |
| 61f197a | tf1 round 2 | 67/68 (golden The Edge chime; fixed by contract #18) | 16/16 on rerun (first run collided with tf1's own QA run, #19) | — |
| 01dce76 | tf1 round 3 | 73/73 | 16/16 | — |
| a16eb73 | tf1 round 4 | 75/75 | 16/16 | — |
| 9ab758e | tf2 round 3 | — | — | app 182 passed, 114 skipped |
| afbceec | tf1 round 5 | 77/77 | 16/16 | — |
| 24a54f4 | main, tf1 round 6 + tf2 round 4 | 81/81 | 16/16 | — |
| d85ff29 | main + tf2 final | — | — | app 183 / 117 skipped; live 12/12 |
| dab11d8 | main + tf1 round 7 | 83/83 | 16/16 | app 183 / 117; live 12/12 |
| 287c9a4 | lead fix: no AI suggestions for unsupported, unexplained queries | 85/85 | 16/16 | app 183 / 117; live 12/12 |
| **cc5c223** | **lead fix after Onyx's review: a knob's page needs a displayed sentence that states the value (#25)** | **88/88** | **16/16** | **app 188 / 120; live 12/12** |

## What the lead's own reading found (the slices' tests didn't)

- **A true-but-misleading splice.** "Or just crank everything, like Eddie Van Halen “My settings for a “typical”
  Plexi tone are Bass 2, Mid 8, Treble 7.5." (p. 28) read as if Van Halen gave Cliff's settings. Exact-substring
  verification can't see it. Fixed by the raw-line-break box-break rule, later extended to running headers,
  page-number footers and leading attributions (#14, #15, #20, tf1 round 7).
- **Ranking faults**, found by reading real answers to 23 realistic queries: Metallica, The Edge chime, sparkly
  clean, brown sound, SRV Texas blues (#16, #18).
- **Onyx's review** caught one citation the lead missed: Master 10 was cited p. 12 while the card displayed only the
  taper sentence, which names Master but states no value. Now every knob page has its sentence on the card, and a
  quote that doesn't state the value can't carry a page (#25).
- **The real model's quirks:** general knowledge about the guide itself (#21); citations lost to quote-mark and
  case differences (#22); nonsense queries turned into suggestions (#24).

## Negative controls

More than 40 checks were made red on purpose and restored, each recorded with its failure message in the slice
reports. Among them:
- Quote checker accepting everything.
- An invented unit name ("Brown Sound Deluxe") and a wrong page.
- Generic words counted as strong.
- Stubs indexed as models, and the spend cap removed.
- Box-break splitting, header breaks, coverage and filler-word phrases each disabled.
- AI citation locating and the two-suggestion floor disabled.
- Guesses drawn like guide values, and page pills removed.
- Print CSS, binder persistence and tap-target size broken.
- Shape rules broken, and the lead's own no-support guard disabled.

Three controls were first found **void** and then fixed: tf1's admin-token check, tf1's coverage factor, and tf2's
round-4 gate, which passed while the suite never started because the lead's demo held its port.

## Lead errors, and what they cost

- **Shared QA worktree (16:37).** tf1 and the lead ran `rig qa` in the same QA worktree on the same ports. That
  caused two flakes, both rerun green. Since then only the lead uses the QA worktree (#19).
- **Demo on the slices' dev ports.** tf1's Worker tests ran against the real demo Worker (6 real calls, CA$0.047,
  logged), and tf2's suite didn't start. Both slices found it themselves and hardened their runners (#23).
- **Contract rules that had to be corrected.** A too-broad joined-passage regex (#15) and a stop-word rule that
  blocked "brown sound" (#18).

## Known gaps

- **Model names are only the ones the guide writes:** 205 unit names over 109 sections. Some real Ares amp types
  (for example the 1959SLP's individual channels) aren't named, and cab names are the guide's, from the Quantum
  7.02 era.
- **Knob guesses are simple:** Drive by intent, the rest 5, nudged by a tip. Always labelled.
- **AI citations:** about one quote per AI question still fails exact verification and is dropped (listed on the
  page).
- **General knowledge is not verified,** only labelled and filtered.
- **The Binder is per device** (`localStorage`). There's no login.
- **Deploying means deciding** whether the guide's text may sit in a cloud database (`docs/DEPLOY.md`).
