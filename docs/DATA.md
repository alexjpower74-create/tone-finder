# `data/models.json` — how it was built

Owner: tf1. Built by `npm run build:models` (`scripts/build-models.mjs`) from the local guide in `TF_GUIDE_DIR`
(`yek-guide-fulltext.txt` + `yek-guide-sections.json`) plus `data/curation.json`. The build is deterministic
(guide order, fixed key order, no timestamps); `core/tests/models.test.mjs` rebuilds it twice and compares both
runs with the committed file. Every quote is checked with `verifyQuote` (API.md §0). A **curated** quote that
fails stops the build; a **mechanical** cut that fails is dropped and counted (`node scripts/build-models.mjs --log`).

## Counts (build of 2026-09-14)

| What | Count |
|---|---|
| Models (sections) | 109, in guide order |
| Stubs | 6: `brit-pre`, `brit-super`, `das-metall`, `dweezils-b-man`, `legato-100`, `usa-iic-plus-plus` |
| Unit names | 205 |
| Tips | 146 |
| Settings entries (curated) | 20 across 18 models |
| Directions | 58 |
| Notes | 125 |
| Cab notes | ≤ 2 per model |
| Conventions (p. 12) | 6 |
| Mechanical cuts shrunk / dropped | 3 / 3 |
| Quotes shortened at box breaks or clean cuts (rounds 2–3) | 24 |

**Quote budget:** 866 stored quotes plus unit-name evidence and settings context = 69,256 characters, against
540,437 characters of `pageText` over all 301 pages: **12.81%** (limit 15%). The test prints both numbers.

## How each field was made

- **Sections, name, based_on, pages.** One model per `yek-guide-sections.json` entry except the 4 appendix
  entries. `pages.end` is the next entry's page − 1. `based_on` is the text inside the title's parentheses.
  The two `Suhr Badger` sections take their names from the TOC sub-entries (`Suhr Badger 18`, `Suhr Badger 30`).
- **Stubs.** A one-page section whose text is "Please refer to the section on the X model(s)." `refers_to` is the
  non-stub model whose name starts with X. This finds golden's five stubs and also **Dweezil’s B-man** (p. 139,
  "Please refer to the section on the 65 Bassguy model."), which golden doesn't list; see the build report,
  Contract question 1.
- **Unit names** (rule 3), four sources, merged case-insensitively with the section-page spelling first:
  1. the title's name part split on `, ` / ` and ` / ` / ` (`Brit 800, Brit 800 Mod and Brit 800 #34`). Titles
     ending in "models" give none. Two titles are curated: `Euro Blue and Red` gives only `Euro Blue` ("Red" alone isn't a
     unit name; the guide writes `Euro Red` in the section's own how-to on p. 145, added from there), and `Friedman BE and HBE` gives
     only `Friedman BE` (the guide never writes "Friedman HBE", so no HBE name is stored);
  2. body variant bullets (`• Dizzy V4 Blue 2 – …`, `- Prince Tone NR – …`) whose name starts with one of the
     model's own names, so channel labels such as `Mode #34` or `OD1` are not taken;
  3. TOC sub-entries between "The Amps" and "Amp Categories", name part before `: ` or ` (`. Slash lists are
     expanded only where curated (`Plexi 100W HIGH/JUMP/NRML`, k = 1; `Plexi 50W HI 1/JUMP/NRML`, k = 2).
     `FAS Brown` under FAS custom models is skipped because the body says "FAS Brown See Brit Brown.";
  4. the appendix tables (pp. 295–298): on each line, the longest all-caps suffix that starts with a known name.
     One alias is curated (`SOLO 99` → Solo 88 and Solo X99). A two-word all-caps line that matches no model
     fails the build.
  The guide doesn't list every Axe-Fx II amp type (for example no individual 1959SLP channel names), so some real
  unit names are missing. That is deliberate (DECISIONS.md 2).
- **Specs and facets.** The sections.json spec strings, kept only when found verbatim in the section's joined
  `pageText`. Facets per rule 4 (`core/models.js`). A spec with no `Yes`/`No` token gives `unknown`.
- **Brands.** `core/brands.js`, whole-word, case-sensitive tokens in the section title.
- **Card fields carry extraction junk**, so each is cut before verification: `Synopsis` at ` • `, ` Tips `,
  ` Clips `; `Tips` at ` More videos, clips and comments`, ` Clips `, ` Cabinet/speaker `; `Cabinet/speaker` and
  `Stock cabs` at ` Web, Manual` and ` More videos…`. The cut must then verify on a page of the model; if the
  whole cut fails, the first one or two sentences are tried, then the longest word prefix. Verification is the
  proof: a cut that runs into the next field isn't a substring of any page, so it can't pass.
  - Shrunk (3, Prince Tone, whose one section holds three amps with repeated card fields): synopsis, speaker and
    stock cabs keep their first verified part.
  - Dropped (3): two PVH stock-cab lines (`4x12 PVH` is 8 characters, under the 12-character minimum) and one
    Prince Tone tip that the extraction duplicated into a run-on.
- **Box breaks (round 2, API.md §4.2).** Every stored quote (synopsis, controls, tips, speaker, stock cabs, cab notes,
  notes) is split with `splitAtBoxBreaks` when it is picked, and an attribution at either end (" – Name") is cut, the
  name going to `said_by`. The build refuses a curated settings quote that spans a break: the JD Simo settings
  (p. 31) ran from "Volume:10" across a bullet into "Presence: to taste (around 5 or 6)", so the quote is now only
  "Bass:0, Mid:10, Treble:10, Volume:10". 21 quotes got shorter; the tests check that none left in the file spans a
  break or ends with an attribution. Round 3 adds clean cuts (`cleanCut`): a cut quote never ends on , ; : or a dangling and/or/with, so the Plexi models synopsis is "Models of various Marshall Plexi heads" and the Recto stock cabs end "… 13, 14, 21". The old
  opening-quote tip splitter (round 1) is gone; box breaks replace it.
- **Controls.** The raw `Amp controls …` line on the section's first page, plus continuation lines (a line ending
  in `,`/`-`/`and`/`with`, or a next line starting lower-case), verified.
- **Tips.** Each sentence of the cut `Tips` field (also split where an opening “ follows a word with no
  punctuation: the card loses the line break between two tips), verified. `said_by` only when the passage that
  holds the quote is closed by `” – Name` with Name from a fixed list (yek, Cliff, Legendary Tones, Marshall,
  MESA, Manual, Alan Phillips, …; `Yek` is stored as `yek`). Not "Cab Packs", "Rock", "Punk".
- **Cab notes.** Up to two body sentences (40–200 characters) about cabs or speakers, excluding the header table.
- **Notes.** Up to five `“…” – Name` passages per model, yek and Cliff first: the first sentence (≤ 220
  characters), or two when the first is under 60. Kept short for the quote budget.
- **Settings** (curated, rule 6). The scan for "label + number" found 28 candidate sentences; 20 are kept. Knobs
  are parsed by `core/labels.js`, never typed by hand, and the test re-parses them. Label mapping uses the model's
  `Label (=Knob)` hints first (Suhr Badger `Drive (=Master)`, many amps `Volume (=Drive)`), then the table.
  Non-knob parts are listed in `other` and blanked before parsing, so the T808's `Drive 0` in the Gary Moore
  settings (p. 64) isn't read as the amp's Drive.
- **Directions** (rule 7). From tips only: `turn up/down X`, `increase/raise/boost/crank X`,
  `decrease/lower/reduce X`, `turn X (all the way) up/down`, `keep X low/high`, with lists (`turn up Middle and
  Treble`). Negations (`don't turn up`) are skipped, but `Don't hesitate to turn…` counts. If one tip set pushes
  a knob both ways, both are dropped.
- **Conventions.** The six p. 12 rules, verbatim.

## Left out, and why

| Model | Guide text | Why |
|---|---|---|
| 59 Bassguy p. 22 | "Or try Bass and Treble at 0, and Mid and Presence at 10" | Two labels share one number; rule 6 would store Treble 0 and Presence 10 and show Bass and Mid as guesses that contradict the quote. |
| Friedman BE p. 156 | "…with the Bass on 10, the Mids at around 6…" | "on 10" and "Mids" are outside rule 6; Bass would contradict the quote. The Gain-around-8 sentence from the same page is kept. |
| Cali Leggy p. 85 | "Drive 6.50, Bass 7.00, Middle and Treble 3.50…" | Mid would contradict the quote; the two Steve Vai settings (pp. 84–85) are kept. |
| Div/13 FT37 p. 131, Vibra-King p. 282 | "Input Drive at 5 to 9", "between 3 and 6" | Ranges, not values. |
| USA Bass 400 p. 261 | "Input 1 and Volume 1" | Channel names, not settings. |
| Friedman HBE, individual 1959SLP / JCM 800 channel names | — | Not written in the guide as names. |
| Mr Z HWY 66 p. 191 | "Treble maxed" | Kept, but "Treble maxed" is an `other` fragment (a word, not a number), so the Treble dial is a guess. |

All of this is listed in `data/curation.json` (`settings_left_out`).
