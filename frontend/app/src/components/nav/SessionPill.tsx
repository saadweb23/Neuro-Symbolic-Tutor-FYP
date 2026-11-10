import { PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useGraph, useSession } from '@/api/queries/hooks'
import { useStudentId } from '@/app/providers/StudentProvider'
import { ROUTES } from '@/constants/routes'

/** Shows the active learning session (block + round) anywhere in the app and links back into it.
 *  Reads GET /session -- a read-only endpoint -- never /next. */
export function SessionPill() {
  const id = useStudentId()
  const session = useSession(id)
  const graph = useGraph()
  if (!session.data?.active) return null
  const name = graph.data?.blocks[session.data.block_index]?.name ?? 'Session'
  return (
    <Link
      to={ROUTES.session}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3 text-xs font-semibold text-primary transition-colors hover:border-primary/60 sm:text-sm"
    >
      <PlayCircle className="size-4" aria-hidden />
      <span className="max-w-32 truncate">{name}</span>
      <span className="text-primary/70">
        · round {session.data.round_count}/{session.data.round_cap}
      </span>
    </Link>
  )
}
