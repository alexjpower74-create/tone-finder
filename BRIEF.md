# Tone Finder — brief (Onyx, 2026-09-14)

**Prefix** `tf` · **Ports** app 8301, worker 8302, QA 8309 · **Repo** `tone-finder` (private) · **Lead effort** xhigh

## What
Alexander plays a **Fractal Audio Axe-Fx II XL+ on Ares firmware** (not an Axe-Fx III / FM3 / FM9). He types a
tone ("Van Halen brown sound", "clean worship pad with sparkle", "the rhythm tone on Master of Puppets") and gets
starting points: amp model, cab suggestion, and starting knob values, where **every suggestion cites yek's guide
page** and quotes the line it's based on. It never names a model that isn't one of the Axe-Fx II's amp models.

## Source material (his, local, private)
- `~/Claude/Reference/Yek Fractal Amp Guide/yek-guide-reference.md` (condensed per-model cards with PDF page
  numbers), `yek-guide-fulltext.txt` (all 301 pages with `===== PAGE n =====` markers), `yek-guide-sections.json`.
- The guide is someone else's copyrighted work: keep it OUT of the repo. The app reads it from a local path set in
  `.dev.vars`/config; the repo stores only derived structured data (model name, real amp modeled, page numbers,
  short quotes ≤ 2 sentences) in `data/models.json`, plus a README note.
- Ares vs Quantum 7.02 (the guide's firmware): on Ares the Amp block lost Motor Drive and Transformer Grind and
  gained Speaker Compression. Any suggestion touching those parameters is adjusted and says why.

## How it answers
1. Build `data/models.json`: all ~109 models — name as it appears on the unit, real amp modeled, watts, master
   volume yes/no, power tubes, tonestack, page numbers, yek's tips as short quotes with page refs. Validate: the
   count and names match the guide's master table (a test).
2. Query → candidates: keyword/genre/artist matching against the real amps modeled and yek's own words (e.g. the
   guide's descriptions), plus an **optional** LLM step (gpt-5.4-mini, spend cap CA$2) that may only choose from
   the model list and must return page numbers + quotes; every quote verified as an exact substring of the guide
   text on that page, every model name verified against `models.json`. Anything unverified is dropped (negative
   controls: a planted invented model "Brown Sound Deluxe" and a wrong page number must both be rejected).
3. Answer card per suggestion: model, why (quotes + pages), cab suggestion (from the guide's cab notes, cited),
   starting knobs (Drive, Bass, Mid, Treble, Master, Presence, Depth) — taken from yek's tips where he gives them;
   otherwise marked **"starting guess — not from the guide"** in a different style. Song/artist knowledge the guide
   doesn't cover is labelled as general knowledge, never attributed to yek.

## Screens
Ask box with examples, results (2–4 suggestions), model browser (all models, filter by real amp brand / power
tube / master volume), model detail (all cited notes). Dark, stage-readable, 390 + 1280. A "print for the
rehearsal binder" one-pager.

## Tests that matter
Model list integrity; quote verification (negative controls above); a query the guide can't support returns "I
can't point to the guide for that" rather than a guess; journeys chromium + webkit.
