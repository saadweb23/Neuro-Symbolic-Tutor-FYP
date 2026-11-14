import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderWithProviders, signInAs } from '@/test/utils'
import { LearningPathsPage } from './LearningPathsPage'

const B = 'http://localhost:8000/students/sam'
const names = ['Fundamentals', 'Control Flow', 'Data Structures', 'Modularity', 'Intermediate Mechanics']
const blocks = names.map((name, index) => ({
  index, name, concepts: [`${name} A`, `${name} B`], average_mastery: 0.5, weakest_concept: `${name} A`, weakest_belief: 0.45, complete: false,
}))

function setup(activeBlock: number | null) {
  signInAs('sam')
  const posts: unknown[] = []
  server.use(
    http.get(`${B}/blocks`, () => HttpResponse.json({ blocks })),
    http.get(`${B}/mastery`, () => HttpResponse.json({ beliefs: {} })),
    http.get(`${B}/concepts`, () => HttpResponse.json({ concepts: [] })),
    http.get('http://localhost:8000/graph', () => HttpResponse.json({ nodes: [], edges: [], blocks: [] })),
    http.get(`${B}/summary`, () => HttpResponse.json({ answered_questions: 0, correct_answers: 0, accuracy: null, practice_questions: 0, videos_viewed: 0, deep_dives_read: 0, concepts_attempted: 0, concepts_total: 25, answering_time_seconds: 0, active_days: 0, current_streak_days: 0, longest_streak_days: 0, first_activity_at: null, last_activity_at: null })),
    http.get(`${B}/status`, () => HttpResponse.json({ student_id: 'sam', exists: true, placement_completed: true, placement_completed_at: null, has_active_session: false, session: null, counts: { interactions: 0, answered_questions: 0 }, created_at: null, last_active_at: null })),
    http.get(`${B}/session`, () => HttpResponse.json(activeBlock === null ? { active: false } : { active: true, block_index: activeBlock, round_count: 4, round_cap: 15 })),
    http.get(`${B}/recommendation`, () => HttpResponse.json({ state: 'ready', session_active: false, block_index: 3, block_name: 'Modularity', suggested: true, block: null, candidates: [], note: '' })),
    http.post(`${B}/session/start`, async ({ request }) => {
      posts.push(await request.json())
      return HttpResponse.json({ active: true, block_index: 0, round_count: 0, round_cap: 15 })
    }),
  )
  renderWithProviders(
    <Routes>
      <Route path="/learn" element={<LearningPathsPage />} />
      <Route path="/learn/session" element={<p>workspace</p>} />
    </Routes>,
    { route: '/learn' },
  )
  return posts
}

describe('LearningPathsPage', () => {
  it('resumes the active block without calling session/start (which would reset the rounds)', async () => {
    const posts = setup(1)
    await userEvent.click(await screen.findByRole('button', { name: /resume session/i }))
    expect(await screen.findByText('workspace')).toBeInTheDocument()
    expect(posts).toHaveLength(0)
  })

  it('asks before switching away from an active session, then starts the chosen block', async () => {
    const posts = setup(1)
    await screen.findByText('Fundamentals')
    const startButtons = await screen.findAllByRole('button', { name: /start learning/i })
    await userEvent.click(startButtons[0]!)
    expect(await screen.findByText(/Switch to Fundamentals\?/)).toBeInTheDocument()
    expect(posts).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: /switch focus area/i }))
    await waitFor(() => expect(posts).toEqual([{ block_index: 0 }]))
    expect(await screen.findByText('workspace')).toBeInTheDocument()
  })

  it('starts straight away when nothing is active', async () => {
    const posts = setup(null)
    const startButtons = await screen.findAllByRole('button', { name: /start learning/i })
    await userEvent.click(startButtons[2]!)
    await waitFor(() => expect(posts).toEqual([{ block_index: 2 }]))
  })
})
