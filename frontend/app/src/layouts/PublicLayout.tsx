import { Link, Outlet } from 'react-router-dom'
import { BrandMark, Wordmark } from '@/components/brand/BrandMark'
import { ThemeToggle } from '@/components/nav/ThemeToggle'
import { LinkButton } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSpotlight } from '@/hooks/useSpotlight'
import { SkipLink } from './AppShell'

export function PublicHeader() {
  return (
    <header className="nt-glass sticky top-0 z-30 border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
        <Link to={ROUTES.root} className="group flex items-center gap-2.5" aria-label="NeuroTutor home">
          <BrandMark size={26} />
          <Wordmark />
        </Link>
        <nav aria-label="Site" className="ml-6 hidden items-center gap-5 text-sm font-medium text-muted md:flex">
          <a href={`${ROUTES.landing}#how-it-works`} className="hover:text-text">How it works</a>
          <a href={`${ROUTES.landing}#curriculum`} className="hover:text-text">Curriculum</a>
          <Link to={ROUTES.help} className="hover:text-text">Help</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <LinkButton to={ROUTES.start} size="sm">Sign in</LinkButton>
        </div>
      </div>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-2.5">
          <BrandMark size={20} />
          <span>NeuroTutor, a neuro-symbolic Python tutor (final-year project).</span>
        </div>
        <nav aria-label="Footer" className="flex gap-5">
          <Link to={ROUTES.help} className="hover:text-text">Help</Link>
          <Link to={ROUTES.start} className="hover:text-text">Sign in</Link>
          <a href="https://github.com/saadweb23/Neuro-Symbolic-Tutor-FYP" className="hover:text-text" target="_blank" rel="noreferrer">Source code</a>
        </nav>
      </div>
    </footer>
  )
}

export function PublicLayout() {
  useDocumentTitle()
  useSpotlight()
  return (
    <div className="flex min-h-svh flex-col bg-bg">
      <SkipLink />
      <PublicHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
