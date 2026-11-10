import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}
interface ToastApi {
  show: (message: string, kind?: ToastKind) => void
}

const Ctx = createContext<ToastApi | null>(null)
const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info }
const TONES: Record<ToastKind, string> = {
  success: 'text-good',
  error: 'text-bad',
  info: 'text-primary',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((p) => p.filter((t) => t.id !== id)), [])
  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current++
      setItems((p) => [...p.slice(-3), { id, kind, message }])
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )
  const api = useMemo(() => ({ show }), [show])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[120] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
      >
        {items.map((t) => {
          const Icon = ICONS[t.kind]
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-surface p-3 text-sm shadow-overlay"
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', TONES[t.kind])} aria-hidden />
              <p className="flex-1">{t.message}</p>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="text-muted hover:text-text">
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast must be used inside <ToastProvider>')
  return v
}
