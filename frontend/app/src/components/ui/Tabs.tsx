import * as RTabs from '@radix-ui/react-tabs'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export const Tabs = RTabs.Root

export function TabsList({ className, ...rest }: ComponentProps<typeof RTabs.List>) {
  return <RTabs.List className={cn('inline-flex gap-1 rounded-lg bg-raised p-1', className)} {...rest} />
}

export function TabsTrigger({ className, ...rest }: ComponentProps<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cn(
        'rounded-md px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:text-text',
        'data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-card',
        className,
      )}
      {...rest}
    />
  )
}

export const TabsContent = RTabs.Content
