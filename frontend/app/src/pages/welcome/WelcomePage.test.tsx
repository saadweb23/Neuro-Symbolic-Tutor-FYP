import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderWithProviders, signInAs } from '@/test/utils'
import { WelcomePage } from './WelcomePage'

// the title hook reads route handles, which need a data router; irrelevant here
vi.mock('@/hooks/useDocumentTitle', () => ({ useDocumentTitle: () => '' }))

const status = (placed: boolean) => ({ student_id: 'sam', exists: true, placement_completed: placed, placement_completed_at: null, has_active_session: false, session: null, counts: { interactions: 0, answered_questions: 0 }, created_at: null, last_active_at: null })

describe('WelcomePage', () => {
  it('introduces the platform and offers the placement quiz to a visitor', async () => {
    renderWithProviders(<WelcomePage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to Neuro Symbolic Tutor' })).toBeInTheDocument()
    expect(screen.getByText(/Your personalized AI-powered learning companion/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Take Placement Quiz' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('lets a student who has finished placement continue instead (the quiz cannot be retaken)', async () => {
    signInAs('sam')
    server.use(http.get('http://localhost:8000/students/sam/status', () => HttpResponse.json(status(true))))
    renderWithProviders(<WelcomePage />)
    expect(await screen.findByRole('button', { name: 'Continue Learning' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Take Placement Quiz' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
  })
})
