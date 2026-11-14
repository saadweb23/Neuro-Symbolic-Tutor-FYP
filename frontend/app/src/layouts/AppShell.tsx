import { motion } from 'motion/react'
import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigation } from 'react-router-dom'
import { PageTransition } from '@/components/motion/PageTransition'
import { ScrollProgress } from '@/components/motion/ScrollProgress'
import { useSpotlight } from '@/hooks/useSpotlight'
import { BrandMark, Wordmark } from '@/components/brand/BrandMark'
import { MobileNavigation } from '@/components/nav/MobileNavigation'
import { SessionPill } from '@/components/nav/SessionPill'
import { Sidebar } from '@/components/nav/Sidebar'
import { StudentMenu } from '@/components/nav/StudentMenu'
import { ThemeToggle } from '@/components/nav/ThemeToggle'
import { ROUTES } from '@/constants/routes'
import { safeStorage, STORAGE_KEYS } from '@/constants/storage'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
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
  const title = useDocumentTitle()
  const { pathname } = useLocation()
  useSpotlight()

  return (
    <div className="min-h-svh bg-bg">
      <SkipLink />
      <NavigationProgress />
      <ScrollProgress />
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className={cn('transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]', collapsed ? 'md:pl-[72px]' : 'md:pl-64')}>
        <motion.header
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="nt-glass sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border px-4 md:px-6"
        >
          <Link to={ROUTES.dashboard} className="group flex items-center gap-2.5 md:hidden" aria-label="NeuroTutor home">
            <BrandMark size={24} />
            <Wordmark className="text-base" />
          </Link>
          <p aria-hidden className="hidden truncate text-lg font-semibold md:block">{title}</p>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <SessionPill />
            <ThemeToggle />
            <StudentMenu />
          </div>
        </motion.header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 outline-none md:px-6 md:pb-12 md:pt-8">
          <PageTransition routeKey={pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      <MobileNavigation />
    </div>
  )
}
