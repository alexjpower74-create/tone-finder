// Model detail (docs/API.md §8): every cited note, each with its page pill.
import { carry, getModel } from './api.js';
import { cabHtml, quoteHtml } from './card.js';
import { esc, pagePill, renderShell } from './shell.js';

renderShell();

const root = document.getElementById('model');
const id = new URLSearchParams(location.search).get('id') ?? '';

const SPEC_ROWS = [
  ['years', 'Years made'], ['circuit', 'Circuit'], ['power', 'Power'], ['master_volume', 'Master volume'],
  ['negative_feedback', 'Negative feedback'], ['preamp_tubes', 'Preamp tubes'], ['power_tubes', 'Power tubes'],
  ['tonestack', 'Tonestack'],
];

const backLink = () => `<a class="btn" href="${esc(carry('models.html'))}">Back to Models</a>`;

function section(title, body) {
  return body ? `<section class="glass panel"><h2>${title}</h2>${body}</section>` : '';
}

function pagesSentence(p) {
  return p.start === p.end ? `Page ${p.start} in the guide.` : `Pages ${p.start}–${p.end} in the guide.`;
}

function render({ model: m, conventions }, target) {
  document.title = `${m.name} · Tone Finder`;
  const specs = SPEC_ROWS.map(
    ([key, label]) =>
      `<tr><th scope="row">${label}</th><td>${m.specs[key] == null ? '<span class="none">Not in the guide</span>' : esc(m.specs[key])}</td></tr>`,
  ).join('');

  const settings = m.settings
    .map(
      (s) => `<li data-testid="setting">
        ${s.context ? `<div class="muted">${esc(s.context)}</div>` : ''}
        ${s.unit_name ? `<div class="muted">For ${esc(s.unit_name)}</div>` : ''}
        <div class="knob-chips">${Object.entries(s.knobs)
          .map(([k, v]) => `<span class="pill pill-guide">${esc(k)} ${esc(v)}</span>`)
          .join('')}</div>
        ${quoteHtml(s)}
        ${s.other.length ? `<div class="small muted">Also in this list: ${s.other.map(esc).join(' · ')}</div>` : ''}
      </li>`,
    )
    .join('');

  const directions = m.directions
    .map((d) => `<li>${esc(d.knob)} ${d.dir === 'up' ? 'up' : 'down'}: ${quoteHtml(d, 'span')}</li>`)
    .join('');

  const mvRule = m.facets.master_volume === 'no' ? conventions.find((c) => c.id === 'no-master-volume') : null;

  root.innerHTML = `
    <p>${backLink()}</p>
    <h1 class="unit-name" data-testid="model-name">${esc(m.name)}</h1>
    <p class="section-line">Section: ${esc(m.section)}${m.based_on ? ` · based on ${esc(m.based_on)}` : ''}</p>
    <p data-testid="model-pages">${pagesSentence(m.pages)}</p>
    ${
      target
        ? `<p class="glass panel">This section only points to another one. <a class="btn" href="${esc(carry(`model.html?id=${encodeURIComponent(target.id)}`))}">See ${esc(target.name)}</a></p>`
        : ''
    }
    <div class="stack">
      ${section(
        'Unit names',
        m.unit_names.length
          ? `<ul class="detail-list">${m.unit_names.map((u) => `<li>${esc(u.name)} ${pagePill(u.page)}</li>`).join('')}</ul>`
          : '<p class="muted">The guide doesn\'t name this model\'s unit types.</p>',
      )}
      <section class="glass panel">
        <h2>Specs</h2>
        <div class="spec-wrap"><table class="spec-table" data-testid="spec-table"><tbody>${specs}</tbody></table></div>
        <p class="small muted">Values as written in the guide's spec table ${pagePill(m.pages.start)}</p>
      </section>
      ${section('Synopsis', m.synopsis ? quoteHtml(m.synopsis) : '')}
      ${section('Controls', m.controls ? quoteHtml(m.controls) : '')}
      ${section('Tips', m.tips.length ? `<ul class="detail-list">${m.tips.map((t) => `<li>${quoteHtml(t, 'div')}</li>`).join('')}</ul>` : '')}
      ${section('Settings', settings ? `<ul class="detail-list">${settings}</ul>` : '')}
      ${section('Directions', directions ? `<ul class="detail-list">${directions}</ul>` : '')}
      ${section('Master volume', mvRule ? quoteHtml(mvRule) : '')}
      ${(() => {
        const cab = cabHtml(m.cab);
        return cab ? `<section class="glass panel">${cab.replace('<h3>Cab</h3>', '<h2>Cab</h2>')}</section>` : '';
      })()}
      ${section('Notes', m.notes.length ? `<ul class="detail-list">${m.notes.map((n) => `<li>${quoteHtml(n, 'div')}</li>`).join('')}</ul>` : '')}
    </div>`;
}

(async () => {
  try {
    if (!id) throw Object.assign(new Error('No model with that id.'), { status: 404 });
    const res = await getModel(id);
    let target = null;
    if (res.model.refers_to) {
      try {
        target = (await getModel(res.model.refers_to)).model;
      } catch {
        target = { id: res.model.refers_to, name: res.model.refers_to };
      }
    }
    render(res, target);
  } catch (e) {
    if (e.status === 404) {
      document.title = 'No model · Tone Finder';
      root.innerHTML = `<h1 data-testid="no-model">No model with that id.</h1><p>${backLink()}</p>`;
    } else {
      root.innerHTML = `<p class="error">${esc(e.message)}</p><p>${backLink()}</p>`;
    }
  } finally {
    root.removeAttribute('aria-busy');
  }
})();
