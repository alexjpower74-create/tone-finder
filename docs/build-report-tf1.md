# Build report — tf1 (guide data, answer engine, AI step, Worker + D1)

**data ready** — `data/models.json` (109 models, schema 1) is committed on `rig/tf1` with `data/curation.json`,
`core/models.js`, `core/brands.js`, `core/labels.js`, `scripts/build-models.mjs`, `core/tests/models.test.mjs` and
`docs/DATA.md`. Ready for tf2's cross-review of the shapes.

## Contract questions

1. **Dweezil’s B-man is a stub by §0, but golden `stub_ids` leaves it out.** p. 139 holds only "Please refer to
   the section on the 65 Bassguy model." The data marks it `refers_to: "65-bassguy"`. Without that it would be a
   suggestable model with no quotes of its own. `models.test.mjs` asserts golden's five stubs exactly and names this
   one extra explicitly. Suggest adding `"dweezils-b-man": "65-bassguy"` to `stub_ids`/`stub_targets`/`never_ids`.
2. **The §4.1 stop list is missing some function words.** With the list as written, "banjo through a toaster"
   finds `through` in the tips/synopsis (weight 3) of Euro Blue and Tube Pre, so `through` counts as strong and
   the answer is `ok`, against golden. `core/search.js` adds `EXTRA_STOP_WORDS` = through into onto over under
   about via as or but than, kept in one place so the lead can adopt or drop it.
3. **`taper_note` shape.** §4.3.7 says "the taper-match convention quote (p. 12)" and the §6 example shows
   `null`. The engine emits `{ "quote": "…", "page": 12 }` or `null`. tf2's mock should use the same.

## Step 1 — Foundations: DONE (c346d2f)

`core/text.js` (`normText`, `splitSentences`, `findWholeWord`), `core/guide.js` (`parsePages`, `pageText`,
`pagesSha256Input`, `pagesSha256`), `core/verify.js` (`verifyQuote` / `checkQuote` with a reason),
`core/tests/foundations.test.mjs` on the real guide: the API.md example quotes verify; one changed character fails;
the 1959SLP synopsis against p. 29 fails; a real 3-sentence passage from p. 12 fails (its first two sentences pass);
321 characters fails while 320 of the same text passes the length rule; pages 0, 302, 28.5 and "28" fail; a missing
`TF_GUIDE_DIR` makes a child process exit non-zero with `guide not found at /nonexistent-tf-guide/yek-guide-fulltext.txt`.
The test file itself loads the guide at top level, so a missing guide fails the run rather than skipping.

## Step 2 — Data: DONE

See `docs/DATA.md` for method, counts and what was left out. `core/tests/models.test.mjs`: rules 1–7, golden
`model_count`, `ids_must_exist`, `names_resolve_to` (all 110 names), `names_never`, `stub_ids`/`stub_targets`,
determinism against the committed file, and a curated quote with one changed word stopping the build.
Quote budget printed: 876 quotes, 70,042 of 540,437 characters (12.96%).

## Step 3 — Engine: DONE

`core/search.js` (§4.1 terms, n-grams, weights, df/idf, strong terms, candidates, intent), `core/answer.js`
(§4.2 why picking, unit name, suggestion and Answer shape), `core/knobs.js` (§4.3), `core/ares.js` (§4.5).
`core/tests/golden.test.mjs` runs all 15 golden queries with AI off and checks every expectation plus invariants
(never_ids, 1–3 verified why quotes, unit name belongs to the model, seven knobs in order, no-support shape);
`core/tests/engine.test.mjs`: guide knobs with the quote (1959SLP Bass 2), guide_rule Master 10 with the p. 12
quote, a no-settings model gives seven guesses with the exact note, the Brit Brown "Turn up Presence" tip nudges
the Presence guess to 7 while 1959SLP's Bass/Mid/Treble directions leave its guide values alone, clamping, the
same-unit-name settings pick, `pages: null` answers from stored quotes only, the planted "SAMPLE (test only): add
Transformer Grind" tip gives exactly one `ares_flags` entry (and the unplanted data none), and `ares` deep-equals
§4.5 (and the lead's `data/sources` quotes).

Engine choices worth knowing:
- `understood.unmatched_terms` lists unconsumed non-stop, non-generic single words (not every zero-df n-gram).
- With pages loaded, every why quote is re-verified at answer time; with `pages: null` only stored quotes are used.
- `ai.reason` is `"ok"` when the AI step ran fresh (§5 names only the not-used reasons and `"cached"`).

## Step 4 — AI step: DONE

`core/ai.js`: pick → re-search with `search_terms` → cite → verify (page inside the model, then `verifyQuote`;
too long / 3 sentences → `quote_too_long`) → merge, with the §5.8 estimate before each call, `ai_calls` rows via an
injected store, the §5.9 cache key, and `error` on HTTP error, timeout, bad JSON or a thrown fetch. Errors carry a
code only. `worker/tests/fake-openai.mjs`: scenarios by word, `/count`, `/reset`, `/last` (request shape, never the
key). `core/tests/ai.test.mjs` (fake on 8303): fake-plant keeps only (i) and lists the four drops; fake-puppets gives
USA IIC+ `ai_checked` with the p. 270 quote and labelled general knowledge; cap below the estimate → `spend_cap` and
0 requests (also with a store already at CA$1.999); cache hit → count unchanged, `cost_cad: 0`; fake 500 and bad
JSON → `error` with the same suggestions as the guide search; off / no_key / guide_not_loaded → 0 requests; request
shape; spend math; a key-bearing thrown fetch error and an unreachable base URL never put the key in any Answer.

## Negative controls

| # | Break | Expected red | Result |
|---|---|---|---|
| a (core) | `checkQuote` returns `{ ok: true }` first | changed-character tests | RED: 5 tests failed (changed character, wrong page, 3 sentences, 321 chars, page 0/302). Restored with `git checkout`, 11/11 green. |
| a (AI) | same break | fake-plant changed-character citation | RED: fake-plant failed (the "Plexy" citation survived). Restored, 9/9. |
| b | `checkPick` accepts any unit name (`\|\| p.unit_name`) | "Brown Sound Deluxe" test | RED: fake-plant failed. Restored, 9/9. |
| c | citation page range check removed | `bad_page` test | RED: fake-plant failed (the p. 60 quote survived for 1959SLP). Restored, 9/9. |
| d | generic words can be strong | golden "Master of Puppets", "lead tone" | RED: exactly those two failed. Restored, 16/16. |
| e | `if (spent + est > p.cap)` → `if (false)` | zero-request cap test | RED: cap test failed. Restored, 9/9. |
| i | search indexes stubs as their own models | golden `never_ids` | RED: never_ids test + golden "Slash" and "Steve Vai" (stubs outranked their targets). Restored, 16/16. |
| f | one model spliced out of `data/models.json` | count/order test | RED: both rule 1 tests + 3 others. Restored from backup, 11/11 green. |
| g | `QUOTE_BUDGET` 0.15 → 0.01 | budget test | RED: "quote budget 0.1296 > 0.01". Restored, 11/11 green. |

## Cross-slice needs

- None yet. `scripts/demo.mjs` will call tf2's `app/serve.mjs` by path (step 6).
