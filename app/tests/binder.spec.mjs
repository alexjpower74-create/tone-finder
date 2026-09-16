import { expect, test } from '@playwright/test'
import { quotesIn, readFixture } from './fixtures.mjs'
import { expectQuotesExact, press, tapExample } from './helpers.mjs'

async function addBritBrown(page, ti) {
  await page.goto('/index.html?mock=1')
  await tapExample(page, ti, 'Van Halen brown sound')
  const card = page.locator('[data-testid="suggestion"][data-model-id="brit-brown-and-fas-brown"]')
  const btn = card.getByRole('button', { name: 'Add to binder' })
  await press(btn, ti)
  await expect(card.getByRole('button', { name: 'In binder' })).toHaveAttribute('aria-pressed', 'true')
}

test('a pick added on Ask is listed in the binder after a reload, and remove works', async ({ page }, ti) => {
  await addBritBrown(page, ti)
  await press(page.getByRole('navigation').getByRole('link', { name: 'Binder' }), ti)
  await expect(page).toHaveURL(/binder\.html\?mock=1/)

  await page.reload()
  const pick = page.getByTestId('pick')
  await expect(pick).toHaveCount(1)
  await expect(pick.locator('.unit-name')).toHaveText('Brit Brown')
  await expect(pick).toContainText('For “Van Halen brown sound”')
  await expect(pick.locator('tbody tr')).toHaveCount(7)

  await press(pick.getByRole('button', { name: 'Remove' }), ti)
  await expect(page.getByTestId('pick')).toHaveCount(0)
  await expect(page.getByTestId('binder-empty')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('binder-empty')).toBeVisible()
})

test('print view: white ground, no nav', async ({ page }, ti) => {
  await addBritBrown(page, ti)
  await press(page.getByRole('navigation').getByRole('link', { name: 'Binder' }), ti)
  await expect(page.getByTestId('pick')).toHaveCount(1)

  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const edge = () =>
    page
      .getByTestId('quote')
      .first()
      .evaluate((el) => getComputedStyle(el).borderLeftColor)
  const allowed = new Set(quotesIn(readFixture('answers.json')).map((q) => q.quote))
  expect(await bg(), 'screen ground should be dark').not.toBe('rgb(255, 255, 255)')
  await expect(page.getByRole('navigation')).toBeVisible()
  await expectQuotesExact(page, allowed)
  expect(await edge()).toBe('rgb(62, 224, 197)')

  await page.emulateMedia({ media: 'print' })
  expect(await bg()).toBe('rgb(255, 255, 255)')
  await expect(page.getByRole('navigation')).toBeHidden()
  await expectQuotesExact(page, allowed)
  expect(await edge(), 'print quotes get a thin black rule, not teal').toBe('rgb(0, 0, 0)')
  await expect(page.getByTestId('pick')).toBeVisible()
  await expect(page.locator('.print-footer')).toHaveText(
    "From yek's guide to the Fractal Audio amp models (rev. April 2017). Guesses are not from the guide.",
  )
})
