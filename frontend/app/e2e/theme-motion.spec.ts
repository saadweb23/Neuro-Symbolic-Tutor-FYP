import { expect, test } from '@playwright/test'

test('dark theme is applied before first paint and persists', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /change theme/i }).click()
  await page.getByRole('menuitem', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload({ waitUntil: 'commit' })
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'), undefined, { timeout: 3000 })
  // the inline <style> in index.html paints the dark background before any bundle loads
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(11, 16, 32)')
})

test('the loading mark does not animate when the OS asks for reduced motion', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('/')
  await page.getByRole('heading', { level: 1 }).waitFor()
  const names = await page.evaluate(() => [...document.querySelectorAll('.nt-node')].map((e) => getComputedStyle(e).animationName))
  expect(names.length).toBeGreaterThan(0)
  expect(names.every((n) => n === 'none')).toBe(true)
  await ctx.close()
})

test('the mark pulses by default while the app is booting', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const node = page.locator('.nt-mark[data-motion="pulse"] .nt-node').first()
  await node.waitFor({ state: 'attached' })
  await expect.poll(() => node.evaluate((el) => getComputedStyle(el).animationName)).toBe('nt-node-pulse')
})

test('the full boot screen shows once per tab session, and the skip link works', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('heading', { level: 1 }).waitFor()
  expect(await page.evaluate(() => sessionStorage.getItem('nt_booted'))).toBe('1')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: /skip to content/i })).toBeFocused()
})

test('unknown routes show the useful 404 page', async ({ page }) => {
  await page.goto('/definitely/not/a/page')
  await expect(page.getByRole('heading', { name: /doesn.t exist/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /back to home/i })).toBeVisible()
})
