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

export function quoteHtml(q, tag = 'p') {
  const by = attribution(q.said_by);
  return `<${tag} class="quote" data-testid="quote"><q>${esc(q.quote)}</q> ${pagePill(q.page)}${
    by ? ` <span class="said-by">${esc(by)}</span>` : ''
  }</${tag}>`;
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
  if (cab.speaker) rows.push(`<li><span class="muted">Speaker:</span> ${quoteHtml(cab.speaker, 'span')}</li>`);
  if (cab.stock_cabs) rows.push(`<li><span class="muted">Stock cabs:</span> ${quoteHtml(cab.stock_cabs, 'span')}</li>`);
  for (const n of cab.notes ?? []) rows.push(`<li>${quoteHtml(n, 'span')}</li>`);
  return `<h3>Cab</h3><ul class="detail-list cab" data-testid="cab">${rows.join('')}</ul>`;
}

export function aresFlagsHtml(flags) {
  return (flags ?? [])
    .map(
      (f) => `<div class="ares-flag" role="note" data-testid="ares-flag">
        <strong>${esc(f.param)}:</strong> ${esc(f.advice)}
        <div class="small muted">Mentioned here: “${esc(f.quote)}”${f.page ? ` ${pagePill(f.page)}` : ''}</div>
      </div>`,
    )
    .join('');
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
    ${hasGuess(s.knobs) ? `<p class="guess-note" data-testid="guess-note">${GUESS_NOTE}</p>` : ''}
    ${
      nudges.length
        ? `<ul class="nudges">${nudges
            .map(
              (k) =>
                `<li data-testid="nudge">${esc(k.knob)} nudged ${esc(k.direction.dir)}: <q>${esc(k.direction.quote)}</q> ${pagePill(k.direction.page)}</li>`,
            )
            .join('')}</ul>`
        : ''
    }
    ${
      s.other_settings.length
        ? `<p class="other-settings">Other settings in the guide’s list: ${s.other_settings.map((o) => esc(o.text)).join(' · ')} ${pagePill(s.other_settings[0].page)}</p>`
        : ''
    }
    ${s.taper_note ? `<p class="taper-note" data-testid="taper-note"><q>${esc(s.taper_note.quote)}</q> ${pagePill(s.taper_note.page)}</p>` : ''}
    ${cabHtml(s.cab)}
    ${aresFlagsHtml(s.ares_flags)}
    <div class="card-actions">
      <a class="btn" href="${esc(carry(`model.html?id=${encodeURIComponent(s.model_id)}`))}">${ICON_BOOK}<span>Model details</span></a>
      <button type="button" class="btn${saved ? ' is-saved' : ''}" data-action="binder" data-model-id="${esc(s.model_id)}" data-query="${esc(query)}" aria-pressed="${saved}">${binderButton(saved)}</button>
    </div>
  </article>`;
}
