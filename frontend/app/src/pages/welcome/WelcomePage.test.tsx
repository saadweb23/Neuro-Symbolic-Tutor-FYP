import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    expect(await screen.findByRole('heading', { level: 1, name: /Neuro Symbolic Tutor: a neuro-symbolic adaptive learning platform/i })).toBeInTheDocument()
    expect(screen.getByText(/Discover your strengths, identify knowledge gaps/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Take Placement Quiz' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /sign in/i }).length).toBeGreaterThan(0)
    expect(screen.getByText(/25 Python concepts/)).toBeInTheDocument()   // real figures from the platform settings, no invented numbers
  })

  it('lets a student who has finished placement continue instead (the quiz cannot be retaken)', async () => {
    signInAs('sam')
    server.use(http.get('http://localhost:8000/students/sam/status', () => HttpResponse.json(status(true))))
    renderWithProviders(<WelcomePage />)
    expect(await screen.findByRole('button', { name: 'Continue Learning' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Take Placement Quiz' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('Watch Demo opens an explanation of the learning loop built from the platform settings', async () => {
    renderWithProviders(<WelcomePage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Watch Demo' }))
    const dialog = await screen.findByRole('dialog', { name: 'How Neuro Symbolic Tutor works' })
    expect(dialog).toHaveTextContent('Take the placement quiz')
    expect(dialog).toHaveTextContent('Watch your progress grow')
  })

  it('switches between the three themes, keeps the layout, and remembers the choice', async () => {
    const { container, unmount } = renderWithProviders(<WelcomePage />)
    const root = () => container.querySelector('.nt-welcome-root')!
    expect(root()).toHaveClass('nt-theme-neon')
    await userEvent.click(screen.getByRole('radio', { name: 'Premium Education' }))
    expect(root()).toHaveClass('nt-theme-education')
    await userEvent.click(screen.getByRole('radio', { name: 'Modern Minimal' }))
    expect(root()).toHaveClass('nt-theme-minimal', 'nt-light')
    expect(screen.getByRole('radio', { name: 'Modern Minimal' })).toHaveAttribute('aria-checked', 'true')
    expect(localStorage.getItem('neurotutor_welcome_theme')).toBe('minimal')
    // the same content is on the page in every theme: only colours change
    expect(screen.getByRole('button', { name: 'Take Placement Quiz' })).toBeInTheDocument()
    unmount()
    const again = renderWithProviders(<WelcomePage />)
    expect(again.container.querySelector('.nt-welcome-root')).toHaveClass('nt-theme-minimal')   // restored after a "refresh"
  })

  it('uses the Neuro Symbolic Tutor name everywhere and never the old one', () => {
    const { container } = renderWithProviders(<WelcomePage />)
    expect(container.textContent).not.toMatch(/NeuroTutor/)
    expect(container.textContent).toMatch(/Welcome to\s*Neuro Symbolic Tutor/)
    expect(screen.getByRole('link', { name: 'Neuro Symbolic Tutor home' })).toBeInTheDocument()
  })

  it('keeps the first headline line fixed while only the second line is animated', () => {
    const { container } = renderWithProviders(<WelcomePage />)
    const h1 = container.querySelector('h1')!
    const blocks = h1.querySelectorAll(':scope > [aria-hidden]')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]!.textContent).toBe('Welcome to Neuro Symbolic Tutor')   // static
    expect(blocks[1]!.querySelector('.nt-caret')).not.toBeNull()            // the typed line owns the caret
  })
})
