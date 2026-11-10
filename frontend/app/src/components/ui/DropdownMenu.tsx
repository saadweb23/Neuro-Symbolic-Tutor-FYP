import * as RM from '@radix-ui/react-dropdown-menu'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const DropdownMenu = RM.Root
export const DropdownMenuTrigger = RM.Trigger
export const DropdownMenuLabel = ({ className, ...rest }: ComponentProps<typeof RM.Label>) => (
  <RM.Label className={cn('px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted', className)} {...rest} />
)
export const DropdownMenuSeparator = () => <RM.Separator className="my-1 h-px bg-border" />

export function DropdownMenuContent({ className, children, align = 'end', ...rest }: ComponentProps<typeof RM.Content> & { children: ReactNode }) {
  return (
    <RM.Portal>
      <RM.Content
        align={align}
        sideOffset={8}
        className={cn('z-[120] min-w-56 rounded-lg border border-border bg-surface p-1.5 shadow-overlay', className)}
        {...rest}
      >
        {children}
      </RM.Content>
    </RM.Portal>
  )
}

export function DropdownMenuItem({ className, ...rest }: ComponentProps<typeof RM.Item>) {
  return (
    <RM.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none',
        'data-[highlighted]:bg-raised data-[disabled]:opacity-50',
        className,
      )}
      {...rest}
    />
  )
}
