import { BookOpenText, CheckCircle2, ExternalLink, PlayCircle, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGraph, useResources } from '@/api/queries/hooks'
import { useStudentId } from '@/app/providers/StudentProvider'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { VideoPlayer } from '@/components/learning/VideoPlayer'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { filterResources, groupResources, type ResourceGroup } from '@/features/resources/group'
import { BLOCK_COLORS } from '@/lib/tiers'

const sel = 'h-10 rounded-md border border-border-strong bg-surface px-2.5 text-sm text-text'

export function ResourcesPage() {
  const id = useStudentId()
  const resources = useResources(id)
  const graph = useGraph()
  const [params, setParams] = useSearchParams()
  const [preview, setPreview] = useState<ResourceGroup | null>(null)

  const kind = params.get('type') === 'video' || params.get('type') === 'doc' ? (params.get('type') as 'video' | 'doc') : null
  const seen = params.get('seen') === 'seen' || params.get('seen') === 'unseen' ? (params.get('seen') as 'seen' | 'unseen') : null
  const bp = params.get('block')
  const block = bp !== null && /^[0-4]$/.test(bp) ? Number(bp) : null
  const query = params.get('q') ?? ''
  const set = (k: string, v: string) => setParams((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n }, { replace: true })

  const groups = useMemo(() => (resources.data ? groupResources(resources.data) : []), [resources.data])
  const shown = useMemo(() => filterResources(groups, { kind, seen, block, query }), [groups, kind, seen, block, query])

  return (
    <div>
      <PageHeader title="Resource library" description="The curated videos and official documentation the tutor draws on. One source often covers several related concepts. Opening a resource here is read-only and does not change your progress." />
      <div className="mb-5 flex flex-wrap items-center gap-2.5" role="group" aria-label="Filters">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Search resources" placeholder="Search title or concept" value={query} onChange={(e) => set('q', e.target.value)} className="h-10 pl-9" />
        </div>
        <select aria-label="Type" className={sel} value={kind ?? ''} onChange={(e) => set('type', e.target.value)}><option value="">Videos and docs</option><option value="video">Videos</option><option value="doc">Documentation</option></select>
        <select aria-label="Block" className={sel} value={block ?? ''} onChange={(e) => set('block', e.target.value)}><option value="">All blocks</option>{graph.data?.blocks.map((b) => <option key={b.index} value={b.index}>{b.name}</option>)}</select>
        <select aria-label="Seen" className={sel} value={seen ?? ''} onChange={(e) => set('seen', e.target.value)}><option value="">Seen or not</option><option value="unseen">Not seen yet</option><option value="seen">Seen in a session</option></select>
      </div>

      {resources.isPending && <SkeletonCard lines={8} />}
      {resources.isError && <ErrorState error={resources.error} onRetry={() => void resources.refetch()} />}
      {resources.data && shown.length === 0 && <Card><EmptyState title="No resources match" description="Try clearing a filter or the search box." action={<Button variant="secondary" size="sm" onClick={() => setParams({}, { replace: true })}>Clear filters</Button>} /></Card>}

      {shown.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((g) => (
            <Card key={g.key} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge tone={g.kind === 'video' ? 'primary' : 'accent'}>{g.kind === 'video' ? <PlayCircle className="size-3.5" aria-hidden /> : <BookOpenText className="size-3.5" aria-hidden />}{g.kind === 'video' ? 'Video' : 'Documentation'}</Badge>
                  {g.seen && <Badge tone="good"><CheckCircle2 className="size-3.5" aria-hidden />Seen</Badge>}
                </div>
                <h3 className="font-semibold leading-snug">{g.title}</h3>
                <p className="mt-0.5 text-xs text-muted">{g.source}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Covers</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">{g.concepts.map((c) => <li key={c} className="rounded-full bg-raised px-2.5 py-0.5 text-xs">{c}</li>)}</ul>
                <div className="mt-auto flex items-center gap-2 pt-4">
                  <span className="size-2 rounded-full" style={{ background: BLOCK_COLORS[g.blockIndex] }} aria-hidden /><span className="text-xs text-muted">{graph.data?.blocks[g.blockIndex]?.name}</span>
                  {g.kind === 'video'
                    ? <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setPreview(g)} icon={<PlayCircle className="size-4" />}>Preview</Button>
                    : <a href={g.url} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong px-3 text-sm font-semibold hover:bg-raised">Open <ExternalLink className="size-3.5" aria-hidden /></a>}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)} title={preview?.title ?? ''} className="md:max-w-2xl">
        {preview && <VideoPlayer title={preview.title} url={preview.url} source={preview.source} />}
      </Dialog>
    </div>
  )
}
