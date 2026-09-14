// Suggestion card (docs/API.md §8).
import { carry } from './api.js';
import { dialHtml, GUESS_NOTE, hasGuess } from './knobs.js';
import { esc, pagePill, pageRange } from './shell.js';

// The name parts of a section title: "Brit Brown and FAS Brown (FAS custom models)" → ["brit brown", "fas brown"].
export function namePartsOf(section) {
  const cut = section.indexOf(' (');
  const name = cut >= 0 ? section.slice(0, cut) : section;
  return name
    .split(/, | and | \/ /)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const FAS_CUSTOM = /^FAS custom model/i;

// "Based on Marshall SLP1959, Vintage Re-Issue Series · pp. 28–31", plus "Guide section: …" only when the unit
// name isn't one of the section title's name parts (the title would otherwise just repeat based_on).
export function headerLines(s) {
  let basedOn = null;
  if ((s.based_on && FAS_CUSTOM.test(s.based_on)) || (!s.based_on && FAS_CUSTOM.test(s.section))) {
    basedOn = 'Fractal Audio custom model (no real amp)';
  } else if (s.based_on) {
    basedOn = `Based on ${s.based_on}`;
  }
  const first = [basedOn, pageRange(s.pages)].filter(Boolean).join(' · ');
  const showSection = !namePartsOf(s.section).includes(String(s.unit_name).toLowerCase());
  return `<p class="section-line" data-testid="based-on">${esc(first)}</p>${
    showSection ? `<p class="section-line" data-testid="guide-section">Guide section: ${esc(s.section)}</p>` : ''
  }`;
}

export function attribution(saidBy) {
  if (!saidBy) return '';
  return saidBy.toLowerCase() === 'yek' ? 'yek' : `${saidBy}, quoted in the guide`;
}

// A verified quote as a blockquote with a teal left edge. The text is shown exactly as verified: no added quote
// marks, because many quotes carry the guide's own “ ” and added ones would double them (API.md §8).
export function quoteHtml(q, { small = false } = {}) {
  const by = attribution(q.said_by);
  return `<blockquote class="quote${small ? ' quote-small' : ''}" data-testid="quote">
    <p class="quote-text">${esc(q.quote)}</p>
    <p class="quote-meta">${pagePill(q.page)}${by ? ` <span class="said-by">${esc(by)}</span>` : ''}</p>
  </blockquote>`;
}

const ICON_BOOK =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/></svg>';
const ICON_PLUS =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_CHECK =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';

export function binderButton(saved) {
  return saved ? `${ICON_CHECK}<span>In binder</span>` : `${ICON_PLUS}<span>Add to binder</span>`;
}

export function cabHtml(cab) {
  if (!cab || (!cab.speaker && !cab.stock_cabs && !(cab.notes ?? []).length)) return '';
  const rows = [];
  if (cab.speaker) rows.push(`<li><div class="muted small">Speaker</div>${quoteHtml(cab.speaker)}</li>`);
  if (cab.stock_cabs) rows.push(`<li><div class="muted small">Stock cabs</div>${quoteHtml(cab.stock_cabs)}</li>`);
  for (const n of cab.notes ?? []) rows.push(`<li>${quoteHtml(n)}</li>`);
  return `<h3>Cab</h3><ul class="detail-list cab" data-testid="cab">${rows.join('')}</ul>`;
}

// The demo data plants one flag whose text starts "SAMPLE (test only):"; it is never shown as if the guide said it.
const isSample = (f) => String(f.quote).startsWith('SAMPLE (test only):');

export function aresFlagsHtml(flags) {
  return (flags ?? [])
    .map(
      (f) => `<div class="ares-flag" role="note" data-testid="ares-flag">
        <strong>${esc(f.param)}:</strong> ${esc(f.advice)}
        ${
          isSample(f)
            ? '<p class="test-only" data-testid="test-only">Test sample from the demo data — not a guide quote.</p>'
            : ''
        }
        <div class="small muted">Mentioned here:</div>
        <blockquote class="quote quote-small${isSample(f) ? ' quote-sample' : ''}" data-testid="flag-quote">
          <p class="quote-text">${esc(f.quote)}</p>${
            f.page ? `<p class="quote-meta">${isSample(f) ? '<span class="small">flagged on the quote from</span> ' : ''}${pagePill(f.page)}</p>` : ''
          }
        </blockquote>
      </div>`,
    )
    .join('');
}

// The sentence behind every knob that carries a page (docs/API.md §8): one line per supporting quote, naming the
// knobs and values it states. A page pill on a dial always has its sentence displayed here.
export function knobSourcesHtml(knobs, { small = false } = {}) {
  const groups = [];
  for (const k of knobs) {
    if (k.kind !== 'guide' && k.kind !== 'guide_rule') continue;
    let g = groups.find((x) => x.quote === k.quote && x.page === k.page);
    if (!g) groups.push((g = { quote: k.quote, page: k.page, said_by: k.said_by ?? null, rule: k.kind === 'guide_rule', knobs: [] }));
    g.knobs.push(k);
  }
  if (!groups.length) return '';
  return `<ul class="nudges knob-sources">${groups
    .map(
      (g) =>
        `<li data-testid="knob-source" data-knobs="${esc(g.knobs.map((k) => k.knob).join(','))}"><span class="nudge-label">${esc(
          g.knobs.map((k) => `${k.knob} ${Number(k.value)}`).join(' · '),
        )}${g.rule ? ' (the guide’s rule)' : ''}: </span>${quoteHtml(g, { small })}</li>`,
    )
    .join('')}</ul>`;
}

export function renderCard(s, { saved = false, query = '' } = {}) {
  const ai = s.source === 'ai_checked';
  const nudges = s.knobs.filter((k) => k.direction);
  return `<article class="card glass${ai ? ' ai' : ''}" data-testid="suggestion" data-model-id="${esc(s.model_id)}">
    <div class="card-head">
      <h2 class="unit-name">${esc(s.unit_name)}</h2>
      ${
        ai
          ? '<span class="pill pill-ai" data-testid="source-pill">AI pick · quotes checked</span>'
          : '<span class="pill pill-search" data-testid="source-pill">Guide search</span>'
      }
    </div>
    ${headerLines(s)}

    <h3>Why</h3>
    ${s.why.map((w) => quoteHtml(w)).join('')}

    <h3>Knobs</h3>
    <div class="dials">${s.knobs.map(dialHtml).join('')}</div>
    ${knobSourcesHtml(s.knobs)}
    ${hasGuess(s.knobs) ? `<p class="guess-note" data-testid="guess-note">${GUESS_NOTE}</p>` : ''}
    ${
      nudges.length
        ? `<ul class="nudges">${nudges
            .map(
              (k) =>
                `<li data-testid="nudge"><span class="nudge-label">${esc(k.knob)} nudged ${esc(k.direction.dir)}: </span>${quoteHtml(k.direction)}</li>`,
            )
            .join('')}</ul>`
        : ''
    }
    ${
      s.other_settings.length
        ? `<p class="other-settings">Other settings in the guide’s list: ${s.other_settings.map((o) => esc(o.text)).join(' · ')} ${pagePill(s.other_settings[0].page)}</p>`
        : ''
    }
    ${s.taper_note ? `<div class="taper-note" data-testid="taper-note"><p class="small muted">About knob tapers (not a knob setting):</p>${quoteHtml(s.taper_note, { small: true })}</div>` : ''}
    ${cabHtml(s.cab)}
    ${aresFlagsHtml(s.ares_flags)}
    <div class="card-actions">
      <a class="btn" href="${esc(carry(`model.html?id=${encodeURIComponent(s.model_id)}`))}">${ICON_BOOK}<span>Model details</span></a>
      <button type="button" class="btn${saved ? ' is-saved' : ''}" data-action="binder" data-model-id="${esc(s.model_id)}" data-query="${esc(query)}" aria-pressed="${saved}">${binderButton(saved)}</button>
    </div>
  </article>`;
}
