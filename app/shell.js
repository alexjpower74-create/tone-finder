// Shared header and footer for every page (docs/API.md §8).
import { MOCK, carry } from './api.js';

const NAV = [
  ['index.html', 'Ask'],
  ['models.html', 'Models'],
  ['binder.html', 'Binder'],
];

export function currentPage() {
  // Static-assets hosting serves 'models.html' at '/models'; treat both spellings as the same page.
  let file = location.pathname.split('/').pop() || 'index.html';
  if (!file.includes('.')) file += '.html';
  return file === 'model.html' ? 'models.html' : file;
}

export function renderShell() {
  const header = document.getElementById('site-header');
  if (header) {
    const here = currentPage();
    header.innerHTML = `
      <div class="bar">
        <a class="wordmark" href="${carry('index.html')}">Tone Finder</a>
        <span class="unit-pill">Axe-Fx II XL+ · Ares</span>
        ${MOCK ? '<span class="demo-pill" data-testid="demo-pill">Demo data</span>' : ''}
      </div>
      <nav class="nav" aria-label="Main">
        ${NAV.map(
          ([href, label]) =>
            `<a class="nav-link" href="${carry(href)}"${href === here ? ' aria-current="page"' : ''}>${label}</a>`,
        ).join('')}
      </nav>`;
  }
  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.innerHTML = `<p>Every quote is checked against yek's guide (rev. April 2017, written for Quantum 7.02). Page numbers are PDF pages.</p>`;
  }
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const pagePill = (page) => `<span class="pill pill-page">p. ${Number(page)}</span>`;

export function pageRange(pages) {
  return pages.start === pages.end ? `p. ${pages.start}` : `pp. ${pages.start}–${pages.end}`;
}
