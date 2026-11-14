import { ArrowRight, Compass, ScanSearch, Target } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStatus } from '@/api/queries/hooks'
import { useStudentContext } from '@/app/providers/StudentProvider'
import { BrandMark, Wordmark } from '@/components/brand/BrandMark'
import { ThemeToggle } from '@/components/nav/ThemeToggle'
import { Magnetic } from '@/components/motion/Magnetic'
import { TiltCard } from '@/components/motion/TiltCard'
import { ROUTES } from '@/constants/routes'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSpotlight } from '@/hooks/useSpotlight'
import { FloatingBackdrop } from './FloatingBackdrop'

const rise: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.15 + i * 0.14, ease: [0.22, 1, 0.36, 1] } }),
}

const PILLARS = [
  { icon: Compass, title: 'Discover your strengths', text: 'A short placement quiz maps what you already know.' },
  { icon: ScanSearch, title: 'Identify knowledge gaps', text: 'Mastery is tracked concept by concept, with the reason behind each estimate.' },
  { icon: Target, title: 'Follow an intelligent journey', text: 'Every next step is chosen around your abilities, not a fixed syllabus.' },
]

/** The site's front door: introduces the platform and leads into the placement quiz. */
export function WelcomePage() {
  useDocumentTitle()
  useSpotlight()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const { studentId, user } = useStudentContext()
  const status = useStatus(studentId)
  const [leaving, setLeaving] = useState(false)

  // Someone who already finished placement continues learning; the quiz cannot be retaken.
  const placed = status.data?.placement_completed === true
  const target = placed ? ROUTES.dashboard : ROUTES.placement
  const go = () => {
    if (leaving) return
    if (reduce) return void navigate(target)
    setLeaving(true)   // exit animation, then navigate (onAnimationComplete below)
  }

  return (
    <motion.div
      className="min-h-svh bg-bg"
      initial={false}
      animate={leaving ? { opacity: 0, scale: 1.04, filter: 'blur(6px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={() => { if (leaving) navigate(target) }}
    >
      <FloatingBackdrop className="flex min-h-svh flex-col">
        <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 md:px-6">
          <Link to={ROUTES.root} className="flex items-center gap-2.5" aria-label="NeuroTutor home">
            <BrandMark size={28} />
            <Wordmark />
          </Link>
          <nav aria-label="Site" className="ml-auto flex items-center gap-2 sm:gap-4 text-sm font-medium">
            <Link to={ROUTES.landing} className="hidden rounded-md px-2 py-1.5 text-muted transition-colors hover:text-text sm:block">How it works</Link>
            <Link to={user ? ROUTES.dashboard : ROUTES.login} className="rounded-md px-2 py-1.5 text-muted transition-colors hover:text-text">{user ? 'Dashboard' : 'Sign in'}</Link>
            <ThemeToggle />
          </nav>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-16 pt-8 text-center outline-none md:px-6">
          <motion.p custom={0} variants={rise} initial="hidden" animate="show" className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3.5 py-1 text-xs font-semibold text-muted shadow-card backdrop-blur">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden /> Personalised · Neuro-symbolic · Adaptive
          </motion.p>

          <motion.h1 custom={1} variants={rise} initial="hidden" animate="show" className="mt-6 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl md:text-7xl">
            Welcome to <span className="nt-gradient-text">Neuro Symbolic Tutor</span>
          </motion.h1>

          <motion.p custom={2} variants={rise} initial="hidden" animate="show" className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted md:text-xl">
            Your personalized AI-powered learning companion. Discover your strengths, identify knowledge gaps, and follow an intelligent learning journey designed around your abilities.
          </motion.p>

          <motion.div custom={3} variants={rise} initial="hidden" animate="show" className="mt-10 flex flex-col items-center gap-3">
            <Magnetic strength={0.22}>
              <motion.button
                type="button"
                onClick={go}
                whileHover={reduce ? undefined : { scale: 1.04 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="nt-btn-primary group relative inline-flex h-14 items-center gap-3 rounded-full px-8 text-lg font-bold text-on-primary"
              >
                <span className="absolute inset-0 -z-10 rounded-full bg-primary/40 blur-xl transition-opacity group-hover:opacity-100" aria-hidden />
                {placed ? 'Continue Learning' : 'Take Placement Quiz'}
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
              </motion.button>
            </Magnetic>
            <p className="text-sm text-muted">
              {placed ? 'You have already completed your placement quiz.' : user ? 'About 5 minutes. It sets your starting point.' : 'You will sign in first, then start your placement quiz.'}
            </p>
          </motion.div>

          <motion.ul custom={4} variants={rise} initial="hidden" animate="show" className="mt-16 grid w-full max-w-4xl gap-4 text-left sm:grid-cols-3">
            {PILLARS.map((p) => (
              <li key={p.title}>
                <TiltCard className="h-full">
                  <div data-spotlight="" className="nt-card nt-lift h-full rounded-xl border border-border bg-surface/75 p-5 shadow-card backdrop-blur-sm">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary"><p.icon className="size-5" aria-hidden /></span>
                    <h2 className="mt-4 text-base font-semibold">{p.title}</h2>
                    <p className="mt-1 text-sm text-muted">{p.text}</p>
                  </div>
                </TiltCard>
              </li>
            ))}
          </motion.ul>
        </main>
      </FloatingBackdrop>
    </motion.div>
  )
}
