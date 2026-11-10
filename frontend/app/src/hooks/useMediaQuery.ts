import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = globalThis.matchMedia?.(query)
      mq?.addEventListener('change', notify)
      return () => mq?.removeEventListener('change', notify)
    },
    () => globalThis.matchMedia?.(query).matches ?? false,
    () => false,
  )
}
