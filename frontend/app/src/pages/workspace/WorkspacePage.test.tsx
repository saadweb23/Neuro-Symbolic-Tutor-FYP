import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { StrictMode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '@/constants/storage'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/utils'
import { WorkspacePage } from './WorkspacePage'

const B = 'http://localhost:8000/students/sam'
const block = { index: 1, name: 'Control Flow', average_mastery: 0.5, round_count: 3, round_cap: 15 }
const practice = {
  concept: 'Conditionals', content_type: 'practice_problem', explanation: 'Because you are shaky on Relational Operators.',
  mastery_belief: 0.42, attempt_number: 1, block,
  content: { id: 'conditionals-mcq-1', type: 'mcq', question: 'What does `if` do?', choices: ['A', 'B', 'C', 'D'], difficulty: 'easy', source: 'bank' },
}

function setup(opts: { sessionActive?: boolean; stored?: boolean } = {}) {
  localStorage.setItem(STORAGE_KEYS.currentStudent, 'sam')
  if (opts.stored) sessionStorage.setItem('nt_step_sam', JSON.stringify(practice))
  const calls = { next: 0, answers: [] as unknown[] }
  server.use(
    http.get(`${B}/session`, () => HttpResponse.json(opts.sessionActive === false ? { active: false } : { active: true, block_index: 1, round_count: 3, round_cap: 15 })),
    http.get(`${B}/next`, () => { calls.next += 1; return HttpResponse.json(practice) }),
    http.get(`${B}/concepts`, () => HttpResponse.json({ concepts: [] })),
    http.post(`${B}/mcq-answer`, async ({ request }) => {
      calls.answers.push(await request.json())
      return HttpResponse.json({ concept: 'Conditionals', passed: false, correct_index: 2, explanation: 'C is right.', updated_belief: 0.38 })
    }),
  )
  renderWithProviders(
    <StrictMode>
      <Routes>
        <Route path="/learn/session" element={<WorkspacePage />} />
        <Route path="/learn" element={<p>paths page</p>} />
      </Routes>
    </StrictMode>,
    { route: '/learn/session' },
  )
  return calls
}

describe('WorkspacePage', () => {
  it('calls GET /next exactly once even under React StrictMode, shows the explanation and grades an answer', async () => {
    const calls = setup()
    expect(await screen.findByText('Because you are shaky on Relational Operators.')).toBeInTheDocument()
    expect(calls.next).toBe(1)

    await userEvent.click(screen.getByRole('radio', { name: /C/ }))
    await userEvent.click(screen.getByRole('button', { name: /submit answer/i }))
    expect(await screen.findByText('Not quite')).toBeInTheDocument()
    expect(calls.answers).toEqual([{ content_id: 'conditionals-mcq-1', selected_index: 2, time_taken: expect.any(Number) }])
    expect(screen.getByText(/42% → 38%/)).toBeInTheDocument()
    expect(calls.next).toBe(1) // answering never asks for another round
  })

  it('restores the saved step after a reload without calling /next (no round is consumed)', async () => {
    const calls = setup({ stored: true })
    expect(await screen.findByText('Because you are shaky on Relational Operators.')).toBeInTheDocument()
    expect(calls.next).toBe(0)
  })

  it('goes back to the learning paths when there is no active session', async () => {
    const calls = setup({ sessionActive: false })
    await waitFor(() => expect(screen.getByText('paths page')).toBeInTheDocument())
    expect(calls.next).toBe(0)
  })
})
