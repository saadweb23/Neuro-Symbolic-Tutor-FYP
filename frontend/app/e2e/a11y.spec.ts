import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { placeStudent, uniqueId } from './helpers'

/** Serious / critical axe violations fail the build, in light and dark. */
const found: string[] = []
async function scan(page: Page, label: string) {
  await page.waitForSelector('main')
  await page.waitForTimeout(1000)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  for (const v of results.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
    found.push(`${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
  }
}

for (const scheme of ['light', 'dark'] as const) {
  test(`no serious accessibility violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    await page.getByRole('heading', { level: 1 }).waitFor()
    await scan(page, `welcome/${scheme}`)
    await page.goto('/about')
    await page.getByRole('heading', { level: 1 }).waitFor()
    await scan(page, `landing/${scheme}`)
    await page.goto('/login')
    await scan(page, `login/${scheme}`)
    await page.goto('/help')
    await scan(page, `help-public/${scheme}`)

    await placeStudent(page, uniqueId(`a11y${scheme}`))
    await scan(page, `results/${scheme}`)
    for (const path of ['/dashboard', '/learn', '/mastery', '/mastery?view=graph', '/mastery?view=list', '/analytics', '/history', '/resources', '/settings', '/help']) {
      await page.goto(path)
      await scan(page, `${path}/${scheme}`)
    }
    expect(found.splice(0), 'axe violations (all pages)').toEqual([]) // report every page at once
  })
}
