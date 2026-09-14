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

## Negative controls

| # | Break | Expected red | Result |
|---|---|---|---|
| a (core) | `checkQuote` returns `{ ok: true }` first | changed-character tests | RED: 5 tests failed (changed character, wrong page, 3 sentences, 321 chars, page 0/302). Restored with `git checkout`, 11/11 green. AI half of (a) pending step 4. |
| f | one model spliced out of `data/models.json` | count/order test | RED: both rule 1 tests + 3 others. Restored from backup, 11/11 green. |
| g | `QUOTE_BUDGET` 0.15 → 0.01 | budget test | RED: "quote budget 0.1296 > 0.01". Restored, 11/11 green. |

## Cross-slice needs

- None yet. `scripts/demo.mjs` will call tf2's `app/serve.mjs` by path (step 6).
