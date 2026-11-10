import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import { HelpPage } from './HelpPage'

describe('HelpPage', () => {
  it('quotes the thresholds supplied by the backend (/meta), not hardcoded copies', () => {
    renderWithProviders(<HelpPage />)
    expect(screen.getAllByText(/65% average mastery/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/at least 50%/).length).toBeGreaterThan(0)
    expect(screen.getByText(/up to 15 rounds/)).toBeInTheDocument()
  })
  it('has a single top-level heading and the main sections', () => {
    renderWithProviders(<HelpPage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    for (const name of ['Getting started', 'How NeuroTutor decides', 'FAQ', 'Troubleshooting', 'About the project']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
  })
  it('does not overclaim research results', () => {
    renderWithProviders(<HelpPage />)
    expect(screen.getByText(/matches, but does not beat/)).toBeInTheDocument()
  })
})
