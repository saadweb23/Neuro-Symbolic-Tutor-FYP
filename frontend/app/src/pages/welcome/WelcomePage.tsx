import { ArrowDown, ArrowRight, ChartNoAxesColumnIncreasing, Layers, ListChecks, Network, Play, Sparkles, Target, Trophy } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStatus } from '@/api/queries/hooks'
import { useMetaConfig } from '@/app/providers/MetaProvider'
import { useStudentContext } from '@/app/providers/StudentProvider'
import { Magnetic } from '@/components/motion/Magnetic'
import { Stagger, StaggerItem } from '@/components/motion/Stagger'
import { Typewriter, type Phrase } from '@/components/motion/Typewriter'
import { ROUTES } from '@/constants/routes'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSpotlight } from '@/hooks/useSpotlight'
import { cn } from '@/lib/cn'
import { DemoDialog } from './DemoDialog'
import { EducationHologram } from './EducationHologram'
import { FloatingBackdrop } from './FloatingBackdrop'
import { useWelcomeTheme } from './useWelcomeTheme'
import { WelcomeNav } from './WelcomeNav'
import { Waves } from './Waves'

const rise: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.1 + i * 0.13, ease: [0.22, 1, 0.36, 1] } }),
}

/** Only the second line of the headline types and deletes; the first line is fixed. */
const PHRASES: Phrase[] = [
  [{ text: 'Learn ' }, { text: 'Smarter', highlight: true }, { text: ' with AI' }],
  [{ text: 'Master ' }, { text: 'New Concepts', highlight: true }],
  [{ text: 'Discover Your ' }, { text: 'Potential', highlight: true }],
  [{ text: 'Personalized Learning', highlight: true }, { text: ' Starts Here' }],
]

const CARDS = [
  { icon: Trophy, hue: 'var(--w-hue-1)', title: 'Discover Your Strengths', text: "Find out what you're good at with AI-powered analysis." },
  { icon: Target, hue: 'var(--w-hue-2)', title: 'Identify Knowledge Gaps', text: 'See what you need to learn next.' },
  { icon: ChartNoAxesColumnIncreasing, hue: 'var(--w-hue-3)', title: 'Follow an Intelligent Journey', text: 'Get a personalized learning path for continuous improvement.' },
] as const

/** The site's front door: introduces the platform and leads into the placement quiz. Always rendered in the
 *  dark navy theme (the `dark` class scopes the design tokens to this page). */
export function WelcomePage() {
  useDocumentTitle()
  useSpotlight()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const cfg = useMetaConfig()
  const { studentId, user } = useStudentContext()
  const status = useStatus(studentId)
  const [leaving, setLeaving] = useState(false)
  const [demo, setDemo] = useState(false)
  const { theme, setTheme, switching, root } = useWelcomeTheme()

  // Someone who already finished placement continues learning; the quiz cannot be retaken.
  const placed = status.data?.placement_completed === true
  const target = placed ? ROUTES.dashboard : ROUTES.placement
  const ctaLabel = placed ? 'Continue Learning' : 'Take Placement Quiz'
  const go = () => {
    if (leaving) return
    if (reduce) return void navigate(target)
    setLeaving(true)   // exit animation, then navigate (onAnimationComplete below)
  }
  const explore = () => document.getElementById('explore')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })

  return (
    <motion.div
      className={cn('nt-welcome-root min-h-svh', root, switching && 'nt-theme-switching')}
      initial={false}
      animate={leaving ? { opacity: 0, scale: 1.04, filter: 'blur(6px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={() => { if (leaving) navigate(target) }}
    >
      <FloatingBackdrop rich className="flex min-h-svh flex-col">
        <WelcomeNav signedIn={!!user} theme={theme} onTheme={setTheme} scope={root} />

        <main id="main" tabIndex={-1} className="outline-none">
          {/* ------------------------------------------------------------ first screen */}
          <section className="relative">
            <Waves className="pointer-events-none absolute inset-x-0 bottom-0 h-44" />
            <div className="relative mx-auto flex min-h-[calc(100svh-5.5rem)] w-full max-w-[1480px] flex-col px-4 sm:px-6 lg:px-12">
              <div className="grid flex-1 items-center gap-4 pb-6 pt-8 lg:grid-cols-[1.2fr_1fr] lg:gap-8">
                <div className="min-w-0">
                  <motion.p custom={0} variants={rise} initial="hidden" animate="show" className="nt-chip inline-flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-3.5 text-[13px] font-medium">
                    <span className="flex size-6 items-center justify-center rounded-full bg-[color:var(--w-a)]/25 text-[color:var(--w-c)]"><Sparkles className="size-3.5" aria-hidden /></span>
                    AI-Powered <span aria-hidden>•</span> Personalized <span aria-hidden>•</span> Adaptive
                    <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgb(52_211_153)]" aria-hidden />
                  </motion.p>

                  <motion.h1 custom={1} variants={rise} initial="hidden" animate="show" className="mt-6 text-[clamp(1.7rem,2.5vw,2.8rem)] font-[650] leading-[1.1] tracking-[-0.035em]" style={{ color: 'var(--w-text)' }}>
                    <span className="sr-only">Neuro Symbolic Tutor: a neuro-symbolic adaptive learning platform</span>
                    <span aria-hidden className="block">Welcome to <span className="nt-hl nt-clone">Neuro Symbolic Tutor</span></span>
                    <Typewriter phrases={PHRASES} highlightClass="nt-hl nt-clone" className="mt-1" />
                  </motion.h1>

                  <motion.p custom={2} variants={rise} initial="hidden" animate="show" className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-[color:var(--w-lead)] md:text-xl">
                    Your Personal AI Learning Companion. Discover your strengths, identify knowledge gaps, and follow an intelligent learning journey designed around your abilities.
                  </motion.p>

                  <motion.div initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }} className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
                    <Magnetic strength={0.18}>
                      <motion.button type="button" onClick={go} whileHover={reduce ? undefined : { scale: 1.04 }} whileTap={reduce ? undefined : { scale: 0.98 }}
                        className="nt-cta group inline-flex h-[60px] items-center gap-3.5 px-7 text-lg font-semibold tracking-tight">
                        <Play className="size-4 fill-current" aria-hidden />
                        {ctaLabel}
                        <ArrowRight className="nt-cta-arrow size-5" aria-hidden />
                      </motion.button>
                    </Magnetic>
                    <button type="button" onClick={() => setDemo(true)} className="group flex items-center gap-3.5 rounded-full text-lg font-medium text-[color:var(--w-text)]">
                      <span className="flex size-14 items-center justify-center rounded-full border-2 border-[color:var(--w-btn-border)] transition-all group-hover:scale-105 group-hover:border-[color:var(--w-c)] group-hover:shadow-[0_0_26px_-4px_var(--w-c)]"><Play className="ml-0.5 size-5 fill-current" aria-hidden /></span>
                      Watch Demo
                    </button>
                  </motion.div>

                  <motion.div custom={5} variants={rise} initial="hidden" animate="show" className="mt-8 flex items-center gap-4 text-sm text-[color:var(--w-lead)]">
                    <span className="flex -space-x-2" aria-hidden>
                      {[Network, Layers, ListChecks].map((Icon, i) => <span key={i} className="flex size-9 items-center justify-center rounded-full border-2 border-[color:var(--bg)] bg-gradient-to-br from-[color:var(--w-a)] to-[color:var(--w-c)] text-white"><Icon className="size-4" /></span>)}
                    </span>
                    <span>{cfg.concept_count} Python concepts · {cfg.block_count} learning blocks · {cfg.placement_concepts.length}-question placement quiz</span>
                  </motion.div>
                </div>

                <motion.div initial={{ opacity: 0, x: 48, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }} className="min-w-0">
                  <EducationHologram />
                </motion.div>
              </div>

              <Stagger id="features" gap={0.12} delay={0.7} className="relative z-10 grid gap-4 pb-4 md:grid-cols-3">
                {CARDS.map((c, i) => (
                  <StaggerItem key={c.title} className="h-full">
                    <button type="button" onClick={i === 0 ? go : () => (window.location.href = i === 1 ? `${ROUTES.landing}#how-it-works` : `${ROUTES.landing}#curriculum`)}
                      className="nt-neon group flex h-full w-full items-center gap-5 p-5 text-left sm:p-6" style={{ '--hue': c.hue } as CSSProperties}>
                      <span className="nt-neon-icon flex size-[68px] shrink-0 items-center justify-center rounded-full"><c.icon className="size-8" strokeWidth={1.7} aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17px] font-semibold tracking-tight">{c.title}</span>
                        <span className="mt-1 block text-[15px] leading-snug text-[color:var(--w-lead)]">{c.text}</span>
                      </span>
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--hue)] text-[var(--hue)] transition-transform group-hover:translate-x-1" aria-hidden><ArrowRight className="size-4" /></span>
                    </button>
                  </StaggerItem>
                ))}
              </Stagger>

              <div className="relative z-10 flex justify-center py-5">
                <button type="button" onClick={explore} className="group flex items-center gap-4 text-sm font-medium text-[color:var(--w-lead)]">
                  <span aria-hidden className="hidden h-px w-24 bg-gradient-to-r from-transparent to-[color:var(--w-muted)]/60 sm:block" />
                  <span className="flex size-11 items-center justify-center rounded-full border border-[color:var(--w-btn-border)] transition-colors group-hover:border-[color:var(--w-c)]"><ArrowDown className="nt-hint size-5" aria-hidden /></span>
                  Scroll to Explore
                  <span aria-hidden className="hidden h-px w-24 bg-gradient-to-l from-transparent to-[color:var(--w-muted)]/60 sm:block" />
                </button>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------------ how it works */}
          <section id="explore" aria-labelledby="explore-h" className="relative mx-auto w-full max-w-[1100px] px-4 py-24 sm:px-6">
            <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }} className="mb-14 text-center">
              <h2 id="explore-h" className="text-3xl font-semibold tracking-[-0.03em] md:text-5xl">From placement quiz to a <span className="nt-hl">personal learning path</span></h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-[color:var(--w-lead)]">A neural tracker estimates what you know. A rule-based engine explains what to do next.</p>
            </motion.div>
            <Stagger inView gap={0.14} className="grid gap-6 md:grid-cols-4">
              {[
                { n: 1, t: 'Take the placement quiz', d: `${cfg.placement_concepts.length} short questions set your starting point.` },
                { n: 2, t: 'Your mastery is mapped', d: `Estimates for all ${cfg.concept_count} concepts, updated after every answer.` },
                { n: 3, t: 'The tutor picks your next step', d: 'Video, practice or docs, with the reason shown.' },
                { n: 4, t: 'See your progress grow', d: `${cfg.block_count} blocks, with strengths, gaps and streaks.` },
              ].map((s) => (
                <StaggerItem key={s.n}>
                  <div className="nt-feature h-full p-6">
                    <span className="nt-icon-glow flex size-10 items-center justify-center rounded-xl text-lg font-bold">{s.n}</span>
                    <h3 className="mt-4 text-lg font-semibold tracking-tight">{s.t}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--w-lead)]">{s.d}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
            <div className="mt-12 flex justify-center">
              <button type="button" onClick={go} className="nt-cta group inline-flex h-[58px] items-center gap-3 px-8 text-lg font-semibold">{placed ? 'Open Dashboard' : 'Start Your Journey'}<ArrowRight className="nt-cta-arrow size-5" aria-hidden /></button>
            </div>
            <p className="mt-8 text-center text-sm text-[color:var(--w-muted)]">Already have progress? <Link to={user ? ROUTES.dashboard : ROUTES.login} className="font-medium text-[color:var(--w-c)] underline-offset-4 hover:underline">{user ? 'Open your dashboard' : 'Sign in'}</Link></p>
          </section>
        </main>
      </FloatingBackdrop>

      <DemoDialog open={demo} onOpenChange={setDemo} onStart={go} startLabel={ctaLabel} scope={root} />
    </motion.div>
  )
}
