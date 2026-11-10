import { useEffect, useState } from 'react'
import { Link, Outlet, useMatches, useNavigation } from 'react-router-dom'
import { AnimatedCubeLogo, Wordmark } from '@/components/brand/AnimatedCubeLogo'
import { MobileNavigation } from '@/components/nav/MobileNavigation'
import { SessionPill } from '@/components/nav/SessionPill'
import { Sidebar } from '@/components/nav/Sidebar'
import { StudentMenu } from '@/components/nav/StudentMenu'
import { ThemeToggle } from '@/components/nav/ThemeToggle'
import { ROUTES } from '@/constants/routes'
import { safeStorage, STORAGE_KEYS } from '@/constants/storage'
import { cn } from '@/lib/cn'

export interface RouteHandle {
  title?: string
}

function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => {
    const stored = safeStorage.get(STORAGE_KEYS.sidebarCollapsed)
    // default: expanded on large desktops, icon rail on tablets
    return stored !== null ? stored === 'true' : window.innerWidth < 1280
  })
  const toggle = () =>
    setCollapsed((c) => {
      safeStorage.set(STORAGE_KEYS.sidebarCollapsed, String(!c))
      return !c
    })
  return [collapsed, toggle]
}

/** Thin progress bar while a lazily-loaded route is being fetched (replaces any full-screen loader). */
function NavigationProgress() {
  const navigation = useNavigation()
  if (navigation.state === 'idle') return null
  return <div className="nt-indeterminate fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent" role="progressbar" aria-label="Loading page" />
}

export function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Skip to content
    </a>
  )
}

/** Desktop: collapsible sidebar. Tablet: icon rail. Phone: bottom tab bar. */
export function AppShell() {
  const [collapsed, toggle] = useCollapsed()
  const matches = useMatches()
  const title = [...matches].reverse().map((m) => (m.handle as RouteHandle | undefined)?.title).find(Boolean)

  useEffect(() => {
    document.title = title ? `${title} · NeuroTutor` : 'NeuroTutor'
  }, [title])

  return (
    <div className="min-h-svh bg-bg">
      <SkipLink />
      <NavigationProgress />
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className={cn('transition-[padding] duration-200', collapsed ? 'md:pl-[72px]' : 'md:pl-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur md:px-6">
          <Link to={ROUTES.dashboard} className="group flex items-center gap-2.5 md:hidden" aria-label="NeuroTutor home">
            <AnimatedCubeLogo size={24} motion="hover" bare />
            <Wordmark className="text-base" />
          </Link>
          <h1 className="hidden truncate text-lg font-semibold md:block">{title}</h1>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <SessionPill />
            <ThemeToggle />
            <StudentMenu />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 outline-none md:px-6 md:pb-12 md:pt-8">
          <Outlet />
        </main>
      </div>
      <MobileNavigation />
    </div>
  )
}
