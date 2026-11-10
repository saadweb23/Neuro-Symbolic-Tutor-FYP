import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '@/constants/storage'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/utils'
import { MasteryPage } from './MasteryPage'

const B = 'http://localhost:8000'
const names = ['Syntax', 'Variables', 'Lists', 'Tuples']
const concepts = names.map((concept, id) => ({
  concept, id, block_index: id < 2 ? 0 : 2, belief: [0.8, 0.3, 0.5, 0.6][id], attempts: id, correct: 0, accuracy: id ? 0.5 : null,
  last_attempt_at: null, prerequisites: id === 1 ? ['Syntax'] : [], dependents: [], weakest_prerequisite: id === 1 ? 'Syntax' : null,
}))
const graph = {
  nodes: concepts.map((c) => ({ id: c.id, concept: c.concept, block_index: c.block_index, depth: c.id === 1 ? 1 : 0 })),
  edges: [{ source: 0, target: 1 }],
  blocks: [{ index: 0, name: 'Fundamentals', concepts: ['Syntax', 'Variables'] }, { index: 2, name: 'Data Structures', concepts: ['Lists', 'Tuples'] }],
}

function Where() {
  const l = useLocation()
  return <output data-testid="url">{l.search}</output>
}

function setup(route = '/mastery') {
  localStorage.setItem(STORAGE_KEYS.currentStudent, 'sam')
  server.use(
    http.get(`${B}/students/sam/concepts`, () => HttpResponse.json({ concepts })),
    http.get(`${B}/students/sam/resources`, () => HttpResponse.json({ items: [] })),
    http.get(`${B}/graph`, () => HttpResponse.json(graph)),
  )
  renderWithProviders(<><Routes><Route path="/mastery" element={<MasteryPage />} /></Routes><Where /></>, { route })
}

describe('MasteryPage', () => {
  it('shows every concept from the API and filters by search, keeping state in the URL', async () => {
    setup()
    expect(await screen.findByRole('button', { name: /Syntax: 80%/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /: \d+%/ })).toHaveLength(4)
    await userEvent.type(screen.getByLabelText('Search concepts'), 'tup')
    expect(screen.getAllByRole('button', { name: /: \d+%/ })).toHaveLength(1)
    expect(screen.getByTestId('url')).toHaveTextContent('q=tup')
  })

  it('filters by tier using the backend cut-offs and by block from the URL', async () => {
    setup('/mastery?block=2')
    await screen.findByRole('button', { name: /Lists: 50%/ })
    expect(screen.queryByRole('button', { name: /Syntax/ })).toBeNull()
    await userEvent.click(within(screen.getByRole('group', { name: 'Filters' })).getByRole('button', { name: /Developing/ }))
    expect(screen.getAllByRole('button', { name: /: \d+%/ })).toHaveLength(2) // Lists 50%, Tuples 60%
  })

  it('opens the detail panel with prerequisites for a selected concept', async () => {
    setup('/mastery?concept=Variables')
    const panel = await screen.findByRole('complementary', { name: /concept details/i }).catch(() => null)
    // below the lg breakpoint (jsdom) the details open as a dialog instead of a side panel
    const dialog = panel ?? (await screen.findByRole('dialog'))
    expect(within(dialog).getByText('Builds on')).toBeInTheDocument()
    expect(within(dialog).getByText('weakest')).toBeInTheDocument()
  })
})
