import { expect, test } from '@playwright/test'
import { API, placeStudent, session, trackErrors, trackNext, uniqueId } from './helpers'

test('dashboard, analytics and every read-only page never call /next or change the session', async ({ page, request }) => {
  const id = uniqueId('readonly')
  await placeStudent(page, id)
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

test('unknown ids see empty data, never an error, and are not created by reading', async ({ request }) => {
  const id = uniqueId('ghost')
  for (const p of ['status', 'summary', 'history', 'mastery/trajectory', 'analytics', 'concepts', 'resources', 'recommendation']) {
    expect((await request.get(`${API}/students/${id}/${p}`)).status(), p).toBe(200)
  }
  expect((await (await request.get(`${API}/students/${id}/status`)).json()).exists).toBe(false)
})
