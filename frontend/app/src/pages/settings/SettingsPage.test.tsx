import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '@/constants/storage'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/utils'
import { SettingsPage } from './SettingsPage'

const B = 'http://localhost:8000/students/sam'

function setup() {
  localStorage.setItem(STORAGE_KEYS.currentStudent, 'sam')
  server.use(
    http.get(`${B}/status`, () => HttpResponse.json({ student_id: 'sam', exists: true, placement_completed: true, placement_completed_at: '2026-01-02T10:00:00Z', has_active_session: false, session: null, counts: { interactions: 9, answered_questions: 7 }, created_at: '2026-01-02T09:00:00Z', last_active_at: '2026-01-02T10:00:00Z' })),
    http.get(`${B}/summary`, () => HttpResponse.json({ answered_questions: 7, correct_answers: 5, accuracy: 5 / 7, practice_questions: 0, videos_viewed: 1, deep_dives_read: 0, concepts_attempted: 7, concepts_total: 25, answering_time_seconds: 95, active_days: 2, current_streak_days: 1, longest_streak_days: 2, first_activity_at: null, last_activity_at: null })),
  )
  renderWithProviders(<Routes><Route path="/settings" element={<SettingsPage />} /><Route path="/start" element={<p>start page</p>} /></Routes>, { route: '/settings' })
}

describe('SettingsPage', () => {
  it('shows the real profile and totals from the backend', async () => {
    setup()
    expect(await screen.findByText('sam')).toBeInTheDocument()
    expect(await screen.findByText('7 of 25')).toBeInTheDocument()
    expect(screen.getByText('71%')).toBeInTheDocument()
  })

  it('persists the theme and reduced-motion preferences', async () => {
    setup()
    await userEvent.click(await screen.findByRole('tab', { name: 'Preferences' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    await userEvent.click(screen.getByRole('switch', { name: 'Reduce motion' }))
    expect(localStorage.getItem(STORAGE_KEYS.reduceMotion)).toBe('true')
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true)
    await userEvent.click(screen.getByRole('switch', { name: 'Keyboard shortcuts' }))
    expect(localStorage.getItem(STORAGE_KEYS.shortcuts)).toBe('false')
  })

  it('switching student asks first, then forgets the id on this device', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: /switch student/i }))
    const dialog = await screen.findByRole('dialog')
    expect(localStorage.getItem(STORAGE_KEYS.currentStudent)).toBe('sam') // not yet
    await userEvent.click(within(dialog).getByRole('button', { name: /switch student/i }))
    await waitFor(() => expect(screen.getByText('start page')).toBeInTheDocument())
    expect(localStorage.getItem(STORAGE_KEYS.currentStudent)).toBeNull()
  })
})
