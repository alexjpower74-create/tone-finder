// Node-side access to the mock fixtures for the data tests (no browser).
import { readFileSync } from 'node:fs';

export const readFixture = (name) => JSON.parse(readFileSync(new URL(`../mock/${name}`, import.meta.url), 'utf8'));

// Every {quote, page} object anywhere in a value, with its JSON path.
export function quotesIn(value, path = '$', out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => quotesIn(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    if (typeof value.quote === 'string') out.push({ quote: value.quote, page: value.page ?? null, path });
    for (const [k, v] of Object.entries(value)) quotesIn(v, `${path}.${k}`, out);
  }
  return out;
}

// Run node-only tests once, not once per browser project.
export const ONCE = 'chromium-1280';
