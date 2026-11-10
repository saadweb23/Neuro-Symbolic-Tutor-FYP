import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'h-11 w-full rounded-md border bg-surface px-3.5 text-[15px] text-text placeholder:text-muted/70',
        'transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
        invalid ? 'border-bad' : 'border-border-strong',
        className,
      )}
      {...rest}
    />
  )
}
