import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { ApiError } from '@/api/client'
import { fetchMeta, fetchStatus } from '@/api/queries/hooks'
import { keys } from '@/api/queries/keys'
import type { Meta } from '@/api/types'
import { AnimatedCubeLogo, Wordmark } from '@/components/brand/AnimatedCubeLogo'
import { Button } from '@/components/ui/Button'
import { safeStorage, STORAGE_KEYS } from '@/constants/storage'
import { MetaProvider } from '../providers/MetaProvider'

type Stage = 'app' | 'server' | 'profile'
const STAGE_TEXT: Record<Stage, string> = {
  app: 'Loading app',
  server: 'Contacting the tutoring engine',
  profile: 'Loading your profile',
}

// Boot timing rules (see the architecture blueprint):
//  - first load in a browser tab session: the full intro, at least FIRST_MIN_MS
//  - later reloads in the same tab: the overlay only appears if boot is slower than QUICK_DELAY_MS,
//    and once shown stays at least RELOAD_MIN_MS (no flicker)
//  - client-side route changes never come through here
const FIRST_MIN_MS = 1400
const RELOAD_MIN_MS = 700
const QUICK_DELAY_MS = 250
const SLOW_AFTER_MS = 4000
const FAIL_AFTER_MS = 60_000
const RETRY_EVERY_MS = 1500

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function BootGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [overlay, setOverlay] = useState(false)
  const [stage, setStage] = useState<Stage>('app')
  const [slow, setSlow] = useState(false)
  const [failed, setFailed] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const sameTabReload = !!safeStorage.get(STORAGE_KEYS.booted, sessionStorage)
    const root = document.documentElement
    const started = performance.now()
    let shownAt: number | null = null
    setFailed(null)
    setSlow(false)

    const showOverlay = () => {
      if (cancelled || shownAt !== null) return
      shownAt = performance.now()
      setOverlay(true)
      root.classList.remove('nt-quick')
      document.getElementById('nt-splash')?.remove() // React's identical overlay takes over
    }
    let quickTimer: ReturnType<typeof setTimeout> | undefined
    if (sameTabReload) quickTimer = setTimeout(showOverlay, QUICK_DELAY_MS)
    else showOverlay()
    const slowTimer = setTimeout(() => !cancelled && setSlow(true), SLOW_AFTER_MS)

    ;(async () => {
      const fonts = Promise.race([document.fonts?.ready ?? Promise.resolve(), sleep(1200)])
      setStage('server')
      let loaded: Meta | null = null
      let lastError: unknown = null
      while (!cancelled && !loaded) {
        try {
          loaded = await qc.fetchQuery({ queryKey: keys.meta, queryFn: fetchMeta, staleTime: 0 })
        } catch (err) {
          lastError = err
          if (performance.now() - started > FAIL_AFTER_MS) {
            if (!cancelled) {
              showOverlay()
              setFailed(lastError ?? new ApiError('The server did not respond.', 0, 'network'))
            }
            return
          }
          await sleep(RETRY_EVERY_MS)
        }
      }
      if (cancelled || !loaded) return

      const stored = safeStorage.get(STORAGE_KEYS.currentStudent)
      if (stored) {
        setStage('profile')
        // Warm the cache for the router guards; a failure here is handled by the guards themselves.
        await qc.prefetchQuery({ queryKey: keys.status(stored), queryFn: () => fetchStatus(stored) }).catch(() => undefined)
      }
      await fonts
      if (cancelled) return

      if (shownAt !== null) {
        const min = sameTabReload ? RELOAD_MIN_MS : FIRST_MIN_MS
        const remaining = min - (performance.now() - shownAt)
        if (remaining > 0) await sleep(remaining)
      }
      if (cancelled) return
      clearTimeout(quickTimer)
      safeStorage.set(STORAGE_KEYS.booted, '1', sessionStorage)
      root.classList.remove('nt-quick')
      document.getElementById('nt-splash')?.remove()
      setMeta(loaded)
      setOverlay(false)
    })()

    return () => {
      cancelled = true
      clearTimeout(slowTimer)
      clearTimeout(quickTimer)
    }
  }, [qc, attempt])

  return (
    <>
      {meta && <MetaProvider meta={meta}>{children}</MetaProvider>}
      <AnimatePresence>
        {overlay && (
          <motion.div
            key="boot"
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-bg pb-2"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.03, transition: { duration: 0.4, ease: 'easeOut' } }}
          >
            <AnimatedCubeLogo size={96} className="mb-[30px]" />
            <motion.div exit={{ scale: 0.9, opacity: 0, transition: { duration: 0.3 } }} className="text-[22px]">
              <Wordmark className="text-[22px] font-semibold" />
            </motion.div>
            <div className="flex h-11 w-64 flex-col items-center gap-3 text-center">
              {failed ? (
                <>
                  <p className="text-sm text-bad">The tutoring engine isn&apos;t responding.</p>
                  <Button size="sm" variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
                    Try again
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    {slow && stage === 'server'
                      ? 'Waking the tutoring engine. The first start can take up to 40 seconds.'
                      : `${STAGE_TEXT[stage]}…`}
                  </p>
                  <div className="nt-indeterminate h-1 w-40 rounded-full bg-raised" aria-hidden />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
