import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Magnetic } from '@/components/motion/Magnetic'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'nt-btn-primary bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'bg-surface text-text border border-border-strong hover:bg-raised',
  ghost: 'text-text hover:bg-raised',
  danger: 'bg-bad text-white hover:opacity-90',
}
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export const buttonStyles = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) =>
  cn(
    'nt-btn inline-flex select-none items-center justify-center rounded-md font-semibold',
    'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  )

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  /** the button drifts toward the cursor (use on one main call to action per view) */
  magnetic?: boolean
}

export function Button({ variant, size, loading, icon, className, children, disabled, magnetic, type = 'button', ...rest }: ButtonProps) {
  const button = (
    <button type={type} className={buttonStyles(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
  return magnetic && !disabled && !loading ? <Magnetic>{button}</Magnetic> : button
}

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  magnetic?: boolean
}

export function LinkButton({ variant, size, icon, className, children, magnetic, ...rest }: LinkButtonProps) {
  const link = (
    <Link className={buttonStyles(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  )
  return magnetic ? <Magnetic>{link}</Magnetic> : link
}
