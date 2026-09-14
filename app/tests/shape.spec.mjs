// The mock's JSON against the §6 shapes: every fixture answer and model, then the mock's actual HTTP-style
// responses. live.spec.mjs runs the same checks against a real Worker.
import { expect, test } from '@playwright/test';
import { ONCE, readFixture } from './fixtures.mjs';
import { checkAnswer, checkError, checkHealth, checkModel, checkModelDetail, checkModelsList } from './shape.mjs';

test.beforeEach(({}, ti) => test.skip(ti.project.name !== ONCE, 'shape checks run once'));

test('every fixture model has the §3.1 Model shape', () => {
  const data = readFixture('models.json');
  expect(data.models).toHaveLength(109);
  const errors = data.models.flatMap((m, i) => checkModel(m, `models[${i}] ${m.id}`));
  expect(errors).toEqual([]);
  expect(checkModelDetail({ model: data.models[0], conventions: data.conventions, guide: data.guide })).toEqual([]);
});

test('every fixture answer (AI on and off, and the no-support template) has the §6 Answer shape', () => {
  const fx = readFixture('answers.json');
  expect(checkHealth(fx.health)).toEqual([]);
  const entries = Object.entries(fx.answers);
  expect(entries.length).toBeGreaterThanOrEqual(7);
  const errors = [];
  for (const [q, e] of entries) {
    for (const [mode, a] of [['on', e.on], ['off', e.off]]) {
      if (a) errors.push(...checkAnswer(a).map((x) => `"${q}" (${mode}): ${x}`));
    }
  }
  errors.push(...checkAnswer({ ...fx.no_support_template, query: 'x' }).map((x) => `no_support_template: ${x}`));
  expect(errors).toEqual([]);
});

test('the mock backend responses have the §6 shapes', async ({ page }) => {
  await page.goto('/index.html?mock=1');
  const call = (method, path, body) =>
    page.evaluate(async ([m, p, b]) => (await import('/api.mock.js')).handle(m, p, b), [method, path, body]);

  const health = await call('GET', '/api/health');
  expect(health.status).toBe(200);
  expect(checkHealth(health.json)).toEqual([]);

  for (const path of ['/api/models', '/api/models?brand=Marshall', '/api/models?mv=no&tube=EL34', '/api/models?q=iic']) {
    const r = await call('GET', path);
    expect(r.status, path).toBe(200);
    expect(checkModelsList(r.json), path).toEqual([]);
  }

  for (const id of ['1959slp', 'brit-super', 'usa-iic-plus-and-usa-iic-plus-plus']) {
    const r = await call('GET', `/api/models/${id}`);
    expect(r.status, id).toBe(200);
    expect(checkModelDetail(r.json), id).toEqual([]);
  }
  const missing = await call('GET', '/api/models/no-such-amp');
  expect(missing.status).toBe(404);
  expect(checkError(missing.json)).toEqual([]);

  const queries = ['Van Halen brown sound', 'the rhythm tone on Master of Puppets', 'AC30 chime', 'JTM 45', 'banjo through a toaster'];
  for (const query of queries) {
    for (const ai of [true, false]) {
      const r = await call('POST', '/api/ask', { query, ai });
      expect(r.status, query).toBe(200);
      expect(checkAnswer(r.json), `${query} ai=${ai}`).toEqual([]);
    }
  }
  const bad = await call('POST', '/api/ask', { query: '   ' });
  expect(bad.status).toBe(400);
  expect(checkError(bad.json)).toEqual([]);
});
