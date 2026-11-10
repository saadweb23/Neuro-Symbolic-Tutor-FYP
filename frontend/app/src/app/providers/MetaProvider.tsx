import { createContext, useContext, type ReactNode } from 'react'
import type { Meta, MetaConfig } from '@/api/types'
import { tierFor, type Tier } from '@/lib/tiers'

const Ctx = createContext<Meta | null>(null)

/** Provided by BootGate once GET /meta has answered, so every page can rely on the backend's
 *  thresholds (mastery target, session cap, tier cut-offs) being present. */
export function MetaProvider({ meta, children }: { meta: Meta; children: ReactNode }) {
  return <Ctx.Provider value={meta}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMeta(): Meta {
  const v = useContext(Ctx)
  if (!v) throw new Error('useMeta must be used inside <MetaProvider>')
  return v
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMetaConfig(): MetaConfig {
  return useMeta().config
}

/** Returns a function mapping a belief to its tier using the backend's cut-offs. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTierFor(): (belief: number) => Tier {
  const { difficulty_cutoffs } = useMetaConfig()
  return (belief: number) => tierFor(belief, difficulty_cutoffs)
}
