// Binder (docs/API.md §8): picks saved on the device, and a one-page-per-3-picks print.
import { carry } from './api.js';
import { headerLines } from './card.js';
import { GUESS_NOTE, hasGuess, knobSource } from './knobs.js';
import { esc, renderShell } from './shell.js';
import { listPicks, removePick, storageAvailable } from './store.js';

renderShell();

const PER_PAGE = 3;
const FOOTER = "From yek's guide to the Fractal Audio amp models (rev. April 2017). Guesses are not from the guide.";

const root = document.getElementById('binder');
const statusEl = document.getElementById('status');

document.getElementById('print-btn').addEventListener('click', () => window.print());

function cabLine(cab) {
  const bits = [];
  if (cab?.speaker) bits.push(`“${esc(cab.speaker.quote)}” (p. ${cab.speaker.page})`);
  if (cab?.stock_cabs) bits.push(`Stock cabs: “${esc(cab.stock_cabs.quote)}” (p. ${cab.stock_cabs.page})`);
  return `<p class="small"><strong>Cab:</strong> ${bits.length ? bits.join(' · ') : 'the guide has no cab line for this model.'}</p>`;
}

function pickHtml({ query, suggestion: s }) {
  const why = s.why?.[0];
  return `<article class="pick glass panel" data-testid="pick" data-model-id="${esc(s.model_id)}">
    <p class="pick-query">For “${esc(query)}”</p>
    <h2 class="unit-name">${esc(s.unit_name)}</h2>
    ${headerLines(s)}
    <table class="knob-table">
      <thead><tr><th scope="col">Knob</th><th scope="col">Value</th><th scope="col">Source</th></tr></thead>
      <tbody>${s.knobs
        .map((k) => `<tr data-kind="${esc(k.kind)}"><th scope="row">${esc(k.knob)}</th><td class="val">${esc(k.value)}</td><td>${esc(knobSource(k))}</td></tr>`)
        .join('')}</tbody>
    </table>
    ${hasGuess(s.knobs) ? `<p class="guess-note small">Guess = ${GUESS_NOTE}</p>` : ''}
    ${cabLine(s.cab)}
    ${why ? `<p class="quote"><q>${esc(why.quote)}</q> <span class="pill pill-page">p. ${Number(why.page)}</span></p>` : ''}
    <div class="card-actions no-print">
      <a class="btn" href="${esc(carry(`model.html?id=${encodeURIComponent(s.model_id)}`))}">Model details</a>
      <button type="button" class="btn" data-action="remove" data-model-id="${esc(s.model_id)}" data-query="${esc(query)}">Remove</button>
    </div>
  </article>`;
}

function render() {
  const picks = listPicks();
  if (!picks.length) {
    root.innerHTML = `<div class="glass panel" data-testid="binder-empty">
      <p>${storageAvailable() ? 'Nothing in your binder yet.' : "This browser isn't letting Tone Finder save anything, so the binder is empty."}</p>
      <p><a class="btn" href="${esc(carry('index.html'))}">Find starting points</a></p>
    </div>`;
    return;
  }
  const pages = [];
  for (let i = 0; i < picks.length; i += PER_PAGE) pages.push(picks.slice(i, i + PER_PAGE));
  root.innerHTML = pages
    .map(
      (group) => `<section class="print-page">
        ${group.map(pickHtml).join('')}
        <p class="print-only print-footer">${FOOTER}</p>
      </section>`,
    )
    .join('');
}

root.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-action="remove"]');
  if (!btn) return;
  const pick = listPicks().find((p) => p.suggestion.model_id === btn.dataset.modelId && p.query === btn.dataset.query);
  removePick(btn.dataset.query, btn.dataset.modelId);
  render();
  statusEl.textContent = pick ? `Removed ${pick.suggestion.unit_name}.` : 'Removed.';
});

render();
