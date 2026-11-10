import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '@/constants/storage'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/utils'
import { AnalyticsPage } from './AnalyticsPage'

const B = 'http://localhost:8000/students/sam'
const empty = {
  model_version: '1', window: { days: null, accuracy_window: 5 }, activity: [], blocks: [], concepts: [],
  content_mix: { practice: 0, placement: 0, video: 0, deep_dive: 0 },
  difficulty: { placement: { answered: 0, correct: 0 }, easy: { answered: 0, correct: 0 }, medium: { answered: 0, correct: 0 }, hard: { answered: 0, correct: 0 } },
  accuracy_trend: [],
}

describe('AnalyticsPage', () => {
  it('says so instead of drawing empty charts when there is no activity', async () => {
    localStorage.setItem(STORAGE_KEYS.currentStudent, 'sam')
    server.use(http.get(`${B}/analytics`, () => HttpResponse.json(empty)), http.get(`${B}/summary`, () => HttpResponse.json({ current_streak_days: 0 })))
    renderWithProviders(<Routes><Route path="/analytics" element={<AnalyticsPage />} /></Routes>, { route: '/analytics' })
    expect(await screen.findByText('No activity in this period')).toBeInTheDocument()
  })

  it('shows a retryable error when the analytics request fails', async () => {
    localStorage.setItem(STORAGE_KEYS.currentStudent, 'sam')
    server.use(http.get(`${B}/analytics`, () => HttpResponse.json({ detail: 'boom' }, { status: 500 })), http.get(`${B}/summary`, () => HttpResponse.json({})))
    renderWithProviders(<Routes><Route path="/analytics" element={<AnalyticsPage />} /></Routes>, { route: '/analytics' })
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
