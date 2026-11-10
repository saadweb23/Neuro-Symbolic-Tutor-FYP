import { LayoutGrid, List, Network, Search } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useConcepts, useGraph } from '@/api/queries/hooks'
import type { ConceptDetail } from '@/api/types'
import { useTierFor } from '@/app/providers/MetaProvider'
import { ConceptTile } from '@/components/domain/ConceptTile'
import { TierBadge } from '@/components/domain/TierBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useStudentId } from '@/app/providers/StudentProvider'
import { ConceptDetailPanel } from '@/features/mastery/ConceptDetailPanel'
import { ConceptGraph } from '@/features/mastery/ConceptGraph'
import { applyFilters, SORT_LABELS, type SortKey } from '@/features/mastery/filters'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { BLOCK_COLORS, TIER_STYLES, pct, type Tier } from '@/lib/tiers'

type View = 'map' | 'graph' | 'list'
const TIERS: Tier[] = ['mastered', 'developing', 'weak']
const isView = (v: string | null): v is View => v === 'map' || v === 'graph' || v === 'list'
const isSort = (v: string | null): v is SortKey => v !== null && v in SORT_LABELS
const isTier = (v: string | null): v is Tier => v === 'mastered' || v === 'developing' || v === 'weak'

export function MasteryPage() {
  const id = useStudentId()
  const concepts = useConcepts(id)
  const graph = useGraph()
  const tierFor = useTierFor()
  const wide = useMediaQuery('(min-width: 1024px)')
  const [params, setParams] = useSearchParams()

  // All view state lives in the URL, so a filtered view can be shared or reopened.
  const viewParam = params.get('view')
  const view: View = isView(viewParam) ? viewParam : 'map'
  const blockParam = params.get('block')
  const block = blockParam !== null && /^[0-4]$/.test(blockParam) ? Number(blockParam) : null
  const tierParam = params.get('tier')
  const tier = isTier(tierParam) ? tierParam : null
  const query = params.get('q') ?? ''
  const sortParam = params.get('sort')
  const sort: SortKey = isSort(sortParam) ? sortParam : 'order'
  const selected = params.get('concept')

  const set = (patch: Record<string, string | null>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) (v === null || v === '' ? next.delete(k) : next.set(k, v))
      return next
    }, { replace: true })

  const all = concepts.data
  const filtered = useMemo(() => (all ? applyFilters(all, { block, tier, query, sort }, tierFor) : []), [all, block, tier, query, sort, tierFor])
  const visible = useMemo(() => new Set(filtered.map((c) => c.concept)), [filtered])
  const selectedDetail = all?.find((c) => c.concept === selected)
  const blockName = (i: number) => graph.data?.blocks[i]?.name ?? `Block ${i + 1}`
  const pick = (c: string) => set({ concept: c })

  const panel = selectedDetail && all && (
    <ConceptDetailPanel detail={selectedDetail} all={all} blockName={blockName(selectedDetail.block_index)} onSelect={pick} onClose={() => set({ concept: null })} />
  )

  return (
    <div>
      <PageHeader title="Concept mastery" description="Your estimated mastery of every concept. Estimates come from the tracker and are built from all your answers, including related concepts on the prerequisite graph." />

      {concepts.isPending && <SkeletonCard lines={8} />}
      {concepts.isError && <ErrorState error={concepts.error} onRetry={() => void concepts.refetch()} />}

      {all && (
        <Tabs value={view} onValueChange={(v) => set({ view: v === 'map' ? null : v })}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <TabsList aria-label="View">
              <TabsTrigger value="map"><LayoutGrid className="mr-1.5 inline size-4" aria-hidden />Map</TabsTrigger>
              <TabsTrigger value="graph"><Network className="mr-1.5 inline size-4" aria-hidden />Graph</TabsTrigger>
              <TabsTrigger value="list"><List className="mr-1.5 inline size-4" aria-hidden />List</TabsTrigger>
            </TabsList>
            <div className="relative min-w-48 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input aria-label="Search concepts" placeholder="Search concepts" value={query} onChange={(e) => set({ q: e.target.value })} className="h-10 pl-9" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              Sort
              <select value={sort} onChange={(e) => set({ sort: e.target.value === 'order' ? null : e.target.value })} className="h-10 rounded-md border border-border-strong bg-surface px-2 text-sm text-text">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
              </select>
            </label>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
            <Chip active={block === null} onClick={() => set({ block: null })}>All blocks</Chip>
            {(graph.data?.blocks ?? []).map((b) => (
              <Chip key={b.index} active={block === b.index} onClick={() => set({ block: block === b.index ? null : String(b.index) })}>
                <span className="size-2 rounded-full" style={{ background: BLOCK_COLORS[b.index] }} aria-hidden />{b.name}
              </Chip>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
            {TIERS.map((t) => {
              const S = TIER_STYLES[t]
              return <Chip key={t} active={tier === t} onClick={() => set({ tier: tier === t ? null : t })}><S.icon className={cn('size-3.5', S.text)} aria-hidden />{S.label}</Chip>
            })}
          </div>

          <div className={cn('grid gap-6', selectedDetail && wide && 'lg:grid-cols-[1fr_340px]')}>
            <div className="min-w-0">
              {filtered.length === 0 && view !== 'graph' ? (
                <Card><EmptyState title="No concepts match" description="Try clearing a filter or the search box." action={<Button variant="secondary" size="sm" onClick={() => setParams({ view }, { replace: true })}>Clear filters</Button>} /></Card>
              ) : (
                <>
                  <TabsContent value="map" className="space-y-6">
                    {(graph.data?.blocks ?? []).map((b) => {
                      const items = filtered.filter((c) => c.block_index === b.index)
                      if (!items.length) return null
                      return (
                        <section key={b.index} aria-label={b.name}>
                          <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold"><span className="size-2.5 rounded-full" style={{ background: BLOCK_COLORS[b.index] }} aria-hidden />{b.name}</h4>
                          <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', selectedDetail && wide ? 'xl:grid-cols-3' : 'lg:grid-cols-5')}>
                            {items.map((c) => <ConceptTile key={c.concept} concept={c.concept} belief={c.belief} attempts={c.attempts} selected={selected === c.concept} onClick={() => pick(c.concept)} />)}
                          </div>
                        </section>
                      )
                    })}
                  </TabsContent>

                  <TabsContent value="graph">
                    {graph.isPending && <SkeletonCard lines={8} />}
                    {graph.isError && <ErrorState error={graph.error} onRetry={() => void graph.refetch()} />}
                    {graph.data && <ConceptGraph graph={graph.data} concepts={all} selected={selected} visible={visible} onSelect={pick} />}
                  </TabsContent>

                  <TabsContent value="list">
                    <ConceptTable items={filtered} selected={selected} onSelect={pick} blockName={blockName} />
                  </TabsContent>
                </>
              )}
            </div>
            {selectedDetail && wide && <aside aria-label="Concept details" className="lg:sticky lg:top-24 lg:self-start"><Card><CardBody>{panel}</CardBody></Card></aside>}
          </div>
        </Tabs>
      )}

      {!wide && (
        <Dialog open={!!selectedDetail} onOpenChange={(o) => !o && set({ concept: null })} title={selectedDetail?.concept ?? 'Concept'} variant="sheet">
          {selectedDetail && all && <ConceptDetailPanel detail={selectedDetail} all={all} blockName={blockName(selectedDetail.block_index)} onSelect={pick} />}
        </Dialog>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors', active ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-muted hover:text-text')}>
      {children}
    </button>
  )
}

function ConceptTable({ items, selected, onSelect, blockName }: { items: ConceptDetail[]; selected: string | null; onSelect: (c: string) => void; blockName: (i: number) => string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-raised/50 text-xs uppercase tracking-wide text-muted">
          <tr>{['Concept', 'Block', 'Mastery', 'Tier', 'Answers', 'Accuracy', 'Last answered'].map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((c) => (
            <tr key={c.concept} className={cn('cursor-pointer hover:bg-raised/60', selected === c.concept && 'bg-primary-soft/50')} onClick={() => onSelect(c.concept)}>
              <th scope="row" className="px-4 py-2.5 font-medium"><button className="text-left hover:underline" onClick={(e) => { e.stopPropagation(); onSelect(c.concept) }}>{c.concept}</button></th>
              <td className="px-4 py-2.5 text-muted">{blockName(c.block_index)}</td>
              <td className="px-4 py-2.5 tabular-nums">{pct(c.belief)}</td>
              <td className="px-4 py-2.5"><TierBadge belief={c.belief} /></td>
              <td className="px-4 py-2.5 tabular-nums">{c.attempts}</td>
              <td className="px-4 py-2.5 tabular-nums">{c.accuracy === null ? '–' : pct(c.accuracy)}</td>
              <td className="px-4 py-2.5 text-muted">{c.last_attempt_at ? formatDate(c.last_attempt_at) : 'never'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
