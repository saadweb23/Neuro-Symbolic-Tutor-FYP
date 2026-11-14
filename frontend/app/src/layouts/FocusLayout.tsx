import { Outlet, useLocation } from 'react-router-dom'
import { PageTransition } from '@/components/motion/PageTransition'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSpotlight } from '@/hooks/useSpotlight'
import { SkipLink } from './AppShell'

/** Distraction-free frame for Placement, its results and the Learning Workspace: no sidebar,
 *  no tab bar. Each focus page renders its own slim header (with a clear way out). */
export function FocusLayout() {
  useDocumentTitle()
  useSpotlight()
  const { pathname } = useLocation()
  return (
    <div className="min-h-svh bg-bg">
      <SkipLink />
      <main id="main" tabIndex={-1} className="outline-none">
        <PageTransition routeKey={pathname}>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  )
}
