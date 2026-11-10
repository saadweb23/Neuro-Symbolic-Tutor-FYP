import { expect, test } from '@playwright/test'
import { advanceToPractice, API, placeStudent, session, trackErrors, trackNext, uniqueId } from './helpers'

test('a new student: landing -> placement -> learning session -> progress pages', async ({ page, request }) => {
  const id = uniqueId('journey')
  const errors = trackErrors(page)
  const nextCalls = trackNext(page)

  // landing + onboarding
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/why you.re stuck/i)
  await page.getByRole('banner').getByRole('link', { name: /start learning/i }).click()
  await page.waitForURL('**/start')

  // placement (real quiz through the UI)
  await placeStudent(page, id)
  const status = await (await request.get(`${API}/students/${id}/status`)).json()
  expect(status).toMatchObject({ exists: true, placement_completed: true, has_active_session: false })

  // a second placement is refused by the backend
  expect((await request.post(`${API}/students/${id}/placement/start`)).status()).toBe(409)

  // choose a focus area -> workspace
  await page.getByRole('link', { name: /choose a focus area/i }).click()
  await page.waitForURL('**/learn')
  await page.getByRole('button', { name: /(start|continue) learning/i }).first().click() // placement counts as progress, so blocks may say "Continue"
  await page.waitForURL('**/learn/session')
  await expect(page.getByText('Why this?')).toBeVisible()
  expect(nextCalls).toHaveLength(1) // exactly one round, even though dev builds run React StrictMode
  expect((await session(request, id)).round_count).toBe(1)

  // reloading restores the step and must not consume a round
  await page.reload()
  await expect(page.getByText('Why this?')).toBeVisible()
  expect((await session(request, id)).round_count).toBe(1)

  // answer a practice question and read the feedback
  await advanceToPractice(page)
  await page.keyboard.press('2')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Answer feedback' })).toBeVisible()
  await expect(page.getByText(/(Correct|Not quite)/).first()).toBeVisible()

  // every /next call = exactly one round on the server
  const s = await session(request, id)
  expect(s.round_count).toBe(nextCalls.length + 1) // +1: the first /next happened before the reload (counted by the earlier page load)

  // the answer is stored with the chosen option
  const history = await (await request.get(`${API}/students/${id}/history?type=practice`)).json()
  expect(history.items[0].selected_index).toBe(1)
  expect(history.items[0].question_text).toBeTruthy()

  // leave, then the read-only pages must not consume rounds
  await page.getByRole('button', { name: /leave session/i }).click()
  await page.getByRole('dialog').getByRole('button', { name: /leave session/i }).click()
  await page.waitForURL('**/dashboard')
  const before = (await session(request, id)).round_count
  const callsBefore = nextCalls.length
  await expect(page.getByText(/questions answered/i).first()).toBeVisible()
  for (const path of ['/mastery', '/analytics', '/history', '/resources', '/learn', '/settings', '/dashboard']) {
    await page.goto(path)
    await page.waitForSelector('main')
    await page.waitForTimeout(500)
  }
  expect(nextCalls.length).toBe(callsBefore)
  expect((await session(request, id)).round_count).toBe(before)

  expect(errors, errors.join('\n')).toEqual([])
})
