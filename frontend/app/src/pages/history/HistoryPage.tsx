import { Download, Filter } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGraph, useHistory, type HistoryFilters } from '@/api/queries/hooks'
import type { ContentKind, HistoryItem } from '@/api/types'
import { useStudentId } from '@/app/providers/StudentProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { ActivityRow, KIND_LABEL, ResultBadge } from '@/components/domain/ActivityRow'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { McqQuestion } from '@/components/learning/McqQuestion'
import { RichText } from '@/components/learning/RichText'
import { BeliefDelta } from '@/components/learning/BeliefDelta'
import { Button, LinkButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ROUTES } from '@/constants/routes'
import { downloadCsv, fetchAllHistory, historyToCsv } from '@/features/history/export'
import { formatDateTime, formatDuration } from '@/lib/format'

const KINDS: ContentKind[] = ['placement', 'practice', 'video', 'deep_dive']
const sel = 'h-10 rounded-md border border-border-strong bg-surface px-2.5 text-sm text-text'

export function HistoryPage() {
  const id = useStudentId()
  const toast = useToast()
  const graph = useGraph()
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState<HistoryItem | null>(null)
  const [exporting, setExporting] = useState(false)

  const type = (KINDS as string[]).includes(params.get('type') ?? '') ? (params.get('type') as ContentKind) : undefined
  const result = params.get('result') === 'passed' || params.get('result') === 'failed' ? (params.get('result') as 'passed' | 'failed') : undefined
  const blockP = params.get('block')
  const block = blockP !== null && /^[0-4]$/.test(blockP) ? Number(blockP) : undefined
  const concept = params.get('concept') ?? undefined
  const filters: HistoryFilters = { type, result, block, concept }
  const active = Object.values(filters).some((v) => v !== undefined)

  const set = (k: string, v: string) => setParams((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n }, { replace: true })
  const history = useHistory(id, filters, 25)
  const items = history.data?.pages.flatMap((p) => p.items) ?? []
  const total = history.data?.pages[0]?.total ?? 0

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllHistory(id)
      downloadCsv(`neurotutor-history-${id}.csv`, historyToCsv(all))
      toast.show(`Exported ${all.length} rows.`, 'success')
    } catch {
      toast.show('The export failed. Please try again.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Learning history" description="Every question you answered and every lesson you viewed, newest first."
        actions={<Button variant="secondary" size="sm" loading={exporting} onClick={() => void exportCsv()} icon={<Download className="size-4" />}>Export CSV</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-2.5" role="group" aria-label="Filters">
        <Filter className="size-4 text-muted" aria-hidden />
        <select aria-label="Type" className={sel} value={type ?? ''} onChange={(e) => set('type', e.target.value)}>
          <option value="">All types</option>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <select aria-label="Result" className={sel} value={result ?? ''} onChange={(e) => set('result', e.target.value)}>
          <option value="">Any result</option><option value="passed">Correct</option><option value="failed">Incorrect</option>
        </select>
        <select aria-label="Block" className={sel} value={block ?? ''} onChange={(e) => set('block', e.target.value)}>
          <option value="">All blocks</option>{graph.data?.blocks.map((b) => <option key={b.index} value={b.index}>{b.name}</option>)}
        </select>
        <select aria-label="Concept" className={sel} value={concept ?? ''} onChange={(e) => set('concept', e.target.value)}>
          <option value="">All concepts</option>{graph.data?.nodes.map((n) => <option key={n.id} value={n.concept}>{n.concept}</option>)}
        </select>
        {active && <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>Clear</Button>}
        {history.data && <span className="ml-auto text-sm text-muted" aria-live="polite">{total} {total === 1 ? 'entry' : 'entries'}</span>}
      </div>

      {history.isPending && <SkeletonCard lines={8} />}
      {history.isError && <ErrorState error={history.error} onRetry={() => void history.refetch()} />}

      {history.data && items.length === 0 && (
        <Card>
          <EmptyState title={active ? 'Nothing matches these filters' : 'No history yet'}
            description={active ? 'Try clearing a filter.' : 'Once you answer questions or watch lessons, every step is recorded here.'}
            action={active ? <Button variant="secondary" size="sm" onClick={() => setParams({}, { replace: true })}>Clear filters</Button> : <LinkButton to={ROUTES.learn} size="sm">Start learning</LinkButton>} />
        </Card>
      )}

      {items.length > 0 && (
        <>
          {/* wide screens: a table */}
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-raised/50 text-xs uppercase tracking-wide text-muted">
                <tr>{['When', 'Concept', 'Type', 'Result', 'Difficulty', 'Time', 'Mastery estimate'].map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((i) => (
                  <tr key={i.step_index} className="cursor-pointer hover:bg-raised/60" onClick={() => setOpen(i)}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDateTime(i.at)}</td>
                    <th scope="row" className="px-4 py-2.5 font-medium"><button className="text-left hover:underline" onClick={(e) => { e.stopPropagation(); setOpen(i) }}>{i.concept}</button></th>
                    <td className="px-4 py-2.5 text-muted">{KIND_LABEL[i.content_type]}</td>
                    <td className="px-4 py-2.5"><ResultBadge item={i} /></td>
                    <td className="px-4 py-2.5 capitalize text-muted">{i.difficulty ?? '–'}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted">{i.content_type === 'video' || i.content_type === 'deep_dive' ? '–' : formatDuration(i.time_taken)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{Math.round(i.belief_before * 100)}% → {Math.round(i.belief_after * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* phones: a card list */}
          <Card className="divide-y divide-border px-4 md:hidden">
            {items.map((i) => <button key={i.step_index} className="block w-full text-left" onClick={() => setOpen(i)}><ActivityRow item={i} /></button>)}
          </Card>
          {history.hasNextPage && (
            <div className="mt-5 text-center"><Button variant="secondary" onClick={() => void history.fetchNextPage()} loading={history.isFetchingNextPage}>Load more</Button></div>
          )}
        </>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)} title={open ? `${open.concept} · ${KIND_LABEL[open.content_type]}` : ''} variant="sheet" className="md:max-w-2xl">
        {open && <HistoryDetail item={open} />}
      </Dialog>
    </div>
  )
}

function HistoryDetail({ item }: { item: HistoryItem }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <ResultBadge item={item} /><span>{formatDateTime(item.at)}</span>
        {item.difficulty && <span className="capitalize">· {item.difficulty}</span>}
        {(item.content_type === 'practice' || item.content_type === 'placement') && <span>· {formatDuration(item.time_taken)}</span>}
      </div>
      {item.question_text && item.choices ? (
        <>
          <McqQuestion question={item.question_text} choices={item.choices} selected={item.selected_index} onSelect={() => undefined}
            reveal={item.correct_index !== null ? { correctIndex: item.correct_index } : undefined} shortcuts={false} />
          {item.selected_index === null && <p className="text-xs text-muted">Which option you chose was not recorded for this older entry.</p>}
          {item.explanation && <div className="rounded-lg bg-raised/60 p-3.5 text-sm"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Explanation</p><RichText text={item.explanation} /></div>}
        </>
      ) : item.content_type === 'video' || item.content_type === 'deep_dive' ? (
        <p className="text-sm text-muted">You marked this {item.content_type === 'video' ? 'video as watched' : 'documentation page as read'}. It was counted as covered, not as a graded answer.</p>
      ) : (
        <p className="text-sm text-muted">The question text was not stored for this older placement answer.</p>
      )}
      <BeliefDelta concept={item.concept} before={item.belief_before} after={item.belief_after} />
    </div>
  )
}
