#!/usr/bin/env node
// Builds the ?mock=1 fixtures (docs/API.md §9): app/mock/models.json and app/mock/answers.json.
//
// models.json is a checked copy of tf1's data/models.json. Canned answers come from the real engine (core/answer.js,
// AI off) on the local guide. Only what the engine can't produce offline is hand-made, on top of engine output: the
// AI-on answer (general knowledge, drops, an AI pick) and the planted SAMPLE Ares flag. Every stored and shown quote
// is checked with core's own functions (checkQuote, box breaks with section titles, clean cuts), so the mock and the
// Worker can't drift. Any miss stops the build and lists every failing quote.
//
// Usage: node app/tools/build-mock.mjs [--models path/to/models.json]   (default: data/models.json)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { answer, buildSuggestion, GK_LABEL, guideAnswer } from '../../core/answer.js';
import { ARES_ADVICE } from '../../core/ares.js';
import { pagesSha256 } from '../../core/guide.js';
import { sectionTitles } from '../../core/models.js';
import { GENERIC_WORDS, STOP_WORDS } from '../../core/search.js';
import { cleanCut, normText, spansBoxBreak } from '../../core/text.js';
import { checkQuote } from '../../core/verify.js';
import { loadPages } from '../../core/tests/guide-node.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(APP, '..');

function die(msg) {
  console.error(`build-mock: ${msg}`);
  process.exit(1);
}

const argModels = process.argv.indexOf('--models');
const modelsPath = argModels >= 0 ? process.argv[argModels + 1] : join(REPO, 'data/models.json');
const data = JSON.parse(readFileSync(modelsPath, 'utf8'));

let pages;
try {
  pages = loadPages();
} catch (e) {
  die(e.message);
}
const sha = await pagesSha256(pages);
if (sha !== data.guide.pages_sha256) die(`the local guide (sha ${sha}) is not the guide models.json was built from (${data.guide.pages_sha256})`);
const titles = sectionTitles(data);

// ---------- quote checks (§0, §4.2) ----------
const SAMPLE = 'SAMPLE (test only):';
const ATTRIBUTION_TAIL = /\s[–-]\s(?:yek|Yek|Cliff|Legendary Tones|Marshall|MESA|Manual)\.?$/;

function quoteProblem(quote, page) {
  const v = checkQuote({ quote, page }, pages);
  if (!v.ok) return `not verified (${v.reason})`;
  if (spansBoxBreak(quote, pages.get(page), titles)) return 'spans a box break';
  if (cleanCut(quote) !== quote) return 'not a clean cut';
  if (ATTRIBUTION_TAIL.test(quote)) return 'ends with an attribution';
  return null;
}

// Every {quote, page} in a value, except the planted SAMPLE flag (not a guide quote by design).
function checkAll(label, value) {
  const failures = [];
  const walk = (x, path) => {
    if (Array.isArray(x)) return x.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (!x || typeof x !== 'object') return;
    if (typeof x.quote === 'string' && Number.isInteger(x.page) && !x.quote.startsWith(SAMPLE)) {
      const problem = quoteProblem(x.quote, x.page);
      if (problem) failures.push(`${path} p. ${x.page}: ${problem}: ${x.quote.slice(0, 100)}`);
    }
    for (const [k, v] of Object.entries(x)) walk(v, `${path}.${k}`);
  };
  walk(value, label);
  if (failures.length) die(`${failures.length} quote(s) in ${label} can't be shown:\n  ${failures.join('\n  ')}`);
}

checkAll('models.json', data);

// ---------- canned answers ----------
const clone = (x) => JSON.parse(JSON.stringify(x));
const engine = (query) => answer(query, { models: data, pages });
const answers = {};
const put = (query, on, off) => (answers[normText(query).toLowerCase()] = { on, off });

// From the engine as they are (AI off): the example chips the guide answers, plus two queries that exercise card
// roles (JTM 45: guide knobs + a direction nudge; Plexi crunch: a unit name that isn't in the section title).
for (const q of ['Van Halen brown sound', 'clean worship pad with sparkle', 'Robben Ford', 'djent', 'JTM 45', 'Plexi crunch']) {
  const a = engine(q);
  put(q, a, clone(a));
}

// AC30 chime: the engine's answer plus one planted Ares flag. It is a "why" flag, so it carries the page of the why
// quote it sits on; its text starts "SAMPLE (test only):" and the app labels it as a test sample.
{
  const a = engine('AC30 chime');
  const card = a.suggestions[0] ?? die('AC30 chime: the engine returned no suggestions');
  card.ares_flags.push({
    param: 'Transformer Grind', where: 'why', quote: `${SAMPLE} add Transformer Grind to taste`, page: card.why[0].page, advice: ARES_ADVICE,
  });
  put('AC30 chime', a, clone(a));
}

// The rhythm tone on Master of Puppets. AI off: the engine (the guide alone can't support it). AI on: built on the
// engine as the AI step would: its search terms go into guideAnswer, the AI pick keeps the checked p. 270 citation,
// plus general knowledge and two drops in the §5.5 detail format.
{
  const q = 'the rhythm tone on Master of Puppets';
  const off = engine(q);
  const aiTerms = ['metallica', 'mark iic+'];
  const on = guideAnswer(q, { models: data, pages, extraTerms: aiTerms }).answer;
  const pickModel = data.models.find((m) => m.id === 'usa-iic-plus-and-usa-iic-plus-plus') ?? die('no USA IIC+ model');
  const citation =
    engine('Metallica').suggestions.find((s) => s.model_id === pickModel.id)?.why.find((w) => w.quote.includes('Metallica’s IIC+')) ??
    die('the engine no longer cites “Metallica’s IIC+” for Metallica');
  const pick = buildSuggestion(pickModel, {
    data, pages, query: `${q} ${aiTerms.join(' ')}`, terms: [{ term: 'metallica', strong: true }], intent: on.understood.intent,
    rank: 1, source: 'ai_checked', score: 9.6, why: [citation],
  });
  on.status = 'ok';
  on.message = null;
  on.suggestions = [pick, ...on.suggestions.filter((s) => s.model_id !== pickModel.id)].slice(0, 4).map((s, i) => ({ ...s, rank: i + 1 }));
  on.ai = {
    used: true, reason: null, cost_cad: 0.0031,
    dropped: [
      { kind: 'unknown_model', detail: 'Brown Sound Deluxe' },
      { kind: 'bad_page', detail: `${pick.unit_name}, p. 12` },
    ],
  };
  on.general_knowledge = [
    { text: 'Master of Puppets is a 1986 Metallica album and song. Its rhythm guitar tone is widely credited to a MESA/Boogie Mark IIC+.', label: GK_LABEL },
  ];
  put(q, on, off);
}

const noSupportTemplate = engine('banjo through a toaster');
if (noSupportTemplate.status !== 'no_guide_support') die('"banjo through a toaster" is no longer a no-support answer');
noSupportTemplate.query = '';
noSupportTemplate.understood.unmatched_terms = [];

// ---------- fixture roles (§9) and checks ----------
const all = Object.entries(answers).flatMap(([q, e]) => [[q, 'on', e.on], [q, 'off', e.off]]);
const need = (ok, what) => ok || die(`fixture is missing: ${what}`);
need(all.every(([, , a]) => a && typeof a === 'object'), 'an "on" and an "off" Answer for every query');
const cards = all.flatMap(([, , a]) => a.suggestions);
need(cards.some((s) => s.knobs.every((k) => k.kind === 'guess')), 'a card with all seven knobs guessed');
need(cards.some((s) => s.knobs.some((k) => k.kind === 'guide') && s.knobs.some((k) => k.direction)), 'a card with guide knobs + a direction nudge');
need(cards.some((s) => s.ares_flags.some((f) => f.quote.startsWith(SAMPLE) && Number.isInteger(f.page))), 'a planted SAMPLE Ares flag with a page');
need(all.some(([, , a]) => a.general_knowledge.length && a.ai.dropped.some((d) => d.detail === 'Brown Sound Deluxe')), 'general knowledge + drops');
for (const s of cards) for (const f of s.ares_flags) need(f.where === 'ai' ? f.page === null : Number.isInteger(f.page), `${s.model_id}: ares flag page for where "${f.where}"`);
checkAll('answers.json', answers);

const OUT = join(APP, 'mock');
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'models.json'), JSON.stringify(data, null, 1) + '\n');
writeFileSync(
  join(OUT, 'answers.json'),
  JSON.stringify(
    {
      _about: 'Canned answers for ?mock=1, built by app/tools/build-mock.mjs from core/answer.js (AI off) on data/models.json. Hand-made on top of engine output: the AI-on answer for "the rhythm tone on Master of Puppets" and the planted SAMPLE (test only) Ares flag. Scores are the engine\'s, except the AI pick.',
      source: 'data/models.json + core/answer.js',
      health: { ok: true, models: data.models.length, guide: { loaded: true, pages: 301, sha_ok: true }, ai: { configured: true, model: 'gpt-5.4-mini', cap_cad: 2, spent_cad: 0.0412, calls: 6 } },
      stop_words: [...STOP_WORDS],
      generic_words: [...GENERIC_WORDS],
      no_support_template: noSupportTemplate,
      answers,
    },
    null,
    1,
  ) + '\n',
);

for (const [q, mode, a] of all) {
  if (mode === 'off' && JSON.stringify(a) === JSON.stringify(answers[q].on)) continue;
  console.log(`[${q}] ${mode}: ${a.status}${a.ai.used ? ' (AI)' : ''}`);
  for (const s of a.suggestions) {
    const knobs = s.knobs.map((k) => `${k.knob[0]}${k.value}${k.kind === 'guess' ? '?' : k.kind === 'guide_rule' ? 'R' : ''}${k.direction ? `(${k.direction.dir})` : ''}`).join(' ');
    console.log(`  #${s.rank} ${s.model_id} "${s.unit_name}" ${s.source} why ${s.why.map((w) => `p.${w.page}`).join(',')} | ${knobs} | flags ${s.ares_flags.map((f) => `${f.where}@${f.page}`).join(',') || '-'}`);
  }
}
console.log(`models: ${data.models.length} (${data.models.filter((m) => m.refers_to).length} stubs), guide sha ok; answers: ${Object.keys(answers).length} queries, ${cards.length} cards`);
