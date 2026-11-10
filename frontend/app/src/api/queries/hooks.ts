import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { get, post, studentPath } from '../client'
import type {
  Analytics,
  Beliefs,
  BlockProgress,
  ConceptDetail,
  Graph,
  HistoryPage,
  McqResult,
  Meta,
  NextStep,
  PlacementAnswer,
  PlacementQuestion,
  Recommendation,
  ResourceItem,
  SessionState,
  StudentStatus,
  Summary,
  Trajectory,
  ViewedResult,
  ContentKind,
} from '../types'
import { clearStoredStep } from '@/features/workspace/storage'
import { keys } from './keys'

export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

type Opts<T> = Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>

// ---------------------------------------------------------------- global, read-only
export const fetchMeta = () => get<Meta>('/meta')
export const useGraph = (opts?: Opts<Graph>) =>
  useQuery({ queryKey: keys.graph, queryFn: () => get<Graph>('/graph'), staleTime: Infinity, ...opts })

// ---------------------------------------------------------------- student, read-only
export const fetchStatus = (id: string) => get<StudentStatus>(studentPath(id, '/status'))
export const useStatus = (id: string | null, opts?: Opts<StudentStatus>) =>
  useQuery({ queryKey: keys.status(id ?? ''), queryFn: () => fetchStatus(id as string), enabled: !!id, ...opts })

export const useSummary = (id: string) => {
  const tz = browserTimeZone()
  return useQuery({
    queryKey: keys.summary(id, tz),
    queryFn: () => get<Summary>(studentPath(id, `/summary?tz=${encodeURIComponent(tz)}`)),
  })
}

export const useBlocks = (id: string) =>
  useQuery({
    queryKey: keys.blocks(id),
    queryFn: () => get<{ blocks: BlockProgress[] }>(studentPath(id, '/blocks')).then((r) => r.blocks),
  })

export const useMastery = (id: string) =>
  useQuery({
    queryKey: keys.mastery(id),
    queryFn: () => get<{ beliefs: Beliefs }>(studentPath(id, '/mastery')).then((r) => r.beliefs),
  })

export const useSession = (id: string, opts?: Opts<SessionState>) =>
  useQuery({ queryKey: keys.session(id), queryFn: () => get<SessionState>(studentPath(id, '/session')), ...opts })

export const useConcepts = (id: string) =>
  useQuery({
    queryKey: keys.concepts(id),
    queryFn: () => get<{ concepts: ConceptDetail[] }>(studentPath(id, '/concepts')).then((r) => r.concepts),
  })

export const useResources = (id: string) =>
  useQuery({
    queryKey: keys.resources(id),
    queryFn: () => get<{ items: ResourceItem[] }>(studentPath(id, '/resources')).then((r) => r.items),
  })

/** Side-effect-free preview. NEVER substitute GET /next here: /next consumes a learning round. */
export const useRecommendation = (id: string, blockIndex: number | null = null) =>
  useQuery({
    queryKey: keys.recommendation(id, blockIndex),
    queryFn: () =>
      get<Recommendation>(studentPath(id, `/recommendation${blockIndex === null ? '' : `?block_index=${blockIndex}`}`)),
  })

export const useTrajectory = (id: string) =>
  useQuery({
    queryKey: keys.trajectory(id),
    queryFn: () => get<Trajectory>(studentPath(id, '/mastery/trajectory')),
  })

export const useAnalytics = (id: string, days: number | null) => {
  const tz = browserTimeZone()
  return useQuery({
    queryKey: keys.analytics(id, tz, days),
    queryFn: () =>
      get<Analytics>(studentPath(id, `/analytics?tz=${encodeURIComponent(tz)}${days ? `&days=${days}` : ''}`)),
  })
}

export interface HistoryFilters {
  concept?: string
  block?: number
  type?: ContentKind
  result?: 'passed' | 'failed'
}

export const useHistory = (id: string, filters: HistoryFilters = {}, pageSize = 25) =>
  useInfiniteQuery({
    queryKey: keys.history(id, { ...filters, pageSize }),
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ limit: String(pageSize) })
      if (pageParam !== null) q.set('cursor', String(pageParam))
      if (filters.concept) q.set('concept', filters.concept)
      if (filters.block !== undefined) q.set('block', String(filters.block))
      if (filters.type) q.set('type', filters.type)
      if (filters.result) q.set('result', filters.result)
      return get<HistoryPage>(studentPath(id, `/history?${q.toString()}`))
    },
    getNextPageParam: (last) => last.next_cursor,
  })

/** Everything student-scoped becomes stale after a learning action. */
export const invalidateStudent = (qc: QueryClient, id: string) =>
  qc.invalidateQueries({ queryKey: keys.student(id) })

// ---------------------------------------------------------------- mutations (write to the backend)
export const usePlacementStart = (id: string) =>
  useMutation({
    mutationFn: () => post<{ questions: PlacementQuestion[] }>(studentPath(id, '/placement/start')),
  })

export const usePlacementSubmit = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (answers: PlacementAnswer[]) => post<{ beliefs: Beliefs }>(studentPath(id, '/placement/submit'), answers),
    onSuccess: () => invalidateStudent(qc, id),
  })
}

export const useStartSession = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (blockIndex: number) => post<SessionState>(studentPath(id, '/session/start'), { block_index: blockIndex }),
    onSuccess: () => {
      clearStoredStep(id) // a saved step belongs to the previous session
      return invalidateStudent(qc, id)
    },
  })
}

export const useContinueSession = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => post<SessionState>(studentPath(id, '/session/continue')),
    onSuccess: () => invalidateStudent(qc, id),
  })
}

/** GET /next CONSUMES A LEARNING ROUND and generates a question, so it is a mutation: never cached,
 *  never refetched on focus or remount, and only ever called from the Learning Workspace. */
export const useNextStep = (id: string) =>
  useMutation({ mutationKey: ['next', id], mutationFn: () => get<NextStep>(studentPath(id, '/next')) })

export const useSubmitMcq = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { contentId: string; selectedIndex: number; timeTaken: number }) =>
      post<McqResult>(studentPath(id, '/mcq-answer'), {
        content_id: v.contentId,
        selected_index: v.selectedIndex,
        time_taken: v.timeTaken,
      }),
    onSuccess: () => invalidateStudent(qc, id),
  })
}

export const useMarkViewed = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { concept: string; contentId: string; timeTaken: number }) =>
      post<ViewedResult>(studentPath(id, '/content-viewed'), {
        concept: v.concept,
        content_id: v.contentId,
        time_taken: v.timeTaken,
      }),
    onSuccess: () => invalidateStudent(qc, id),
  })
}
