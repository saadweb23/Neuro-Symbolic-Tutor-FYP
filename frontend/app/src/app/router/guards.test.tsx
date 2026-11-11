import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderWithProviders, signInAs } from '@/test/utils'
import { RequirePlacement, RequireStudent } from './guards'

const status = (placement_completed: boolean) => ({
  student_id: 'sam', exists: placement_completed, placement_completed, placement_completed_at: null,
  has_active_session: false, session: null, counts: { interactions: 0, answered_questions: 0 },
  created_at: null, last_active_at: null,
})

function tree() {
  return (
    <Routes>
      <Route path="/login" element={<p>login page</p>} />
      <Route path="/placement" element={<p>placement page</p>} />
      <Route element={<RequireStudent />}>
        <Route element={<RequirePlacement />}>
          <Route path="/dashboard" element={<p>dashboard page</p>} />
        </Route>
      </Route>
    </Routes>
  )
}

describe('route guards', () => {
  it('sends a signed-out visitor to the sign-in page', async () => {
    renderWithProviders(tree(), { route: '/dashboard' })
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })

  it('sends a student without placement to the placement quiz (decided by the server)', async () => {
    signInAs('sam')
    server.use(http.get('http://localhost:8000/students/sam/status', () => HttpResponse.json(status(false))))
    renderWithProviders(tree(), { route: '/dashboard' })
    expect(await screen.findByText('placement page')).toBeInTheDocument()
  })

  it('lets a placed student through', async () => {
    signInAs('sam')
    server.use(http.get('http://localhost:8000/students/sam/status', () => HttpResponse.json(status(true))))
    renderWithProviders(tree(), { route: '/dashboard' })
    await waitFor(() => expect(screen.getByText('dashboard page')).toBeInTheDocument())
  })

  it('shows a retryable error when the status check fails', async () => {
    signInAs('sam')
    server.use(http.get('http://localhost:8000/students/sam/status', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })))
    renderWithProviders(tree(), { route: '/dashboard' })
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
  })
})
