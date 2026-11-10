import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { MetaProvider } from '@/app/providers/MetaProvider'
import { PreferencesProvider } from '@/app/providers/PreferencesProvider'
import { StudentProvider } from '@/app/providers/StudentProvider'
import { ToastProvider } from '@/app/providers/ToastProvider'
import { TooltipProvider } from '@/components/ui/Tooltip'
import type { Meta } from '@/api/types'

/** Shape-accurate fixture for GET /meta, used only inside tests. */
export const testMeta: Meta = {
  status: 'ok',
  server_time: '2026-01-01T00:00:00Z',
  models: { tracker: 'dual_gcn_weights_v2.pth', ppo: 'ppo_tutor_v2.zip' },
  config: {
    mastery_threshold: 0.65,
    concept_floor: 0.5,
    session_round_cap: 15,
    escalation_threshold: 2,
    difficulty_cutoffs: { easy_below: 0.4, medium_below: 0.7 },
    placement_concepts: ['Syntax'],
    concept_count: 25,
    block_count: 5,
  },
}

export function renderWithProviders(ui: ReactElement, { route = '/', ...options }: RenderOptions & { route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <PreferencesProvider>
      <QueryClientProvider client={client}>
        <StudentProvider>
          <ToastProvider>
            <TooltipProvider>
              <MetaProvider meta={testMeta}>
                <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
              </MetaProvider>
            </TooltipProvider>
          </ToastProvider>
        </StudentProvider>
      </QueryClientProvider>
    </PreferencesProvider>
  )
  return { client, ...render(ui, { wrapper: Wrapper, ...options }) }
}
