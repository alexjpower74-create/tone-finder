// ?mock=1 backend (docs/API.md §9). Answers the same routes with the same JSON shapes as the Worker (§6),
// from fixtures in app/mock/ that are built by app/tools/build-mock.mjs from real guide data.
let fixtures = null;

function load() {
  fixtures ??= Promise.all(
    ['models.json', 'answers.json'].map((f) =>
      fetch(new URL(`./mock/${f}`, import.meta.url)).then((r) => {
        if (!r.ok) throw new Error(`mock fixture ${f}: HTTP ${r.status}`);
        return r.json();
      }),
    ),
  ).then(([data, answers]) => ({ data, answers }));
  return fixtures;
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const normText = (s) => String(s).replace(/[\s ]+/g, ' ').trim();
const ok = (json) => ({ status: 200, json });
const fail = (status, error, message) => ({ status, json: { error, message } });

export function summary(m) {
  return {
    id: m.id,
    name: m.name,
    section: m.section,
    based_on: m.based_on,
    brands: m.brands,
    unit_names: m.unit_names.map((u) => u.name),
    pages: m.pages,
    facets: m.facets,
    refers_to: m.refers_to,
    synopsis: m.synopsis,
  };
}

function countBy(models, valuesOf, order) {
  const counts = new Map();
  for (const m of models) for (const v of valuesOf(m)) counts.set(v, (counts.get(v) ?? 0) + 1);
  const rows = [...counts].map(([value, count]) => ({ value, count }));
  if (order) return rows.sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));
  return rows.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function listModels(models, search) {
  const brand = search.get('brand');
  const tube = search.get('tube');
  const mv = search.get('mv');
  const q = normText(search.get('q') ?? '').toLowerCase();
  const rows = models.filter(
    (m) =>
      (!brand || m.brands.includes(brand)) &&
      (!tube || m.facets.power_tubes.includes(tube)) &&
      (!mv || m.facets.master_volume === mv) &&
      (!q ||
        [m.name, m.based_on ?? '', ...m.unit_names.map((u) => u.name)].some((s) => s.toLowerCase().includes(q))),
  );
  return {
    count: rows.length,
    total: models.length,
    models: rows.map(summary),
    facets: {
      brands: countBy(models, (m) => m.brands),
      power_tubes: countBy(models, (m) => m.facets.power_tubes, ['EL34', 'EL84', '6L6', '6V6', 'KT88', 'KT66', '6550', '6973']),
      master_volume: countBy(models, (m) => [m.facets.master_volume], ['yes', 'no', 'mixed', 'unknown']),
    },
  };
}

// Anything without a canned answer gets the engine's no-support answer (§4.1).
function noSupport(answers, query) {
  const a = clone(answers.no_support_template);
  const stop = new Set(answers.stop_words);
  const generic = new Set(answers.generic_words);
  const words = query.toLowerCase().split(/[^a-z0-9+#/'’-]+/).filter(Boolean);
  a.query = query;
  a.understood.unmatched_terms = [...new Set(words.filter((w) => !stop.has(w) && !generic.has(w)))];
  return a;
}

export async function handle(method, rawPath, body) {
  const { data, answers } = await load();
  const url = new URL(rawPath, 'http://mock');
  const path = url.pathname;

  if (method === 'GET' && path === '/api/health') return ok(clone(answers.health));
  if (method === 'GET' && path === '/api/models') return ok(listModels(data.models, url.searchParams));
  if (method === 'GET' && path.startsWith('/api/models/')) {
    const id = decodeURIComponent(path.slice('/api/models/'.length));
    const model = data.models.find((m) => m.id === id);
    if (!model) return fail(404, 'not_found', 'No model with that id.');
    return ok({ model: clone(model), conventions: clone(data.conventions), guide: clone(data.guide) });
  }
  if (method === 'POST' && path === '/api/ask') {
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    if (query.length < 1 || query.length > 200) return fail(400, 'bad_query', 'Type between 1 and 200 characters.');
    const useAi = body.ai !== false;
    const entry = answers.answers[normText(query).toLowerCase()];
    // Either variant may be missing or null in a fixture: use the other one, and with AI off never report AI as used
    // or show general knowledge.
    const picked = (useAi ? entry?.on ?? entry?.off : entry?.off ?? entry?.on) ?? null;
    if (!picked) return ok(noSupport(answers, query));
    const a = clone(picked);
    if (!useAi && !entry.off) {
      a.ai = { used: false, reason: 'off', dropped: [], cost_cad: 0 };
      a.general_knowledge = [];
    }
    a.query = query;
    return ok(a);
  }
  return fail(404, 'not_found', `No route ${method} ${path}`);
}
