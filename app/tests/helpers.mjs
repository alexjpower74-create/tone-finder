// Shared test helpers. State changes go through real input only (tap on touch projects, click on desktop,
// keyboard typing). page.evaluate is used to read the DOM, never to change app state.
import { expect } from '@playwright/test';

export const GUESS_NOTE = 'starting guess — not from the guide';
export const NO_SUPPORT = "I can't point to the guide for that.";
export const GK_LABEL = 'General knowledge (AI) — not from the guide';
export const PAGE_PILL = /^p\. \d+$/;

export const isTouch = (testInfo) => Boolean(testInfo.project.use.hasTouch);

export async function press(locator, testInfo) {
  await locator.scrollIntoViewIfNeeded();
  if (isTouch(testInfo)) await locator.tap();
  else await locator.click();
}

export async function typeQuery(page, testInfo, text) {
  const input = page.getByLabel('What tone are you after?');
  await press(input, testInfo);
  // Clear whatever a chip or an earlier query left in the box, with keys like a person would.
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await expect(input).toHaveValue('');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

export async function tapExample(page, testInfo, text) {
  await press(page.getByRole('button', { name: text, exact: true }), testInfo);
}

// Everything you can tap (buttons, links, chips, filter pills, switches, summary, form fields): at least 44 × 44,
// and elementFromPoint at its centre, after scrolling it into view, is the element or inside it (API.md §8).
// A switch's tap target is its label; the checkbox inside it is not measured on its own.
const TAPPABLE = 'button, a[href], .chip, summary, label.switch, select, input:not([type="checkbox"]):not([type="hidden"])';
const STATIC_TAGS = '.pill, .unit-pill, .demo-pill';

export async function tapTargetFailures(page) {
  return page.evaluate((sel) => {
    const failures = [];
    const els = [...document.querySelectorAll(sel)].filter((el) => {
      const cs = getComputedStyle(el);
      return el.getClientRects().length && cs.visibility !== 'hidden' && !el.closest('details:not([open]) > :not(summary)');
    });
    for (const el of els) {
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      const label = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 40)}"`;
      if (r.width < 44 || r.height < 44) failures.push(`${label}: ${r.width.toFixed(1)}×${r.height.toFixed(1)}`);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || !(hit === el || el.contains(hit))) {
        failures.push(`${label}: centre hits ${hit ? hit.tagName.toLowerCase() + '.' + [...hit.classList].join('.') : 'nothing'}`);
      }
    }
    window.scrollTo(0, 0);
    return { checked: els.length, failures };
  }, TAPPABLE);
}

export async function expectTapTargets(page) {
  const { checked, failures } = await tapTargetFailures(page);
  expect(checked, 'tap-target check found nothing to measure').toBeGreaterThan(0);
  expect(failures).toEqual([]);
}

// Static tags aren't tappable but must stay readable: at least 24 px tall.
export async function expectStaticTags(page) {
  const { checked, failures } = await page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)].filter((el) => el.getClientRects().length);
    const failures = els
      .map((el) => [el, el.getBoundingClientRect().height])
      .filter(([, h]) => h < 24)
      .map(([el, h]) => `${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 30)}": ${h.toFixed(1)} px tall`);
    return { checked: els.length, failures };
  }, STATIC_TAGS);
  expect(checked, 'static-tag check found nothing to measure').toBeGreaterThan(0);
  expect(failures).toEqual([]);
}

// Every rendered quote (why, tips, notes, settings, cab, nudges, taper note, Ares flag and source quotes) is a
// blockquote whose text is exactly one of the verified quotes in `allowed`: no <q>, no CSS-added marks, and a left
// edge. Exact equality means no text starts or ends with a mark the verified quote doesn't have.
export async function expectQuotesExact(page, allowed) {
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="quote"], [data-testid="flag-quote"], [data-testid="source-quote"]')].map((bq) => {
      const text = bq.querySelector('.quote-text');
      const pseudo = (el, which) => (el ? getComputedStyle(el, which).content : 'none');
      return {
        tag: bq.tagName.toLowerCase(),
        text: text ? text.textContent : null,
        marks: [pseudo(bq, '::before'), pseudo(bq, '::after'), pseudo(text, '::before'), pseudo(text, '::after')],
        qs: bq.querySelectorAll('q').length,
        edge: getComputedStyle(bq).borderLeftStyle,
      };
    }),
  );
  const problems = [];
  for (const r of rows) {
    if (r.tag !== 'blockquote') problems.push(`not a blockquote: ${r.text}`);
    if (r.text === null) {
      problems.push('quote without .quote-text');
      continue;
    }
    if (!allowed.has(r.text)) problems.push(`not exactly a verified quote: ${JSON.stringify(r.text)}`);
    if (r.qs) problems.push(`<q> inside: ${r.text.slice(0, 40)}`);
    if (r.marks.some((c) => c && c !== 'none' && c !== 'normal')) problems.push(`CSS-added marks ${JSON.stringify(r.marks)}: ${r.text.slice(0, 40)}`);
    if (r.edge === 'none') problems.push(`no left edge: ${r.text.slice(0, 40)}`);
  }
  expect(rows.length, 'no quotes rendered').toBeGreaterThan(0);
  expect(problems).toEqual([]);
  return rows.length;
}

export async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(0);
}

export async function waitForAnswer(page) {
  await expect(page.locator('[data-testid="suggestion"], [data-testid="no-support"]').first()).toBeVisible();
}
