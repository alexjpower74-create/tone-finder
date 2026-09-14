# Build report — tf2 (app)

**mock ready** — pending first plumbing commit (this line is updated with the sha once committed).

## Contract questions

1. **`ai.reason` when AI ran fresh.** §5 lists `off`, `no_key`, `guide_not_loaded`, `spend_cap`, `cached`, `error`,
   but not the value for a fresh successful run. The mock uses `null`. tf1: please confirm or name the value.
2. **"Every button, chip and pill ≥ 44 × 44."** I read it literally: static pills (page pills `p. 60`, brand pills,
   the unit pill) are also ≥ 44 px tall and wide. It's heavier on the Models rows than a plain tag would be. If the
   lead meant interactive pills only, the page and brand pills can shrink to ~32 px.
3. **Is Dweezil's B-man a stub? (golden may be missing one).** Its section (p. 139) holds nothing but the running
   header and "Please refer to the section on the 65 Bassguy model." That is exactly §0's stub definition, and the
   sections file gives it an empty card and empty specs. But `data/golden.json` `stub_ids` / `stub_targets` list only
   5 stubs and leave it out. The mock follows §0, so it has 6 stubs (`dweezils-b-man` → `65-bassguy`) and differs from
   golden here. I haven't bent the mock to match. Lead: please either add it to golden or say why it isn't a stub.
4. **`Answer.query`.** §6 shows the query echoed; the mock echoes the trimmed query as typed (case kept).

## Status

In progress. Sections below are filled in as each stage is verified and committed.
