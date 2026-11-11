/** One key factory so invalidation is precise: everything student-scoped lives under
 *  ['student', id, ...]; global read-only data under ['meta'] / ['graph']. */
export const keys = {
  meta: ['meta'] as const,
  graph: ['graph'] as const,
  me: ['auth', 'me'] as const,
  student: (id: string) => ['student', id] as const,
  status: (id: string) => ['student', id, 'status'] as const,
  summary: (id: string, tz: string) => ['student', id, 'summary', tz] as const,
  blocks: (id: string) => ['student', id, 'blocks'] as const,
  mastery: (id: string) => ['student', id, 'mastery'] as const,
  session: (id: string) => ['student', id, 'session'] as const,
  concepts: (id: string) => ['student', id, 'concepts'] as const,
  resources: (id: string) => ['student', id, 'resources'] as const,
  recommendation: (id: string, block: number | null) => ['student', id, 'recommendation', block] as const,
  trajectory: (id: string) => ['student', id, 'trajectory'] as const,
  analytics: (id: string, tz: string, days: number | null) => ['student', id, 'analytics', tz, days] as const,
  history: (id: string, filters: unknown) => ['student', id, 'history', filters] as const,
}
