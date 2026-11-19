import { Check, House, Menu, UserRound } from 'lucide-react'
import { motion } from 'motion/react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandMark, Wordmark } from '@/components/brand/BrandMark'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { ROUTES } from '@/constants/routes'
import { ThemeSwitcher } from './ThemeSwitcher'
import { THEMES, type WelcomeTheme } from './useWelcomeTheme'

const LINKS = [
  { label: 'How It Works', href: `${ROUTES.landing}#how-it-works`, hash: true },
  { label: 'Features', href: '#features', hash: true },
  { label: 'About', href: ROUTES.landing, hash: false },
  { label: 'Contact', href: ROUTES.help, hash: false },
] as const

const linkClass = 'nt-navlink rounded-lg px-3.5 py-2 text-[15px] font-medium transition-colors'

interface Props {
  signedIn: boolean
  theme: WelcomeTheme
  onTheme: (t: WelcomeTheme) => void
  /** token scope classes for the portalled menu, so it follows the active theme */
  scope: string
}

/** The floating glass navigation bar of the welcome page. Links collapse into a menu below 1280px, and the
 *  full product name stays on one line down to phone widths. */
export function WelcomeNav({ signedIn, theme, onTheme, scope }: Props) {
  const navigate = useNavigate()
  const account = signedIn ? { label: 'Dashboard', to: ROUTES.dashboard } : { label: 'Sign In', to: ROUTES.login }
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-3 z-40 mx-auto w-full max-w-[1480px] px-3 sm:px-6 lg:px-12"
    >
      <div className="nt-navbar relative flex h-[64px] items-center gap-2 px-3 sm:h-[68px] sm:gap-3 sm:px-6">
        <Link to={ROUTES.root} className="group flex min-w-0 items-center gap-2 rounded-lg sm:gap-2.5" aria-label="Neuro Symbolic Tutor home">
          <span className="shrink-0 drop-shadow-[0_0_12px_rgb(var(--w-glow)_/_0.7)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"><BrandMark size={36} /></span>
          <Wordmark className="truncate text-[15px] text-[color:var(--w-text)] sm:text-xl xl:text-[1.4rem] [&>span]:text-[color:var(--w-c)]" />
        </Link>

        <nav aria-label="Site" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 xl:flex">
          <Link to={ROUTES.root} aria-current="page" className="nt-navpill flex items-center gap-2 rounded-xl px-4 py-2 text-[15px] font-semibold"><House className="size-4" aria-hidden />Home</Link>
          {LINKS.map((l) => l.hash
            ? <a key={l.label} href={l.href} className={linkClass}>{l.label}</a>
            : <Link key={l.label} to={l.href} className={linkClass}>{l.label}</Link>)}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden md:block"><ThemeSwitcher theme={theme} onChange={onTheme} /></div>

          <Link to={account.to} aria-label={account.label} className="nt-wbtn flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-[15px] font-semibold sm:h-11 sm:px-4">
            <UserRound className="size-4" aria-hidden /><span className="hidden sm:inline">{account.label}</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Open menu" className="nt-wbtn flex size-10 items-center justify-center rounded-xl sm:size-11 xl:hidden">
              <Menu className="size-5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent className={`${scope} min-w-56`}>
              <DropdownMenuItem onSelect={() => navigate(ROUTES.root)}><House className="size-4" aria-hidden />Home</DropdownMenuItem>
              {LINKS.map((l) => (
                <DropdownMenuItem key={l.label} onSelect={() => (l.hash ? (window.location.href = l.href) : navigate(l.href))}>{l.label}</DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              {THEMES.map((t) => (
                <DropdownMenuItem key={t.id} onSelect={() => onTheme(t.id)}>
                  <t.icon className="size-4" aria-hidden />{t.label}{t.id === theme && <Check className="ml-auto size-4" aria-hidden />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>
  )
}
