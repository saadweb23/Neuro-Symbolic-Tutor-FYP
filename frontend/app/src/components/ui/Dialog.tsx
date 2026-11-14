import * as RD from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: ReactNode
  /** "sheet" slides from the bottom on small screens */
  variant?: 'dialog' | 'sheet'
  className?: string
}

export function Dialog({ open, onOpenChange, title, description, children, variant = 'dialog', className }: DialogProps) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="nt-overlay fixed inset-0 z-[110] bg-black/50" />
        <RD.Content
          className={cn(
            'nt-dialog fixed z-[111] flex max-h-[88svh] flex-col overflow-hidden border border-border bg-surface shadow-overlay',
            variant === 'sheet'
              ? 'nt-dialog-sheet inset-x-0 bottom-0 rounded-t-xl md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl'
              : 'left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div className="min-w-0">
              <RD.Title className="text-lg font-semibold">{title}</RD.Title>
              {description ? (
                <RD.Description className="mt-1 text-sm text-muted">{description}</RD.Description>
              ) : (
                <RD.Description className="sr-only">{title}</RD.Description>
              )}
            </div>
            <RD.Close aria-label="Close" className="rounded-md p-1 text-muted hover:bg-raised hover:text-text">
              <X className="size-5" />
            </RD.Close>
          </div>
          <div className="overflow-y-auto p-5">{children}</div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}

interface ConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  destructive?: boolean
  loading?: boolean
}

export function ConfirmationDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Cancel', onConfirm, destructive, loading }: ConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
