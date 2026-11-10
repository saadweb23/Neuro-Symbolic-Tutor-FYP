import { useGraph } from '@/api/queries/hooks'
import { ErrorState } from '@/components/feedback/ErrorState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import type { Beliefs } from '@/api/types'
import { BLOCK_COLORS } from '@/lib/tiers'
import { ConceptTile } from './ConceptTile'

/** All 25 concepts grouped by curriculum block (the block structure comes from GET /graph). */
export function ConceptMap({ beliefs, attempts, onSelect, selected }: {
  beliefs: Beliefs
  attempts?: Record<string, number>
  onSelect?: (concept: string) => void
  selected?: string | null
}) {
  const graph = useGraph()
  if (graph.isPending) return <SkeletonCard lines={6} />
  if (graph.isError) return <ErrorState error={graph.error} onRetry={() => graph.refetch()} compact />
  return (
    <div className="space-y-6">
      {graph.data.blocks.map((block) => (
        <section key={block.index} aria-label={block.name}>
          <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
            <span className="size-2.5 rounded-full" style={{ background: BLOCK_COLORS[block.index] }} aria-hidden />
            {block.name}
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {block.concepts.map((c) => (
              <ConceptTile
                key={c}
                concept={c}
                belief={beliefs[c] ?? 0}
                attempts={attempts?.[c]}
                selected={selected === c}
                onClick={onSelect ? () => onSelect(c) : undefined}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
