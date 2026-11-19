import { BrainCircuit, House, Menu, UserRound } from 'lucide-react'
import { motion } from 'motion/react'
import { Link, useNavigate } from 'react-router-dom'
import { Wordmark } from '@/components/brand/BrandMark'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { ROUTES } from '@/constants/routes'

const LINKS = [
  { label: 'How It Works', href: `${ROUTES.landing}#how-it-works`, hash: true },
  { label: 'Features', href: '#features', hash: true },
  { label: 'About', href: ROUTES.landing, hash: false },
  { label: 'Contact', href: ROUTES.help, hash: false },
] as const

const linkClass = 'nt-navlink rounded-lg px-3.5 py-2 text-[15px] font-medium text-slate-300 transition-colors hover:text-white'

/** The floating glass navigation bar of the welcome page. Collapses into a menu on small screens. */
export function WelcomeNav({ signedIn }: { signedIn: boolean }) {
  const navigate = useNavigate()
  const account = signedIn ? { label: 'Dashboard', to: ROUTES.dashboard } : { label: 'Sign In', to: ROUTES.login }
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-3 z-40 mx-auto w-full max-w-[1480px] px-3 sm:px-6 lg:px-12"
    >
      <div className="nt-navbar flex h-[68px] items-center gap-3 px-4 sm:px-6">
        <Link to={ROUTES.root} className="group flex items-center gap-2.5 rounded-lg" aria-label="NeuroTutor home">
          <BrainCircuit className="size-8 text-cyan-300 sm:size-9 drop-shadow-[0_0_10px_rgb(34_211_238_/_0.8)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" strokeWidth={1.5} aria-hidden />
          <Wordmark className="text-xl tracking-tight text-white sm:text-[1.6rem] [&>span]:text-sky-400" />
        </Link>

        <nav aria-label="Site" className="ml-auto hidden items-center gap-1 md:flex lg:absolute lg:left-1/2 lg:ml-0 lg:-translate-x-1/2">
          <Link to={ROUTES.root} aria-current="page" className="nt-navpill flex items-center gap-2 rounded-xl px-4 py-2 text-[15px] font-semibold text-white"><House className="size-4" aria-hidden />Home</Link>
          {LINKS.map((l) => l.hash
            ? <a key={l.label} href={l.href} className={linkClass}>{l.label}</a>
            : <Link key={l.label} to={l.href} className={linkClass}>{l.label}</Link>)}
        </nav>

        <Link to={account.to} className="ml-auto flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-indigo-300/50 bg-white/[0.03] px-4 text-[15px] font-semibold text-white transition-all hover:border-indigo-200 hover:bg-indigo-500/20 hover:shadow-[0_0_24px_-6px_rgb(129_140_248)] md:ml-0 lg:ml-auto">
          <UserRound className="size-4" aria-hidden />{account.label}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Open menu" className="flex size-11 items-center justify-center rounded-xl border border-indigo-300/30 text-white transition-colors hover:bg-indigo-500/20 md:hidden">
            <Menu className="size-5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="dark min-w-52">
            <DropdownMenuItem onSelect={() => navigate(ROUTES.root)}><House className="size-4" aria-hidden />Home</DropdownMenuItem>
            {LINKS.map((l) => (
              <DropdownMenuItem key={l.label} onSelect={() => (l.hash ? (window.location.href = l.href) : navigate(l.href))}>{l.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  )
}
