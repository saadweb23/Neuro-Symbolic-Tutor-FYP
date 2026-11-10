import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { usePreferences, type ThemePref } from '@/app/providers/PreferencesProvider'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = usePreferences()
  const Icon = resolvedTheme === 'dark' ? Moon : Sun
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Theme: ${theme}. Change theme`}
        className="inline-flex size-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-raised hover:text-text"
      >
        <Icon className="size-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-40">
        {OPTIONS.map(({ value, label, icon: I }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
            <I className="size-4" aria-hidden />
            <span className="flex-1">{label}</span>
            {theme === value && <Check className="size-4 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
