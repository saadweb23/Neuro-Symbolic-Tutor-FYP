import { expect, test } from '@playwright/test'
import { API, placeStudent, session, trackErrors, trackNext, uniqueId } from './helpers'

test('dashboard, analytics and every read-only page never call /next or change the session', async ({ page }) => {
  const request = page.request
  const id = await placeStudent(page, uniqueId('readonly'))
  expect((await request.post(`${API}/students/${id}/session/start`, { data: { block_index: 1 } })).ok()).toBe(true)

  const errors = trackErrors(page)
  const nextCalls = trackNext(page)
  const mutations: string[] = []
  page.on('request', (r) => r.method() !== 'GET' && mutations.push(`${r.method()} ${r.url()}`))

  for (const path of ['/dashboard', '/learn', '/mastery', '/mastery?view=graph', '/analytics', '/history', '/resources', '/settings', '/help']) {
    await page.goto(path)
    await page.waitForSelector('main')
    await page.waitForTimeout(600)
  }
  expect(nextCalls).toHaveLength(0)
  expect(mutations).toEqual([])
  expect(await session(request, id)).toMatchObject({ active: true, block_index: 1, round_count: 0 })
  expect(errors, errors.join('\n')).toEqual([])
})

test('the API refuses signed-out and cross-account access, and reading never creates data', async ({ page, playwright }) => {
  const anon = await playwright.request.newContext()
  const id = await placeStudent(page, uniqueId('owner'))
  expect((await anon.get(`${API}/students/${id}/status`)).status()).toBe(401)
  const other = await playwright.request.newContext()
  expect((await other.post(`${API}/auth/signup`, { data: { name: 'Other', email: `${uniqueId('other')}@example.com`, password: 'e2e-password-1' } })).status()).toBe(201)
  expect((await other.get(`${API}/students/${id}/mastery`)).status()).toBe(403)
  expect((await page.request.get(`${API}/students/${id}/mastery`)).status()).toBe(200)
})
