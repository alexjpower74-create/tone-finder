// Checks every Answer must pass, shared by the golden, engine and AI tests.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { checkQuote } from '../verify.js'
import { NO_SUPPORT_MESSAGE } from '../answer.js'
import { unitNameOf } from '../models.js'
import { KNOBS } from '../labels.js'

const read = (p) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8'))
const models = read('../../data/models.json')
const golden = read('../../data/golden.json')

export function checkInvariants(a, { pages = null, data = models } = {}) {
  for (const s of a.suggestions) {
    assert.ok(!golden.never_ids.includes(s.model_id), `stub ${s.model_id} suggested for "${a.query}"`)
    assert.ok(s.why.length >= 1 && s.why.length <= 3, `${s.model_id}: ${s.why.length} why quotes`)
    if (pages) for (const w of s.why) assert.ok(checkQuote(w, pages).ok, `${s.model_id} why not verified p. ${w.page}: ${w.quote}`)
    assert.ok(unitNameOf(data, s.model_id, s.unit_name), `${s.unit_name} is not a unit name of ${s.model_id}`)
    assert.deepEqual(s.knobs.map((k) => k.knob), KNOBS)
  }
  assert.ok(a.suggestions.length <= 4)
  if (a.status === 'no_guide_support') {
    assert.equal(a.message, NO_SUPPORT_MESSAGE)
    assert.deepEqual(a.suggestions, [])
  }
}
