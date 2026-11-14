import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import { RoadmapGraph } from './RoadmapGraph'
import type { RoadmapNode } from './roadmap'

const graph = { nodes: [{ id: 0, concept: 'Syntax', block_index: 0, depth: 0 }, { id: 1, concept: 'Variables', block_index: 0, depth: 1 }], edges: [{ source: 0, target: 1 }] }
const node = (id: number, concept: string, state: RoadmapNode['state'], belief: number): RoadmapNode => ({ id, concept, blockIndex: 0, depth: id, difficulty: 'Foundation', state, belief, attempts: 1, prerequisites: [], blockedBy: [] })

describe('RoadmapGraph', () => {
  it('shows each concept with its state and selects it on click', async () => {
    const onSelect = vi.fn()
    renderWithProviders(<RoadmapGraph graph={graph} nodes={[node(0, 'Syntax', 'completed', 0.9), node(1, 'Variables', 'current', 0.5)]} selected={null} onSelect={onSelect} />)
    expect(screen.getByText('Syntax 90% · Completed')).toBeInTheDocument()   // the node's <title>: its accessible name in browsers
    await userEvent.click(screen.getByText('Variables 50% · Current'))
    expect(onSelect).toHaveBeenCalledWith('Variables')
  })
})
