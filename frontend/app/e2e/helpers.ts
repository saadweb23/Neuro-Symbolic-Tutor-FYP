import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const API = 'http://localhost:8000'
export const uniqueId = (tag: string) => `e2e_${tag}_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

/** Counts GET /next requests made by a page: /next consumes a learning round, so it must only
 *  ever be called from the Learning Workspace. */
export function trackNext(page: Page) {
  const calls: string[] = []
  page.on('request', (r) => {
    if (/\/students\/[^/]+\/next$/.test(new URL(r.url()).pathname)) calls.push(r.url())
  })
  return calls
}

export function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`))
  return errors
}

/** Creates an account through the API (the e2e backend enables sign-up), which signs this browser in,
 *  then completes the real 7-question placement quiz through the UI. Returns the student id; use
 *  `page.request` for further API calls, since it shares the browser's session cookie. */
export async function placeStudent(page: Page, label: string): Promise<string> {
  const res = await page.request.post(`${API}/auth/signup`, { data: { name: label, email: `${label}@example.com`, password: 'e2e-password-1' } })
  expect(res.status(), await res.text()).toBe(201)
  const studentId = ((await res.json()) as { student_id: string }).student_id
  await page.goto('/placement')
  await page.waitForURL('**/placement')
  await expect(page.getByText('Question 1 of 7')).toBeVisible()
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press(String((i % 3) + 1))
    await page.keyboard.press('Enter')
  }
  await page.waitForURL('**/placement/results')
  await expect(page.getByRole('heading', { name: /your starting point/i })).toBeVisible()
  return studentId
}

export const session = async (request: APIRequestContext, id: string) =>
  (await request.get(`${API}/students/${encodeURIComponent(id)}/session`)).json() as Promise<{ active: boolean; round_count?: number; block_index?: number }>

/** Keep going until a practice question is on screen (videos / docs are marked done on the way). */
export async function advanceToPractice(page: Page) {
  for (let i = 0; i < 12; i++) {
    if (await page.getByRole('radiogroup').count()) return
    const done = page.getByRole('button', { name: /mark (watched|read)/i })
    if (await done.count()) {
      await done.click()
      await expect(page.getByText(/mastery estimate/i)).toBeVisible()
    }
    await page.getByRole('button', { name: /^continue$/i }).click()
    await page.waitForTimeout(500)
  }
  throw new Error('no practice question appeared')
}
