import { ArrowRight, Compass, ScanSearch, Target } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStatus } from '@/api/queries/hooks'
import { useStudentContext } from '@/app/providers/StudentProvider'
import { BrandMark, Wordmark } from '@/components/brand/BrandMark'
import { Magnetic } from '@/components/motion/Magnetic'
import { Stagger, StaggerItem } from '@/components/motion/Stagger'
import { TiltCard } from '@/components/motion/TiltCard'
import { Typewriter, type Phrase } from '@/components/motion/Typewriter'
import { ROUTES } from '@/constants/routes'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSpotlight } from '@/hooks/useSpotlight'
import { FloatingBackdrop } from './FloatingBackdrop'

const rise: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.1 + i * 0.14, ease: [0.22, 1, 0.36, 1] } }),
}

/** The hero cycles through these; the highlighted words take the purple-blue gradient. */
const PHRASES: Phrase[] = [
  [{ text: 'Welcome to ' }, { text: 'NeuroTutor', highlight: true }],
  [{ text: 'Learn ' }, { text: 'Smarter', highlight: true }, { text: ' with AI' }],
  [{ text: 'Your Personal ' }, { text: 'AI Learning', highlight: true }, { text: ' Companion' }],
  [{ text: 'Discover Your ' }, { text: 'Learning Potential', highlight: true }],
  [{ text: 'Intelligence', highlight: true }, { text: ' Meets Personalized Learning' }],
]

const PILLARS = [
  { icon: Compass, title: 'Discover Your Strengths', text: 'A short placement quiz maps what you already know, concept by concept.' },
  { icon: ScanSearch, title: 'Identify Knowledge Gaps', text: 'Mastery is tracked on a prerequisite graph, with the reason behind every estimate.' },
  { icon: Target, title: 'Follow an Intelligent Journey', text: 'Every next step is chosen around your abilities, not a fixed syllabus.' },
]

/** The site's front door: introduces the platform and leads into the placement quiz. Always rendered in the
 *  dark navy theme (the `dark` class scopes the design tokens to this page). */
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
      className="dark min-h-svh bg-bg text-text"
      initial={false}
      animate={leaving ? { opacity: 0, scale: 1.04, filter: 'blur(6px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={() => { if (leaving) navigate(target) }}
    >
      <FloatingBackdrop rich className="flex min-h-svh flex-col">
        <motion.header
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="nt-glass sticky top-0 z-40 border-b border-white/[0.06]"
        >
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 md:px-6">
            <Link to={ROUTES.root} className="group flex items-center gap-2.5 rounded-lg" aria-label="NeuroTutor home">
              <span className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"><BrandMark size={28} /></span>
              <Wordmark className="transition-opacity group-hover:opacity-90" />
            </Link>
            <nav aria-label="Site" className="ml-auto flex items-center gap-1 text-sm font-medium sm:gap-2">
              <Link to={ROUTES.landing} className="nt-navlink hidden rounded-md px-3 py-2 text-muted transition-colors hover:text-text sm:block">How it works</Link>
              <Link to={user ? ROUTES.dashboard : ROUTES.login} className="nt-navlink rounded-md px-3 py-2 text-muted transition-colors hover:text-text">{user ? 'Dashboard' : 'Sign in'}</Link>
            </nav>
          </div>
        </motion.header>

        {/* ------------------------------------------------------------ hero */}
        <main id="main" tabIndex={-1} className="outline-none">
          <section className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-5xl flex-col items-center justify-center px-4 pb-20 pt-10 text-center md:px-6">
            <motion.p custom={0} variants={rise} initial="hidden" animate="show" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-medium tracking-wide text-muted backdrop-blur">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden /> Neuro-Symbolic Adaptive Learning Platform
            </motion.p>

            <motion.h1 custom={1} variants={rise} initial="hidden" animate="show" className="mt-7 w-full text-balance text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-6xl md:text-7xl">
              <span className="sr-only">NeuroTutor: a neuro-symbolic adaptive learning platform</span>
              <Typewriter phrases={PHRASES} />
            </motion.h1>

            <motion.p custom={2} variants={rise} initial="hidden" animate="show" className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-muted md:text-xl">
              Your personalized AI-powered learning companion. Discover your strengths, identify knowledge gaps, and follow an intelligent learning journey designed around your abilities.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 flex flex-col items-center gap-3"
            >
              <Magnetic strength={0.2}>
                <motion.button
                  type="button"
                  onClick={go}
                  whileHover={reduce ? undefined : { scale: 1.04 }}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  className="nt-cta group inline-flex h-14 items-center gap-3 px-8 text-base font-semibold tracking-tight sm:text-lg"
                >
                  {placed ? 'Continue Learning' : 'Take Placement Quiz'}
                  <ArrowRight className="nt-cta-arrow size-5" aria-hidden />
                </motion.button>
              </Magnetic>
              <p className="text-sm text-muted">
                {placed ? 'You have already completed your placement quiz.' : user ? 'About 5 minutes. It sets your starting point.' : 'You will sign in first, then start your placement quiz.'}
              </p>
            </motion.div>
          </section>

          {/* ------------------------------------------------------------ features */}
          <section aria-labelledby="features-h" className="mx-auto w-full max-w-5xl px-4 pb-24 md:px-6">
            <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }} className="mb-10 text-center">
              <h2 id="features-h" className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl">Learning that <span className="nt-gradient-text">understands you</span></h2>
              <p className="mx-auto mt-3 max-w-xl text-muted">A neural tracker estimates what you know. A rule-based engine explains what to do next.</p>
            </motion.div>
            <Stagger inView gap={0.12} className="grid gap-5 text-left sm:grid-cols-3">
              {PILLARS.map((p) => (
                <StaggerItem key={p.title} className="h-full">
                  <TiltCard className="h-full" max={5}>
                    <article className="nt-feature h-full p-6">
                      <span className="nt-icon-glow flex size-11 items-center justify-center rounded-xl"><p.icon className="size-5" aria-hidden /></span>
                      <h3 className="mt-5 text-lg font-semibold tracking-tight">{p.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
                    </article>
                  </TiltCard>
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        </main>
      </FloatingBackdrop>
    </motion.div>
  )
}
