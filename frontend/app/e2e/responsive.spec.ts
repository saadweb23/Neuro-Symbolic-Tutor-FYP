import { expect, test } from '@playwright/test'
import { placeStudent, uniqueId } from './helpers'

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1100 },
  { name: 'desktop', width: 1366, height: 900 },
]
const PAGES = ['/dashboard', '/learn', '/mastery', '/mastery?view=graph', '/mastery?view=list', '/analytics', '/history', '/resources', '/settings', '/help']

test('no page scrolls sideways and navigation adapts at phone, tablet and desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await placeStudent(page, uniqueId('resp'))
  const overflow: string[] = []
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    for (const path of PAGES) {
      await page.goto(path)
      await page.waitForSelector('main')
      await page.waitForTimeout(500)
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      if (over > 1) overflow.push(`${vp.name} ${path}: ${over}px`)
    }
    await page.goto('/dashboard')
    await page.waitForSelector('main')
    const tabBar = page.getByRole('navigation', { name: 'Primary' })
    const sidebar = page.getByRole('complementary', { name: 'Main navigation' })
    if (vp.name === 'phone') {
      await expect(tabBar).toBeVisible()
      await expect(sidebar).toBeHidden()
    } else {
      await expect(tabBar).toBeHidden()
      await expect(sidebar).toBeVisible()
    }
  }
  expect(overflow).toEqual([])
})

test('the sidebar collapses to an icon rail and remembers it', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await placeStudent(page, uniqueId('rail'))
  await page.goto('/dashboard')
  await page.getByRole('button', { name: /collapse sidebar/i }).click()
  await expect(page.getByRole('button', { name: /expand sidebar/i })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: /expand sidebar/i })).toBeVisible()
})
