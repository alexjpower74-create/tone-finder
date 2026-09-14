// SVG knob dials, 0–10 over a 270° sweep. Solid teal ring = from the guide (or the guide's p. 12 rule);
// dashed amber ring = starting guess. The accessible name carries the value and, for guesses, the guess note.
import { esc, pagePill } from './shell.js';

export const GUESS_NOTE = 'starting guess — not from the guide';

const C = 38;
const R = 30;
const START = 135;
const SWEEP = 270;

const fmt = (v) => String(Number(v));

function point(deg, r = R) {
  const a = (deg * Math.PI) / 180;
  return [(C + r * Math.cos(a)).toFixed(2), (C + r * Math.sin(a)).toFixed(2)];
}

function arc(from, to) {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M ${x1} ${y1} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

export function dialLabel(k) {
  const v = fmt(k.value);
  if (k.kind === 'guess') return `${k.knob} ${v}, ${GUESS_NOTE}`;
  if (k.kind === 'guide_rule') return `${k.knob} ${v}, guide rule, page ${k.page}`;
  return `${k.knob} ${v}, from the guide, page ${k.page}`;
}

export function dialSvg(k) {
  const v = Math.max(0, Math.min(10, Number(k.value)));
  const kind = k.kind === 'guess' ? 'guess' : 'guide';
  const end = START + (SWEEP * v) / 10;
  const [px, py] = point(end, R - 11);
  return `<svg class="dial-svg" viewBox="0 0 76 76" role="img" aria-label="${esc(dialLabel(k))}">
    <path class="dial-track ${kind}" d="${arc(START, START + SWEEP)}" fill="none" stroke-width="6"/>
    ${v > 0 ? `<path class="dial-arc ${kind}" d="${arc(START, end)}" fill="none" stroke-width="6"/>` : ''}
    <line class="dial-pointer ${kind}" x1="${C}" y1="${C}" x2="${px}" y2="${py}" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

export function dialHtml(k) {
  const kind = k.kind === 'guess' ? 'guess' : 'guide';
  let source;
  if (k.kind === 'guide' || k.kind === 'guide_rule') source = pagePill(k.page);
  else source = '<span class="guess-word">guess</span>';
  return `<figure class="dial ${kind}" data-testid="dial" data-kind="${esc(k.kind)}" data-knob="${esc(k.knob)}">
    ${dialSvg(k)}
    <figcaption>
      <span class="dial-value" aria-hidden="true">${fmt(k.value)}</span>
      <span class="dial-knob" aria-hidden="true">${esc(k.knob)}</span>
      <span class="dial-source">${source}</span>
    </figcaption>
  </figure>`;
}

export const hasGuess = (knobs) => knobs.some((k) => k.kind === 'guess');

// Plain-text source for tables (binder print): "guide p. 28" / "rule p. 12" / "guess".
export function knobSource(k) {
  if (k.kind === 'guide') return `guide p. ${k.page}`;
  if (k.kind === 'guide_rule') return `rule p. ${k.page}`;
  return 'guess';
}
