import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderWithProviders, signInAs } from '@/test/utils'
import { HistoryPage } from './HistoryPage'

const B = 'http://localhost:8000'
const item = (step: number, over = {}) => ({
  step_index: step, at: '2026-01-01T10:00:00Z', concept: 'Lists', block_index: 2, content_type: 'practice', content_id: `lists-mcq-${step}`,
  passed: true, time_taken: 9, difficulty: 'easy', question_text: 'What is a list?', choices: ['a', 'b', 'c', 'd'], correct_index: 1,
  explanation: 'Because.', selected_index: 1, belief_before: 0.4, belief_after: 0.5, ...over,
})

function setup(pages: Record<string, object>) {
  signInAs('sam')
  const urls: string[] = []
  server.use(
    http.get(`${B}/graph`, () => HttpResponse.json({ nodes: [{ id: 0, concept: 'Lists', block_index: 2, depth: 0 }], edges: [], blocks: [{ index: 2, name: 'Data Structures', concepts: ['Lists'] }] })),
    http.get(`${B}/students/sam/history`, ({ request }) => {
      urls.push(request.url)
      const cursor = new URL(request.url).searchParams.get('cursor') ?? 'first'
      return HttpResponse.json(pages[cursor])
    }),
  )
  renderWithProviders(<Routes><Route path="/history" element={<HistoryPage />} /></Routes>, { route: '/history' })
  return urls
}

describe('HistoryPage', () => {
  it('lists entries, loads the next page by cursor, and never calls viewed items "Correct"', async () => {
    setup({
      first: { items: [item(2), item(1, { content_type: 'video', passed: null, question_text: null, choices: null, correct_index: null, explanation: null, selected_index: null, difficulty: null })], next_cursor: 1, total: 3 },
      '1': { items: [item(0)], next_cursor: null, total: 3 },
    })
    expect(await screen.findByText('3 entries')).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getAllByText('Correct')).toHaveLength(1) // the video row says "Viewed"
    expect(within(table).getByText('Viewed')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /load more/i }))
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByText('Lists')).toHaveLength(3))
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull()
  })

  it('sends the chosen filter to the backend', async () => {
    const urls = setup({ first: { items: [item(0)], next_cursor: null, total: 1 } })
    await screen.findByText('1 entry')
    await userEvent.selectOptions(screen.getByLabelText('Result'), 'failed')
    await waitFor(() => expect(urls.some((u) => u.includes('result=failed'))).toBe(true))
  })

  it('shows an honest empty state for a new student', async () => {
    setup({ first: { items: [], next_cursor: null, total: 0 } })
    expect(await screen.findByText('No history yet')).toBeInTheDocument()
  })

  it('opens the question with the chosen and correct options', async () => {
    setup({ first: { items: [item(0, { passed: false, selected_index: 2 })], next_cursor: null, total: 1 } })
    await userEvent.click(await screen.findByRole('button', { name: 'Lists' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Your answer')).toBeInTheDocument()
    expect(within(dialog).getByText('Correct answer')).toBeInTheDocument()
    expect(within(dialog).getByText('Because.')).toBeInTheDocument()
  })
})
