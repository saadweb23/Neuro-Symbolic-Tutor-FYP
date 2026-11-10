import { useEffect } from 'react'
import { useMatches } from 'react-router-dom'

/** Sets document.title from the deepest matched route's `handle.title` (screen-reader users hear it on navigation). */
export function useDocumentTitle() {
  const matches = useMatches()
  const title = [...matches].reverse().map((m) => (m.handle as { title?: string } | undefined)?.title).find(Boolean)
  useEffect(() => {
    document.title = title && title !== 'NeuroTutor' ? `${title} · NeuroTutor` : 'NeuroTutor · adaptive Python tutor'
  }, [title])
  return title
}
