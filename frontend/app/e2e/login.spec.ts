import { expect, test } from '@playwright/test'
import { API, trackErrors } from './helpers'

test('signed-out visitors land on the sign-in form and cannot open app pages', async ({ page }) => {
  await page.goto('/')
  await page.waitForURL('**/login')
  await expect(page.getByRole('heading', { name: /sign in to neurotutor/i })).toBeVisible()
  for (const path of ['/dashboard', '/analytics', '/settings']) {
    await page.goto(path)
    await page.waitForURL('**/login')
  }
})

test('wrong credentials are rejected with a clear message', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill('admin')
  await page.getByLabel('Password', { exact: true }).fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText(/incorrect username or password/i)
  await expect(page).toHaveURL(/\/login/)
})

test('the built-in administrator signs in with the form, stays signed in on reload, and signs out', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/login')
  await page.getByLabel('Username').fill('admin')
  await page.getByLabel('Password', { exact: true }).fill('admin123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/(placement|dashboard)/)
  expect((await page.context().cookies()).find((c) => c.name === 'nt_session')?.httpOnly).toBe(true)

  await page.reload()
  await expect(page).toHaveURL(/\/(placement|dashboard)/)
  expect((await page.request.get(`${API}/auth/me`)).status()).toBe(200)

  await page.goto('/settings')
  await page.getByRole('button', { name: /sign out/i }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /sign out/i }).click()
  await page.waitForURL('**/login')
  expect((await page.request.get(`${API}/auth/me`)).status()).toBe(401)
  await page.goto('/dashboard')
  await page.waitForURL('**/login')
  expect(errors.filter((e) => !/401|403/.test(e)), errors.join('\n')).toEqual([])
})
