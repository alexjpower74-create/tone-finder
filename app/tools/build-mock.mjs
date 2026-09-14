#!/usr/bin/env node
// Builds the ?mock=1 fixtures (docs/API.md §9): app/mock/models.json and app/mock/answers.json.
//
// Models come from tf1's real data (--models <path to data/models.json>), or, without it, are derived from the
// local guide in TF_GUIDE_DIR (derived fields and short verified quotes only; the guide is never copied).
// Canned answers are built from those models with a small copy of the §4.3 knob rules. Every quote written by
// this script is verified on its page (§0), never spans a box break and never ends with an attribution (§4.2);
// any miss stops the build and lists every failing quote.
//
// Usage: node app/tools/build-mock.mjs [--models path/to/models.json [--drop-spanning]]
//   --drop-spanning  remove stored quotes from the --models input that span a box break or end with an
//                    attribution (listed on stdout), instead of stopping. For use until tf1's data applies §4.2.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  boxRuns, cleanCut, cutAttribution, makeVerifier, normText, parsePages, spansBoxBreak, splitAtBoxBreaks, splitSentences,
} from './guide-text.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(APP, '..');
const GUIDE_DIR = process.env.TF_GUIDE_DIR || '/home/alexander/Claude/Reference/Yek Fractal Amp Guide';

function die(msg) {
  console.error(`build-mock: ${msg}`);
  process.exit(1);
}

// ---------- guide pages and quote checks (§0, §2, §4.2) ----------
let fulltext;
try {
  fulltext = readFileSync(join(GUIDE_DIR, 'yek-guide-fulltext.txt'), 'utf8');
} catch {
  die(`guide not found at ${GUIDE_DIR}`);
}
const RAW = parsePages(fulltext);
if (RAW.size !== 301) die(`expected 301 pages, got ${RAW.size}`);
const V = makeVerifier(RAW);
const pageText = (n) => V.pageText(n) ?? die(`no page ${n}`);
const isVerified = (quote, page) => V.isVerified(quote, page);

// null when the quote may be stored and shown, else the reason.
function quoteProblem(quote, page) {
  if (!isVerified(quote, page)) return 'not verified on its page';
  if (spansBoxBreak(quote, V.raw(page))) return 'spans a box break';
  if (cutAttribution(quote).quote !== quote) return 'ends with an attribution';
  if (cleanCut(quote) !== quote) return 'not a clean cut';
  return null;
}

function Q(quote, page, extra = {}) {
  const problem = quoteProblem(quote, page);
  if (problem) die(`quote ${problem} (p. ${page}): ${JSON.stringify(String(quote).slice(0, 100))}`);
  return { quote, page, ...extra };
}

const SAID_BY = /^\s*[–-]\s*(yek|Yek|Cliff|Legendary Tones|Marshall|MESA|Manual)\b/;
function saidByAfter(quote, page) {
  const t = pageText(page);
  const at = t.indexOf(quote);
  const m = at >= 0 ? t.slice(at + quote.length).match(SAID_BY) : null;
  return m ? (m[1] === 'Yek' ? 'yek' : m[1]) : null;
}

// A box that starts with a card label is a card field (controls line, clip titles, links), never a why quote.
const CARD_LABEL_START = /^(?:Synopsis|Tips|Clips|Sound Clips|Cabinet\/speaker|Stock cabs|Web, Manual|Amp controls|More videos, clips and comments)\b/;

// A picked passage → the pieces it may be quoted as: cut at box breaks (only ever shorter), attribution tail cut
// into said_by, trailing printed page number dropped, and only pieces that start a sentence or box, aren't a card
// field, and verify.
function quotablePieces(passage, page) {
  const out = [];
  for (const piece of splitAtBoxBreaks(passage, V.raw(page))) {
    const cut = cutAttribution(cleanCut(piece.replace(/\s+\d{1,3}$/, '')));
    const quote = cleanCut(cut.quote);
    if (/^[A-Z0-9“"‘(]/.test(quote) && !CARD_LABEL_START.test(quote) && !quoteProblem(quote, page)) {
      out.push({ quote, page, said_by: cut.said_by ?? saidByAfter(quote, page) });
    }
  }
  return out;
}

// ---------- models (only used without --models) ----------
const APPENDIX = new Set(['VOX-type Amps', 'D-type Amps', 'Preamps', 'Fractal Forum Content']);
const DUP_NAMES = { 238: 'Suhr Badger 18', 239: 'Suhr Badger 30' }; // TOC sub-entries that tell the two apart

const BRANDS = [
  ['Fender', 'Fender'], ['Marshall', 'Marshall'], ['MESA/Boogie', 'MESA'], ['VOX', 'VOX'], ['Bogner', 'Bogner'],
  ['Diezel', 'Diezel'], ['Engl', 'Engl'], ['Friedman', 'Friedman'], ['Soldano', 'Soldano'], ['Orange', 'Orange'],
  ['Dumble', 'Dumble'], ['Trainwreck', 'Trainwreck'], ['Matchless', 'Matchless'], ['Dr. Z', 'Dr. Z'],
  ['Carol-Ann', 'Carol-Ann'], ['Cameron', 'Cameron'], ['Splawn', 'Splawn'], ['Suhr', 'Suhr'], ['Two-Rock', 'Two-Rock'],
  ['Fuchs', 'Fuchs'], ['Budda', 'Budda'], ['Bad Cat', 'Bad Cat'], ['Hiwatt', 'Hiwatt'], ['Peavey', 'Peavey'],
  ['EVH', 'EVH'], ['Roland', 'Roland'], ['Ampeg', 'Ampeg'], ['Supro', 'Supro'], ['Gibson', 'Gibson'],
  ['Carvin', 'Carvin'], ['Divided By 13', 'Divided By 13'], ['Swart', 'Swart'], ['Komet', 'Komet'],
  ['Cornford', 'Cornford'], ['Morgan', 'Morgan'], ['Carr', 'Carr'], ['Blankenship', 'Blankenship'],
  ['Bludotone', 'Bludotone'], ['HOOK', 'HOOK'], ['Custom Audio', 'Custom Audio'], ['Fryette', 'Fryette'],
  ['Paul Ruby', 'Paul Ruby'], ['Fractal Audio', 'FAS'],
];
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWord = (token, flags = '') => new RegExp(`(?<![A-Za-z0-9])${escRe(token)}(?![A-Za-z0-9])`, flags);

const TUBES = ['EL34', 'EL84', '6L6', '6V6', 'KT88', 'KT66', '6550', '6973'];
const TUBE_ALIAS = { '6L6GC': '6L6', 5881: '6L6', '6AQ5': 'EL84' };
const SPEC_KEYS = [
  ['years', 'Years of Manufacture'], ['circuit', 'Circuit'], ['power', 'Power'], ['master_volume', 'Master Volume'],
  ['negative_feedback', 'Negative Feedback'], ['preamp_tubes', 'Preamp Tubes'], ['power_tubes', 'Power Amp Tubes'],
  ['tonestack', 'Tonestack Location'],
];

export function slug(name) {
  return name.toLowerCase().replace(/[’']/g, '').replace(/\+/g, '-plus').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Knob labels, longest first (§3 rule 6; Volume maps to Drive only through a controls hint, which the mock skips).
const LABELS = [
  ['Master Volume', 'Master'], ['Input Drive', 'Drive'], ['Midrange', 'Mid'], ['Midrang', 'Mid'], ['Middle', 'Mid'],
  ['Presence', 'Presence'], ['Treble', 'Treble'], ['Master', 'Master'], ['Drive', 'Drive'], ['Gain', 'Drive'],
  ['Bass', 'Bass'], ['Depth', 'Depth'], ['Mid', 'Mid'], ['MV', 'Master'],
];
const KNOBS = ['Drive', 'Bass', 'Mid', 'Treble', 'Master', 'Presence', 'Depth'];

function parseKnobs(quote) {
  const knobs = {};
  let rest = quote;
  for (const [label, knob] of LABELS) {
    const re = new RegExp(
      `(?<![A-Za-z])${escRe(label)}(?![A-Za-z])\\s*(?::|=|\\bat\\b|\\baround\\b)?\\s*(\\d+(?:\\.\\d+)?)(?!\\.?\\d)(?!\\s*[-/]\\s*\\d)`,
      'g',
    );
    for (const m of rest.matchAll(re)) {
      const value = Number(m[1]);
      if (knob in knobs || value < 0 || value > 10 || !quote.includes(m[1])) continue;
      knobs[knob] = value;
      rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length);
    }
  }
  const ordered = {};
  for (const k of KNOBS) if (k in knobs) ordered[k] = knobs[k];
  return ordered;
}

// Verbatim non-knob fragments of a "a / b / c" settings list.
function otherFragments(quote, knobs) {
  if (!quote.includes(' / ')) return [];
  const labelRe = new RegExp(`(?<![A-Za-z])(${LABELS.map(([l]) => escRe(l)).join('|')})(?![A-Za-z])\\s*[:=]?\\s*\\d`);
  return quote
    .split(' / ')
    .map((f) => f.replace(/^.*?:\s*Model:.*$/, '').replace(/[”"’.]+$/, '').trim())
    .filter((f) => f && /\d|\bON\b|\bOFF\b/i.test(f) && !labelRe.test(f) && !/^Model:/.test(f) && quote.includes(f))
    .filter(() => Object.keys(knobs).length > 0);
}

const DIR_VERBS = { 'turn up': 'up', 'dial up': 'up', increase: 'up', raise: 'up', crank: 'up', 'turn down': 'down', 'dial down': 'down', decrease: 'down', lower: 'down', reduce: 'down' };
function directionsFrom(tips) {
  const labelAlt = LABELS.map(([l]) => escRe(l)).join('|');
  const re = new RegExp(`\\b(${Object.keys(DIR_VERBS).join('|')})(?: the)? ((?:${labelAlt})(?:(?:, | and | or )(?:the )?(?:${labelAlt}))*)(?![A-Za-z])`, 'gi');
  const out = [];
  for (const tip of tips) {
    for (const m of tip.quote.matchAll(re)) {
      const dir = DIR_VERBS[m[1].toLowerCase()];
      for (const label of m[2].split(/, | and | or /)) {
        const clean = label.replace(/^the /i, '');
        const hit = LABELS.find(([l]) => l.toLowerCase() === clean.toLowerCase());
        if (!hit || clean === clean.toLowerCase()) continue; // "mids", "bass": not a knob label as written
        if (!out.some((d) => d.knob === hit[1])) out.push({ knob: hit[1], dir, quote: tip.quote, page: tip.page });
      }
    }
  }
  return out;
}

function stripHeader(text, section) {
  let t = text;
  while (t === section || t.startsWith(section + ' ')) t = t.slice(section.length + 1);
  return t;
}

// Every quotable sentence of a model's pages: each box run on its own, then sentences, then the §4.2 cuts.
function sentencesOf(m) {
  const out = [];
  for (let p = m.pages.start; p <= m.pages.end; p++) {
    for (const run of boxRuns(V.raw(p))) {
      for (const s of splitSentences(stripHeader(run, m.section))) {
        for (const piece of quotablePieces(s.trim(), p)) {
          if (piece.quote !== m.section && !out.some((o) => o.quote === piece.quote)) out.push(piece);
        }
      }
    }
  }
  return out;
}

function deriveModels() {
  const sections = JSON.parse(readFileSync(join(GUIDE_DIR, 'yek-guide-sections.json'), 'utf8'));
  const models = [];
  sections.forEach((sec, i) => {
    if (APPENDIX.has(sec.title)) return;
    const title = sec.title;
    const cut = title.indexOf(' (');
    const name = DUP_NAMES[sec.page] ?? (cut >= 0 ? title.slice(0, cut) : title);
    const based_on = cut >= 0 && title.endsWith(')') ? title.slice(cut + 2, -1) : null;
    const next = sections[i + 1]?.page ?? 302;
    models.push({ sec, name, based_on, pages: { start: sec.page, end: next - 1 } });
  });
  if (models.length !== 109) die(`expected 109 model sections, got ${models.length}`);

  const byId = new Set();
  const built = models.map(({ sec, name, based_on, pages }) => {
    const id = slug(name);
    if (byId.has(id)) die(`duplicate id ${id}`);
    byId.add(id);
    const section = sec.title;
    const card = sec.card ?? {};
    const start = pages.start;
    const joined = normText(Array.from({ length: pages.end - start + 1 }, (_, k) => RAW.get(start + k)).join(' '));

    // A stub's only content is the pointer sentence (plus the printed page number).
    const stub = stripHeader(pageText(start), section).match(/^Please refer to the section on the (.+?) models?\.(?: \d+)?$/);

    const unit_names = [];
    const addName = (n, page = start) => {
      n = n.trim();
      if (n.length < 3 || /\bmodels?$/i.test(n) || !pageText(page).includes(n)) return;
      if (unit_names.some((u) => u.name.toLowerCase() === n.toLowerCase())) return;
      unit_names.push({ name: n, evidence: n, page });
    };
    for (const part of name.split(/, | and | \/ /)) addName(part);
    const synText = card.Synopsis ? normText(card.Synopsis) : '';
    for (const v of synText.matchAll(/• ([^•:–]+?)(?::| – )/g)) addName(v[1]);
    if (!unit_names.length && pageText(start).includes(name)) unit_names.push({ name, evidence: name, page: start });

    const brands = BRANDS.filter(([, token]) => wholeWord(token).test(section)).map(([b]) => b);

    const specs = {};
    for (const [key, label] of SPEC_KEYS) {
      const v = sec.specs?.[label] ? normText(sec.specs[label]) : null;
      specs[key] = v && joined.includes(v) ? v : null;
    }
    const yn = (specs.master_volume ?? '').split(/\s+/).filter((t) => t === 'Yes' || t === 'No');
    const master_volume = !specs.master_volume || !yn.length ? 'unknown' : yn.every((t) => t === yn[0]) ? yn[0].toLowerCase() : 'mixed';
    const found = new Set(
      [...(specs.power_tubes ?? '').matchAll(/[A-Z0-9]+/g)].map((t) => TUBE_ALIAS[t[0]] ?? t[0]).filter((t) => TUBES.includes(t)),
    );

    // A card field (junk-laden, e.g. "… Web, Manual …") → its first quotable piece on the start page.
    const firstPiece = (raw) => {
      if (!raw) return null;
      const full = normText(raw);
      for (const c of [full.split(' Web,')[0].trim(), full]) {
        if (!pageText(start).includes(c)) continue;
        const [piece] = quotablePieces(c, start);
        if (piece) return piece;
      }
      return null;
    };
    const syn = firstPiece(card.Synopsis);
    const speaker = firstPiece(card['Cabinet/speaker']);
    const stock = firstPiece(card['Stock cabs']);

    const tips = [];
    for (const s of splitSentences(normText(card.Tips ?? ''))) {
      if (!pageText(start).includes(s)) continue;
      for (const piece of quotablePieces(s, start)) if (tips.length < 3) tips.push(Q(piece.quote, start, { said_by: piece.said_by }));
    }

    const model = {
      id, section, name, based_on, pages, refers_to: stub ? stub[1] : null, unit_names, brands, specs,
      facets: { master_volume, power_tubes: TUBES.filter((t) => found.has(t)) },
      synopsis: syn ? Q(syn.quote, start) : null, controls: null, tips,
      cab: { speaker: speaker ? Q(speaker.quote, start) : null, stock_cabs: stock ? Q(stock.quote, start) : null, notes: [] },
      settings: [], directions: [], notes: [],
    };
    if (stub) return model;

    for (const s of sentencesOf(model)) {
      if (!/\bsettings\b/i.test(s.quote)) continue;
      const knobs = parseKnobs(s.quote);
      if (!Object.keys(knobs).length) continue;
      const unit = unit_names.find((u) => s.quote.includes(`Model: ${u.name}`) || s.quote.includes(`(${u.name} model)`));
      model.settings.push({
        ...Q(s.quote, s.page, { said_by: s.said_by }),
        context: null, unit_name: unit ? unit.name : null, knobs, other: otherFragments(s.quote, knobs),
      });
    }
    model.directions = directionsFrom(tips);
    return model;
  });

  // Stubs point at the section they name.
  for (const m of built) {
    if (!m.refers_to) continue;
    const phrase = m.refers_to.toLowerCase();
    const target = built.find((t) => !t.refers_to && t.id !== m.id && t.name.toLowerCase().startsWith(phrase));
    if (!target) die(`stub ${m.id}: no target for "${m.refers_to}"`);
    m.refers_to = target.id;
  }
  return built;
}

function conventions() {
  return [
    ['high-low-inputs', 'If the actual amp has two inputs, the model is based on the input with the highest gain.'],
    ['no-master-volume', 'If the original amp has no Master Volume control, the Master control in the amp model will default at 10.'],
    ['two-gain-controls', 'If the original amp has two gain controls, the one that’s closest to the 1/4” input on the actual amp will be represented by Input Drive in the amp model, and the other one by Overdrive.'],
    ['single-tone-control', 'If the original amp only has a single Tone control, the control will be mapped to either Treble or Presence/Hi Cut in the amp model.'],
    ['taper-match', 'The controls of the virtual amp models, such as Drive, Bass, Treble etc. match the tapers on the original amps within 10%, except for Master, Presence/Hi Cut and Depth.'],
    ['soft-reset', 'A soft reset is performed by de-selecting and re-selecting the amp type in the Amp block. This resets most parameters, including Presence and Master, but leaves the Drive controls and Bass/Mid/Treble untouched.'],
  ].map(([id, quote]) => ({ id, ...Q(quote, 12) }));
}

// Stored quotes in a --models input that may not be shown: listed, then dropped (--drop-spanning) or fatal.
function checkStored(data, drop) {
  const failures = [];
  const bad = (o, where) => {
    if (!o || typeof o.quote !== 'string' || !Number.isInteger(o.page)) return false;
    const problem = quoteProblem(o.quote, o.page);
    if (problem) failures.push(`${where} p. ${o.page}: ${problem}: ${o.quote.slice(0, 110)}`);
    return Boolean(problem);
  };
  data.conventions.forEach((c) => bad(c, `conventions.${c.id}`));
  for (const m of data.models) {
    for (const key of ['synopsis', 'controls']) if (bad(m[key], `${m.id}.${key}`) && drop) m[key] = null;
    for (const key of ['speaker', 'stock_cabs']) if (bad(m.cab[key], `${m.id}.cab.${key}`) && drop) m.cab[key] = null;
    for (const [key, list] of [['tips', m.tips], ['notes', m.notes], ['settings', m.settings], ['directions', m.directions], ['cab.notes', m.cab.notes]]) {
      const kept = list.filter((o, i) => !bad(o, `${m.id}.${key}[${i}]`));
      if (drop) {
        if (key === 'cab.notes') m.cab.notes = kept;
        else m[key] = kept;
      }
    }
  }
  if (failures.length && (!drop || failures.some((f) => f.startsWith('conventions')))) {
    die(`${failures.length} stored quote(s) in the --models input can't be shown:\n  ${failures.join('\n  ')}`);
  }
  return failures;
}

// ---------- load or derive ----------
const argModels = process.argv.indexOf('--models');
let data;
let droppedStored = [];
if (argModels >= 0) {
  data = JSON.parse(readFileSync(process.argv[argModels + 1], 'utf8'));
  droppedStored = checkStored(data, process.argv.includes('--drop-spanning'));
} else {
  const shaInput = JSON.stringify([...RAW].sort((a, b) => a[0] - b[0]));
  data = {
    schema: 1,
    guide: {
      title: "Yek's Guide to the Fractal Audio Amp Models",
      by: 'Alexander van Engelen (yek); compiled by simviz',
      revision: 'April 2017',
      firmware: 'Quantum 7.02',
      pdf_pages: 301,
      pages_sha256: createHash('sha256').update(shaInput).digest('hex'),
    },
    conventions: conventions(),
    models: deriveModels(),
  };
}
const MODELS = new Map(data.models.map((m) => [m.id, m]));
const model = (id) => MODELS.get(id) ?? die(`no model ${id}`);
const convention = (id) => data.conventions.find((c) => c.id === id) ?? die(`no convention ${id}`);

// ---------- canned answers (§4.2–4.5, §6) ----------
const GUESS = 'starting guess — not from the guide';
const DRIVE_BY_INTENT = { clean: 2.5, edge: 4.5, crunch: 6, lead: 7, high_gain: 7 };
const ARES_RE = /motor\s*drive|(transformer|xformer|xfrmr)\s*grind/i;
const ARES_ADVICE = "Your firmware doesn't have this control. Skip this step: Fractal replaced it with Speaker Compression (Spkr Comp), which resets to 3.0.";
const STOP_WORDS = 'a an and the of on in at to for with from by like my me i want need get some sort kind type tone tones sound sounds sounding song guitar guitars amp amps model models setting settings preset patch please how what that this those these is are be it its his her their do does make give play playing through into onto over under about via as or but than'.split(' ');
const GENERIC_WORDS = 'clean crunch crunchy rhythm lead solo dirty distorted distortion overdrive overdriven drive gain master volume bass mid middle treble presence depth loud quiet warm bright dark fat big heavy'.split(' ');

const release = JSON.parse(readFileSync(join(REPO, 'data/sources/fractal-release-notes.json'), 'utf8'));
const ARES = {
  firmware: 'Ares',
  guide_firmware: 'Quantum 7.02',
  note: 'yek\'s guide was written for Quantum 7.02. Your Axe-Fx II runs Ares, which came later. Quantum 9.00 removed Motor Drive and Transformer Grind from the Amp block and replaced them with Speaker Compression (Spkr Comp), and Fractal says Ares amp modeling "should sound very similar".',
  sources: [
    { url: release.sources[0].url, fetched: release.sources[0].fetched, quote: release.sources[0].quotes[0] },
    { url: release.sources[1].url, fetched: release.sources[1].fetched, quote: release.sources[1].quotes[1] },
  ],
};
const GUIDE = { title: data.guide.title, revision: data.guide.revision, firmware: data.guide.firmware };
const AI_OFF = { used: false, reason: 'off', dropped: [], cost_cad: 0 };

const termRe = (term) => new RegExp(`(?<![A-Za-z0-9])${term.split(/\s+/).map(escRe).join('[\\s’\'-]+')}(?![A-Za-z0-9])`, 'i');

function whyQuotes(m, terms, max = 3) {
  const target = m.refers_to ? model(m.refers_to) : m;
  const stored = [target.synopsis, ...target.tips].filter(Boolean);
  const pool = [...stored.map((s) => ({ ...s, rank: 1 })), ...sentencesOf(target).map((s) => ({ ...s, rank: 0 }))];
  const scored = [];
  for (const s of pool) {
    const matched = terms.filter((t) => termRe(t).test(s.quote));
    if (matched.length && !scored.some((x) => x.quote === s.quote)) scored.push({ ...s, matched });
  }
  // More terms first; then a sentence naming the model or a unit name (or a unit name's last word of 3+ letters,
  // §4.2 "Which sentence first"); then whole sentences over fragments; then stored tips/synopsis; then guide order.
  const names = [target.name, ...target.unit_names.map((u) => u.name), ...target.unit_names.map((u) => u.name.split(/\s+/).pop()).filter((w) => w.length >= 3)]
    .map((n) => n.toLowerCase());
  const namesModel = (q) => (names.some((n) => q.toLowerCase().includes(n)) ? 1 : 0);
  const whole = (q) => (/[.!?][”"’)]*$/.test(q) ? 1 : 0);
  scored.sort((a, b) =>
    b.matched.length - a.matched.length || namesModel(b.quote) - namesModel(a.quote) || whole(b.quote) - whole(a.quote) || b.rank - a.rank || a.page - b.page);
  const saidBy = (q) =>
    [...target.tips, ...target.notes, ...target.settings].find((x) => x.quote === q.quote)?.said_by ?? q.said_by ?? null;
  const picked = [];
  for (const s of scored) {
    if (picked.length === max) break;
    if (picked.length && s.matched.every((t) => picked.some((p) => p.matched.includes(t))) && picked.length >= 2) continue;
    picked.push(s);
  }
  if (!picked.length) die(`${m.id}: no why quote for terms ${terms.join(', ')}`);
  return picked.map((s) => Q(s.quote, s.page, { said_by: saidBy(s), matched: s.matched }));
}

function suggestion(id, { rank, score, terms, intent = null, source = 'guide_search', why, unit, plantedFlag }) {
  const m = model(id);
  const target = m.refers_to ? model(m.refers_to) : m;
  why ??= whyQuotes(target, terms);
  const names = target.unit_names.map((u) => u.name);
  const unit_name =
    unit ?? names.find((n) => why.some((w) => w.quote.toLowerCase().includes(n.toLowerCase()))) ?? names[0];
  if (!names.includes(unit_name)) die(`${id}: ${unit_name} is not one of its unit names`);

  const words = [...terms, intent].filter(Boolean);
  const entry =
    target.settings.find((s) => s.unit_name === unit_name) ??
    target.settings.find((s) => words.some((w) => s.quote.toLowerCase().includes(w.toLowerCase()))) ??
    target.settings[0] ??
    null;

  const knobs = KNOBS.map((knob) => {
    if (entry && knob in entry.knobs)
      return { knob, value: entry.knobs[knob], kind: 'guide', quote: entry.quote, page: entry.page, said_by: entry.said_by };
    if (knob === 'Master' && target.facets.master_volume === 'no') {
      const c = convention('no-master-volume');
      return { knob, value: 10, kind: 'guide_rule', quote: c.quote, page: c.page };
    }
    const base = knob === 'Drive' ? DRIVE_BY_INTENT[intent] ?? 5 : 5;
    const k = { knob, value: base, kind: 'guess', note: GUESS };
    const d = target.directions.find((x) => x.knob === knob);
    if (d) {
      // §4.3 rule 5: up → at least 7, down → at most 3; a guess already on that side stays.
      k.value = d.dir === 'up' ? Math.max(base, 7) : Math.min(base, 3);
      k.direction = { dir: d.dir, quote: d.quote, page: d.page };
    }
    return k;
  });

  const ares_flags = [];
  const scan = (text, where, page) => {
    const hit = text.match(ARES_RE);
    if (hit) ares_flags.push({ param: /motor/i.test(hit[0]) ? 'Motor Drive' : 'Transformer Grind', where, quote: text, page, advice: ARES_ADVICE });
  };
  why.forEach((w) => scan(w.quote, 'why', w.page));
  if (entry) {
    scan(entry.quote, 'settings', entry.page);
    entry.other.forEach((o) => scan(o, 'settings', entry.page));
  }
  knobs.forEach((k) => k.direction && scan(k.direction.quote, 'direction', k.direction.page));
  if (plantedFlag) {
    if (!plantedFlag.startsWith('SAMPLE (test only):')) die('planted Ares flag must start with SAMPLE (test only):');
    scan(plantedFlag, 'why', null);
  }

  const taper = convention('taper-match');
  return {
    rank, model_id: target.id, unit_name, section: target.section, based_on: target.based_on, brands: target.brands,
    pages: target.pages, source, score, why, knobs,
    taper_note: knobs.some((k) => k.kind === 'guide') ? { quote: taper.quote, page: taper.page } : null,
    other_settings: entry ? entry.other.map((text) => ({ text, quote: entry.quote, page: entry.page })) : [],
    cab: target.cab, ares_flags,
  };
}

function answer(query, { matched = [], unmatched = [], ai_terms = [], intent = null, ai = AI_OFF, general_knowledge = [], suggestions = [] }) {
  const ok = suggestions.length > 0;
  return {
    query, status: ok ? 'ok' : 'no_guide_support', message: ok ? null : "I can't point to the guide for that.",
    understood: { matched_terms: matched, unmatched_terms: unmatched, ai_terms, intent },
    ai, general_knowledge: ok ? general_knowledge : [], suggestions, ares: ARES, guide: GUIDE,
  };
}

const GK_LABEL = 'General knowledge (AI) — not from the guide';
const PLANTED = 'SAMPLE (test only): add Transformer Grind to taste';

const answers = {};
const put = (query, on, off = null) => (answers[normText(query).toLowerCase()] = { on, off });

put('Van Halen brown sound', answer('Van Halen brown sound', {
  matched: ['van halen', 'brown sound'],
  suggestions: [
    // All seven knobs are guesses; the tip nudges the guessed Presence up.
    suggestion('brit-brown-and-fas-brown', { rank: 1, score: 14.2, terms: ['brown sound', 'van halen'] }),
    // Guide values from a settings entry, the p. 12 rule for Master, guesses for the rest.
    suggestion('1959slp', { rank: 2, score: 7.9, terms: ['van halen'] }),
  ],
}));

put('clean worship pad with sparkle', answer('clean worship pad with sparkle', {
  matched: ['sparkle', 'clean'], unmatched: ['worship', 'pad'], intent: 'clean',
  suggestions: [
    suggestion('ac-20', { rank: 1, score: 6.1, terms: ['sparkle', 'clean'], intent: 'clean' }),
    suggestion('deluxe-verb', { rank: 2, score: 5.4, terms: ['sparkle', 'sparkling', 'clean'], intent: 'clean' }),
  ],
}));

const puppetsOff = answer('the rhythm tone on Master of Puppets', { unmatched: ['puppets'], intent: 'crunch' });
put('the rhythm tone on Master of Puppets', answer('the rhythm tone on Master of Puppets', {
  matched: ['metallica', 'mark iic+'], unmatched: ['puppets'], ai_terms: ['metallica', 'mark iic+'], intent: 'crunch',
  ai: {
    used: true, reason: null, cost_cad: 0.0031,
    dropped: [
      { kind: 'unknown_model', detail: 'Brown Sound Deluxe' },
      { kind: 'bad_page', detail: 'USA IIC+, p. 12' },
    ],
  },
  general_knowledge: [
    { text: 'Master of Puppets is a 1986 Metallica album and song. Its rhythm guitar tone is widely credited to a MESA/Boogie Mark IIC+.', label: GK_LABEL },
  ],
  suggestions: [
    suggestion('usa-iic-plus-and-usa-iic-plus-plus', {
      rank: 1, score: 9.6, source: 'ai_checked', terms: ['metallica'], intent: 'crunch', unit: 'USA IIC+',
      why: [Q('Quantum firmware 3.03 brought us the ”IIC++” model, also referred to as “Metallica’s IIC+” .', 270, { said_by: null, matched: ['metallica'] })],
    }),
    suggestion('recto1-and-recto2', { rank: 2, score: 3.2, terms: ['metallica'], intent: 'crunch' }),
  ],
}), puppetsOff);

put('Robben Ford', answer('Robben Ford', {
  matched: ['robben ford'],
  suggestions: [
    suggestion('bludojai', { rank: 1, score: 15.8, terms: ['robben ford'] }),
    suggestion('ods-100', { rank: 2, score: 11.3, terms: ['robben ford'] }),
  ],
}));

put('AC30 chime', answer('AC30 chime', {
  matched: ['ac30', 'chime'], intent: 'clean',
  suggestions: [
    // Top Boost is the chime channel; its unit name isn't in the section title, so the card shows "Guide section".
    suggestion('class-a-30w', { rank: 1, score: 12.7, terms: ['ac30', 'chime'], intent: 'clean', unit: 'Class-A 30W TB', plantedFlag: PLANTED }),
    suggestion('class-a-15w-tb', { rank: 2, score: 8.4, terms: ['ac30', 'chime'], intent: 'clean' }),
  ],
}));

put('djent', answer('djent', {
  matched: ['djent'], intent: 'high_gain',
  suggestions: [suggestion('thordendal', { rank: 1, score: 4.9, terms: ['djent'], intent: 'high_gain' })],
}));

// Guide knobs plus a tip that nudges a guessed knob.
put('JTM 45', answer('JTM 45', {
  matched: ['jtm 45'],
  suggestions: [suggestion('brit-jm45', { rank: 1, score: 10.2, terms: ['jtm 45', 'jtm45'] })],
}));

const noSupportTemplate = answer('', { unmatched: [] });

// ---------- checks and output ----------
const all = Object.values(answers).flatMap((e) => [e.on, e.off]).filter(Boolean);
const cards = all.flatMap((a) => a.suggestions);
const need = (ok, what) => ok || die(`fixture is missing: ${what}`);
need(cards.some((s) => s.knobs.every((k) => k.kind === 'guess')), 'a card with all seven knobs guessed');
need(cards.some((s) => s.knobs.some((k) => k.kind === 'guide') && s.knobs.some((k) => k.direction)), 'a card with guide knobs + a direction nudge');
need(cards.some((s) => s.ares_flags.some((f) => f.quote.startsWith('SAMPLE (test only):'))), 'a planted Ares flag');
need(all.some((a) => a.general_knowledge.length && a.ai.dropped.some((d) => d.detail === 'Brown Sound Deluxe')), 'general knowledge + drops');
for (const s of cards) {
  need(s.why.length >= 1 && s.why.length <= 3, `${s.model_id}: 1–3 why quotes`);
  need(s.knobs.length === 7 && s.knobs.every((k, i) => k.knob === KNOBS[i]), `${s.model_id}: seven knobs in order`);
}

let quoteChars = 0;
const countQuotes = (x) => {
  if (Array.isArray(x)) return x.forEach(countQuotes);
  if (x && typeof x === 'object') {
    if (typeof x.quote === 'string' && Number.isInteger(x.page)) quoteChars += x.quote.length;
    Object.values(x).forEach(countQuotes);
  }
};
countQuotes(data.models);
const guideChars = [...V.text.values()].reduce((n, t) => n + t.length, 0);

const OUT = join(APP, 'mock');
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'models.json'), JSON.stringify(data, null, 1) + '\n');
writeFileSync(
  join(OUT, 'answers.json'),
  JSON.stringify(
    {
      _about: 'Canned answers for ?mock=1, built by app/tools/build-mock.mjs. Quotes are verified on their pages and never span a box break; scores are placeholders. The SAMPLE (test only) Ares flag is planted on purpose.',
      source: argModels >= 0 ? 'data/models.json' : 'derived from the local guide (pre data-ready)',
      health: { ok: true, models: data.models.length, guide: { loaded: true, pages: 301, sha_ok: true }, ai: { configured: true, model: 'gpt-5.4-mini', cap_cad: 2, spent_cad: 0.0412, calls: 6 } },
      stop_words: STOP_WORDS,
      generic_words: GENERIC_WORDS,
      no_support_template: noSupportTemplate,
      answers,
    },
    null,
    1,
  ) + '\n',
);
if (droppedStored.length) console.log(`dropped ${droppedStored.length} stored quote(s) from the --models input:\n  ${droppedStored.join('\n  ')}`);
console.log(`models: ${data.models.length} (${data.models.filter((m) => m.refers_to).length} stubs), unit names: ${data.models.reduce((n, m) => n + m.unit_names.length, 0)}`);
console.log(`answers: ${Object.keys(answers).length} canned queries, ${cards.length} cards`);
console.log(`quote budget: ${quoteChars} of ${guideChars} characters (${((100 * quoteChars) / guideChars).toFixed(1)}%)`);
