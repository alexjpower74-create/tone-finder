// Every data/golden.json query with AI off (guide search only), plus invariants on every Answer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadPages } from './guide-node.mjs'
import { answer } from '../answer.js'
import { isUnitName } from '../models.js'
import { spansBoxBreak } from '../text.js'
import { checkInvariants } from './invariants.mjs'

const read = (p) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8'))
const pages = loadPages()
const models = read('../../data/models.json')
const golden = read('../../data/golden.json')

for (const g of golden.queries) {
  test(`golden: ${g.query}`, () => {
    const a = answer(g.query, { models, pages })
    const ids = a.suggestions.map((s) => s.model_id)
    const why = (ss) => ss.flatMap((s) => s.why.map((w) => w.quote))
    const detail = `status=${a.status} ids=${ids.join(',')} terms=${a.understood.matched_terms.join('|')}`
    if (g.status) assert.equal(a.status, g.status, detail)
    if (g.any_of) assert.ok(ids.some((id) => g.any_of.includes(id)), `any_of ${detail}`)
    if (g.min_suggestions) assert.ok(a.suggestions.length >= g.min_suggestions, `min_suggestions ${detail}`)
    if (golden.no_why_spans_box_break) {
      for (const s of a.suggestions) for (const w of s.why) assert.ok(!spansBoxBreak(w.quote, pages.get(w.page)), `${s.model_id} p. ${w.page} spans a box break: ${w.quote}`)
    }
    if (g.top1_any_of) assert.ok(g.top1_any_of.includes(ids[0]), `top1_any_of ${detail}`)
    if (g.why_terms_any) {
      const pool = g.any_of || g.top1_any_of
      const matching = pool ? a.suggestions.filter((s) => pool.includes(s.model_id)) : a.suggestions
      const quotes = why(matching).map((q) => q.toLowerCase())
      assert.ok(quotes.some((q) => g.why_terms_any.some((t) => q.includes(t))), `why_terms_any ${detail}`)
    }
    if (g.every_why_matches) {
      const re = new RegExp(g.every_why_matches, 'i')
      const quotes = why(a.suggestions)
      assert.ok(quotes.length > 0, 'control: there are why quotes')
      for (const q of quotes) assert.match(q, re)
    }
    if (g.unmatched_includes) for (const w of g.unmatched_includes) assert.ok(a.understood.unmatched_terms.includes(w), `unmatched ${w}: ${a.understood.unmatched_terms}`)
    if (g.no_unit_name) {
      assert.ok(!isUnitName(models, g.no_unit_name))
      assert.ok(!a.suggestions.some((s) => s.unit_name.toLowerCase() === g.no_unit_name.toLowerCase()))
    }
    checkInvariants(a, { pages })
  })
}

test('golden never_ids hold on every golden answer and on stub names asked directly', () => {
  const extra = ['Brit Pre', 'Brit Super', 'Das Metall', 'Legato 100', 'USA IIC++', 'Slash signature amp']
  for (const q of [...golden.queries.map((g) => g.query), ...extra]) {
    const a = answer(q, { models, pages })
    for (const s of a.suggestions) assert.ok(!golden.never_ids.includes(s.model_id), `${q} → ${s.model_id}`)
  }
  // Control: a stub name does find its target.
  assert.ok(answer('Legato 100', { models, pages }).suggestions.some((s) => s.model_id === 'cali-leggy-and-legato-100'))
})
