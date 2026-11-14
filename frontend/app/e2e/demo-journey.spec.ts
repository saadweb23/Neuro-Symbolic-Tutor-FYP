import { expect, test, type Page } from '@playwright/test'
import { API } from './helpers'

const answerQuestions = async (page: Page, from: number, to: number) => {
  for (let i = from; i < to; i++) {
    await expect(page.getByText(new RegExp(`Question\\s*${i + 1}\\s*of 7`))).toBeVisible()
    await page.keyboard.press(String((i % 3) + 1))
    await page.keyboard.press('Enter')
  }
}

const signIn = async (page: Page, name: string, password = 'admin123') => {
  await page.getByLabel('Username').fill(name)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('welcome -> sign in -> placement -> results -> personalised dashboard -> sign out -> sign in again', async ({ page }) => {
  const name = `Saad${Date.now().toString(36)}`
  const unexpected: string[] = []
  page.on('console', (m) => m.type() === 'error' && !/401|403/.test(m.text()) && unexpected.push(m.text()))
  page.on('pageerror', (e) => unexpected.push(`pageerror: ${e.message}`))

  // welcome -> Sign in
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to Neuro Symbolic Tutor')
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Sign in' }).click()
  await page.waitForURL('**/login')

  // a wrong password is refused and creates nothing
  await signIn(page, name, 'not-the-password')
  await expect(page.getByRole('alert')).toContainText(/incorrect username or password/i)

  // first-time sign in -> the placement quiz opens by itself
  await signIn(page, name)
  await page.waitForURL('**/placement')
  await expect(page.getByText('Question 1 of 7')).toBeVisible()

  // Previous keeps the earlier answer; a refresh resumes where the student was
  await page.keyboard.press('2')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Question 2 of 7')).toBeVisible()
  await page.getByRole('button', { name: 'Previous' }).click()
  await expect(page.getByText('Question 1 of 7')).toBeVisible()
  await expect(page.getByRole('radio', { name: /^2/ })).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Enter')
  await answerQuestions(page, 1, 3)
  await page.reload()
  await expect(page.getByText('Question 4 of 7')).toBeVisible()
  await answerQuestions(page, 3, 7)

  // results -> dashboard
  await page.waitForURL('**/placement/results')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`Placement complete, ${name}`)
  await page.getByRole('link', { name: 'Go to my dashboard' }).click()
  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('heading', { name: `Welcome back, ${name}!` })).toBeVisible()
  await expect(page.getByText(/Your learning journey continues/)).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Main navigation' }).getByText(name)).toBeVisible()

  // refresh keeps the session, the name and the finished placement
  await page.reload()
  await expect(page.getByRole('heading', { name: `Welcome back, ${name}!` })).toBeVisible()

  // sign out: clean redirect, no error screen, protected pages closed
  await page.getByRole('button', { name: /student menu/i }).click()
  await page.getByRole('menuitem', { name: /sign out/i }).click()
  await page.waitForURL('**/login')
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
  expect((await page.request.get(`${API}/auth/me`)).status()).toBe(401)
  for (const path of ['/dashboard', '/analytics', '/learn', '/placement']) {
    await page.goto(path)
    await page.waitForURL('**/login')
    await expect(page.getByText('Something went wrong')).toHaveCount(0)
  }

  // returning student: straight to the dashboard, same name, no second quiz
  await signIn(page, name)
  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('heading', { name: `Welcome back, ${name}!` })).toBeVisible()

  expect(unexpected, unexpected.join('\n')).toEqual([])
})
