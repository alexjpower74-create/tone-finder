# Tone Finder — decisions

Alexander was asleep, so the lead decided these. Each one says why. Newest at the bottom.

1. **Two slices, split by runtime.** tf1 owns the guide data, the answer engine, the AI step and the Worker; tf2
   owns the app. The data is what every honest answer rests on, so the slice that builds it also builds the code
   that quotes it. The lead owns the contract and an independent acceptance file (`data/golden.json`) written from
   reading the guide, so the engine isn't graded only by its author's tests.

2. **A "model" is one of the guide's 109 model sections.** The guide has 113 sections in `yek-guide-sections.json`
   (109 amp sections + 4 appendix pages). The unit's own amp type names (Plexi 100W HIGH, USA IIC+ Bright, FAS
   Modern II…) are listed per section as `unit_names`, and each needs verbatim evidence in the guide (section
   title, table of contents, appendix tables or the section body). That's the only way to guarantee "never names
   a model that isn't one of the Axe-Fx II's amp models" from this source: a name not written in the guide can't
   be shown. The guide doesn't list every Quantum/Ares amp type (for example, no individual names for the
   1959SLP's channels), so some real unit names are missing. Missing is honest; invented is not.

3. **The master table is the guide's own table of contents.** The brief asks for a test that the count and names
   match "the guide's master table". The condensed table in `yek-guide-reference.md` is Onyx's derivative and
   repeats some names (two "Suhr Badger" rows, stub rows). The test uses `yek-guide-sections.json` for the 109
   sections and the TOC (pp. 2–7) for names, and requires every TOC model entry to be accounted for.

4. **The guide stays out of git; the Worker gets its pages from a local load.** `npm run load-guide` posts the
   301 pages from `TF_GUIDE_DIR` into local D1, and the Worker checks their SHA-256 against `models.json`. The repo
   keeps derived data and short quotes only (≤ 2 sentences, ≤ 320 characters, total ≤ 15% of the guide's text,
   with a test). Search runs over the full page text at runtime, so the stored quotes can stay few.

5. **Quote verification is exact.** Whitespace is normalised, nothing else: no case, quote-mark or hyphen folding.
   Extraction artifacts in the text (for example "non- SimulClass") stay in quotes as they are. A looser match
   would let a paraphrase through.

6. **Attribution only where the guide gives it.** The guide's intro says tips from Cliff Chase and yek are in
   boxes, but the text extraction lost most box attributions. `said_by` is set only from an explicit dash line
   ("– yek", "– Cliff", "– Legendary Tones"). Everything else is cited as "yek's guide, p. N", never as "yek
   says".

7. **Ares: the change came with Quantum 9.00.** The brief says Ares removed Motor Drive and Transformer Grind. The
   release notes show Quantum 9.00 (October 2017) removed both and added Speaker Compression. The guide was
   written at Quantum 7.02, and the cumulative notes list Ares 1.00 after Quantum 10.01, so Alexander's unit has
   the change either way. The note says so and quotes both release-note pages (`data/sources/fractal-release-notes.json`).
   The guide never mentions either control (checked by search), so the flag only fires on AI text or a planted
   test tip. Onyx's gear memory says "Ares removed"; the lead's status file flags the correction.

8. **General knowledge comes only from the AI step, and only as a labelled side note.** Without AI, "the rhythm
   tone on Master of Puppets" gets "I can't point to the guide for that.", because the guide never names the song
   and "rhythm" / "master" are generic words. With AI, the model supplies general knowledge (Metallica, Mark IIC+)
   as search terms, and the guide itself then supports USA IIC+ / IIC++ ("Metallica’s IIC+", p. 270). The AI never
   writes a guide claim: its citations are dropped unless the quote is on the page it names, inside that model's
   section.

9. **AI is on in the local demo, capped.** OpenAI `gpt-5.4-mini`, two calls per new question (pick, then cite),
   answers cached per question. Prices US$0.75 / 0.075 cached / 4.50 per 1M tokens (checked by jr-lead on
   2026-09-14 at developers.openai.com); USD/CAD 1.3866 (Bank of Canada Valet API, latest observation 2026-09-11,
   fetched 2026-09-14). The Worker refuses a call whose worst case would cross CA$2. Slices only use a fake
   server; the lead makes the real calls and logs them in `docs/spend.md`.

10. **"Strong term" rule.** A model becomes a suggestion only when a non-generic query word or phrase supports it
    (rare in the guide, or found in the model's name, based-on, synopsis or tips). Generic words (clean, rhythm,
    lead, gain, the knob names) steer ranking and knob guesses but never create a suggestion alone. Without this,
    "Master of Puppets" would suggest "USA Rhythm" just because of the word "rhythm".

11. **Knob guesses are simple and loud about it.** Guide numbers win. Next comes the guide's own rule that a model
    of an amp without a master volume defaults Master to 10 (p. 12). Everything else is a labelled guess: Drive
    by intent (clean 2.5 … high gain 7), the rest 5. A tip's "turn up / turn down" nudges a guess by 2 and shows
    the quote. The guide's p. 12 note that model knobs match the real amp's tapers within 10% (except Master,
    Presence/Hi Cut and Depth) is shown whenever guide numbers are used, because many of those numbers are
    real-amp settings.

12. **Design.** Portfolio look (dark navy, glass, colour on data), stage-readable sizes. The print one-pager is white
    and low-ink, per Alexander's printing preference.

13. **Contract answers for tf2's first questions (16:15).** A fresh successful AI run reports `ai.reason: null`.
    The 44 px rule covers everything you can tap; static tags (page pills, brand tags on rows) may be smaller,
    ≥ 24 px tall, so the Models rows stay readable. `Answer.query` echoes the trimmed query as typed. Dweezil's
    B-man (p. 139) is a stub pointing at 65 Bassguy: the lead's golden file missed it, and a scan of the whole
    guide for "Please refer to the section on the …" confirms exactly six stubs (pp. 67, 70, 118, 139, 185, 272).

14. **Joined passages are split before quoting (16:25).** The guide's text extraction glues separate boxes without
    punctuation. tf2's first mock card quoted "Or just crank everything, like Eddie Van Halen “My settings for a
    “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5." (p. 28): an exact substring that reads as if Van Halen
    gave Cliff's settings. Exact-substring verification can't catch a true-but-misleading splice, so quote
    selection also splits before an opening “ that follows a word and before an attribution dash, and a test
    checks no stored or shown quote contains such a join (API.md §4.2).

15. **Box breaks replace the regex in #14 (16:40).** The regex from #14 was wrong: an opening “ after a word is
    ordinary prose (“Twin”, “Marshall stack”, “The King of Fender Amps”), and it flagged 113 of tf1's quotes, nearly
    all fine. The raw page text still has its line breaks, and a new box starts on a new line with “ or with an
    attribution dash. That rule, checked on the raw pages, catches all five real splices the lead found (pp. 28,
    33, 45, 125, 134) and none of seven quoted-term cases. Splitting there can only shorten a quote. Also adopted
    from tf1: eleven more stop words ("banjo through a toaster" matched "through") and `taper_note` as
    `{ quote, page }`.

16. **Answer quality rules from the lead's read of real answers (16:55).** The lead ran 23 realistic queries
    through tf1's engine at 80f4ccb (AI off) and read every card. Most were right (John Mayer → Band-Commander,
    Joe Bonamassa → Brit Silver with his settings from p. 68, Robben Ford → Bludojai). Fixes put in the contract:
    term frequency in the score (Metallica listed first four "users include" sections before "Metallica’s IIC+"),
    proper names starting with "the" ("The Edge chime" matched "edge of breakup"), word variants ("sparkly" missed
    "sparkle"), card labels and bullets as box breaks (a Gilmour quote ran into a "Clips … (Tyler Grund)" line), why
    quotes must carry a strong term and never be a controls line, no repeated quote across cards when another
    exists, and direction nudges that don't compound with intent guesses (clean Drive 2.5 was nudged to 0.5). Six
    golden queries added for these.

17. **Card header and quote display (17:05).** tf2's header ("Based on … · pp. N–M", "Fractal Audio custom model (no
    real amp)", "Guide section: …" only when needed) is now the contract. Quotes are shown as blockquotes with a teal
    left edge and no added marks, because many verified quotes carry the guide's own “ ” and the added marks doubled
    them (“…adjustments.””). tf2's "inline quote ≤ 3 words" join heuristic is replaced by the box-break rule (#15),
    which uses the raw line breaks and keeps longer quoted titles such as “The King of Fender Amps” whole.

18. **Ranking fixes after round 2 (17:15).** At 61f197a Metallica and sparkly clean were fixed, but reading the
    answers again showed: "brown sound" never tried as a phrase (the lead's own rule banned n-grams ending in a stop
    word, and "sound" was one), term frequency inflating common words ("blues" in Blues Junior outranked "SRV" in
    Super Verb), no reward for matching more of the query (Car Roamer "chime" beat Class-A 30W "The Edge" + "chime"),
    and cut quotes ending on "," or "and". Contract: filler words may end a phrase, term frequency only for body-text
    hits, a coverage factor, clean cuts. Golden: brown sound must match as a phrase and never suggest the '60 brown
    Fenders; SRV Texas blues → Super Verb first; edge of breakup blues → Ruby Rocket first.

19. **QA belongs to the lead; answers to tf1's round-2 questions (17:25).** tf1 and the lead ran `rig qa` in the
    same QA worktree on the same ports at the same time (16:37). That explains both unexplained flakes: tf1's 57/69
    run (the fake AI port was taken) and the lead's Worker "cache:storage" start failure (state wiped under it). Both
    reran green. From now on only the lead uses `.worktrees/qa` and ports 8306–8309. tf1's questions: R2-1 ("The Edge
    chime") is solved by the coverage factor in #18 (Car Roamer matches one of two terms); R2-2 a "the" n-gram of
    generic words is generic; R2-3 drop detail is `"<unit name>, p. <n>"`; R2-4 a why sentence that names the model
    is preferred.

20. **Round 3 graded; last polish (lead).** QA 01dce76: core 73/73, worker 16/16; all 23 golden queries green.
    Reading answers again: Van Halen brown sound → Brit Brown only; SRV → Super Verb; The Edge chime → Class-A 30W;
    Metallica → USA IIC++ with "Metallica’s IIC+"; Dimebag → no support. Adopted tf1's R3-1 (generic + filler
    phrases stay generic) and R3-2 (the running page header is a box break), plus: the printed page number at the
    foot of a page is a box break ("…Crunch.” – MESA 262"), a quote never starts with a bullet, and stock-cab list
    lines are never why quotes ("4x12 … Petrucci – Cab Packs…" was shown for "Petrucci lead").

21. **Real AI smoke test (lead, 19:17 UTC).** At main d24e11e with the real key: "the rhythm tone on Master of
    Puppets" returned USA IIC++ as an AI pick quoting p. 270 "Metallica’s IIC+", with labelled general knowledge
    ("commonly associated with a Mesa/Boogie Mark IIC+ style amp"): the brief's hardest example works. 4 calls,
    CA$0.0353 (≈ CA$0.017 per new question); the key appeared in no log or answer. Two fixes: general-knowledge
    items that talk about the guide or the candidates are dropped, and matched/AI terms are de-duplicated.

22. **Final real AI run and the fixes it showed (lead).** 16 calls at main a911158 through the demo Worker, CA$0.1156
    (running total CA$0.1509 of CA$2); a repeated question was served from the cache at no cost; no key material in
    any log or answer. Master of Puppets → USA IIC++ with Cliff's settings; SRV → Super Verb; djent → Thordendal;
    "Brown Sound Deluxe" never shown as a model. Fixes: (1) the real model's citations often differ from the page
    only in quote marks, dashes, capitals or spacing, so the Worker now locates the citation on the cited page with
    those folded and shows the page's own exact text (a changed letter, invented text or wrong page still fails);
    AI citations expand to their containing sentence; (2) at least 2 suggestions when 2 candidates exist ("Van Halen
    brown sound" had become Brit Brown alone); (3) the running header is never a why quote.

23. **The lead's demo sat on the slices' dev ports (lead error, 17:05).** The detached demo was started on 8301/8302
    while tf1 and tf2 were still testing on those ports. tf1's Worker tests bound nothing, waited on the demo's
    health check, and ran their HTTP tests against the real Worker: 6 real AI calls (CA$0.0468, logged in
    docs/spend.md) and some cached test questions in the demo database. tf2's app suite never started, and its
    commit gate passed on the absence of a "failed" line. Both slices found it themselves: tf1's runner now refuses
    busy ports, and tf2 reran on 8311 with a gate that requires "passed". Lesson for the finish: start the final demo
    only after every slice has stopped.

24. **The AI may not turn nonsense into suggestions (lead fix, after both slices stopped).** The final screenshots
    showed "banjo through a toaster" with AI on (the default) as "4 starting points" (Class-A 30W TB and friends):
    real quotes, invented premise, and the page even said "Not in the guide: banjo, toaster". The brief says an
    unsupported query gets "I can't point to the guide for that." The difference from Master of Puppets, which must
    keep working: there the AI says what the query is about (general knowledge); for banjo it said nothing. Rule
    (API.md §5.2b): no guide support + no general knowledge → no-support answer, no cite call; the pick prompt also
    says to return nothing for non-music requests; PROMPT_VERSION tf-ai-4. Both slices had already closed, so the
    lead made this small change in core/ai.js with a fake scenario, a test and a negative control, and reran QA.

25. **Knob citations must show a sentence that states the value (Onyx review, lead fix).** On 1959SLP and PLEXI 100W
    the Master dial read "10 · p. 12", but the card never displayed the p. 12 rule sentence ("…the Master control in
    the amp model will default at 10."); the only p. 12 quote under the dials was the taper note, which names Master
    but states no Master value. The same was true of guide settings (the "Bass 2, Mid 8, Treble 7.5" sentence wasn't
    on the card). Fix: a knob keeps its page only if its quote states that value (else it's a starting guess); the
    card, Binder and print display every supporting sentence with the dial's page; the taper note is labelled as not a
    knob setting; tf2's shape checker enforces the rule on fixtures and the live Worker. Negative controls: the taper
    sentence planted on Master 10 (engine → guess; shape check → rejected), and the sources list removed from the card.
