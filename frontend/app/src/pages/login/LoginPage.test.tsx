import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/utils'
import { LoginPage } from './LoginPage'

const B = 'http://localhost:8000'
const user = { id: 'a1', email: 'admin', name: 'Administrator', student_id: 'admin', created_at: '2026-01-01 00:00:00', last_login_at: null }
const status = (placed: boolean) => ({ student_id: 'admin', exists: true, placement_completed: placed, placement_completed_at: null, has_active_session: false, session: null, counts: { interactions: 0, answered_questions: 0 }, created_at: null, last_active_at: null })

function setup() {
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/placement" element={<p>placement page</p>} />
      <Route path="/dashboard" element={<p>dashboard page</p>} />
    </Routes>,
    { route: '/login' },
  )
}

describe('LoginPage', () => {
  it('validates, then signs in and routes by the server record', async () => {
    let body: unknown
    server.use(
      http.post(`${B}/auth/login`, async ({ request }) => { body = await request.json(); return HttpResponse.json(user) }),
      http.get(`${B}/students/admin/status`, () => HttpResponse.json(status(true))),
    )
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/enter your username and password/i)
    await userEvent.type(screen.getByLabelText('Username'), 'admin')
    await userEvent.type(screen.getByLabelText('Password'), 'admin123')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByText('dashboard page')).toBeInTheDocument())
    expect(body).toEqual({ username: 'admin', password: 'admin123', remember: false })
  })

  it('shows the server message on wrong credentials and never navigates', async () => {
    server.use(http.post(`${B}/auth/login`, () => HttpResponse.json({ detail: 'Incorrect username or password.' }, { status: 401 })))
    setup()
    await userEvent.type(await screen.findByLabelText('Username'), 'admin')
    await userEvent.type(screen.getByLabelText('Password'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.')
    expect(screen.queryByText('dashboard page')).not.toBeInTheDocument()
  })

  it('toggles password visibility', async () => {
    setup()
    const input = await screen.findByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')
  })
})
