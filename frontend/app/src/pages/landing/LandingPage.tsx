import { ArrowRight, BrainCircuit, GitBranch, Layers, Lightbulb, ListChecks, Target } from 'lucide-react'
import { useGraph } from '@/api/queries/hooks'
import { useMetaConfig } from '@/app/providers/MetaProvider'
import { AnimatedCubeLogo } from '@/components/brand/AnimatedCubeLogo'
import { LinkButton } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Reveal } from '@/components/ui/Reveal'
import { Skeleton } from '@/components/ui/Skeleton'
import { BLOCK_ICONS } from '@/constants/blocks'
import { ROUTES } from '@/constants/routes'
import { BLOCK_COLORS, pct } from '@/lib/tiers'

export function LandingPage() {
  const cfg = useMetaConfig()
  const graph = useGraph()

  const steps = [
    { icon: ListChecks, title: 'Placement', text: `A ${cfg.placement_concepts.length}-question quiz gives the tutor a first estimate of what you already know across all ${cfg.concept_count} concepts.` },
    { icon: BrainCircuit, title: 'The agent decides', text: 'You pick a focus area. A reinforcement-learning agent chooses which concept inside it to work on next, using your current mastery estimates.' },
    { icon: Layers, title: 'Rules choose the lesson', text: 'Simple, transparent rules pick a video, a practice question or a documentation deep-dive, and set the question difficulty from your mastery.' },
    { icon: Lightbulb, title: 'It tells you why', text: 'Every step comes with a plain-language reason, including the weaker prerequisite a concept often traces back to.' },
  ]
  const features = [
    { icon: Lightbulb, title: 'Glass-box recommendations', text: 'No unexplained "next". Each recommendation says why it was chosen.' },
    { icon: GitBranch, title: 'Knowledge-graph aware', text: 'A graph neural network updates related concepts within two hops of each answer, so one question informs many estimates.' },
    { icon: Target, title: 'Adaptive difficulty', text: `Questions are easy below ${pct(cfg.difficulty_cutoffs.easy_below)} mastery, medium up to ${pct(cfg.difficulty_cutoffs.medium_below)}, and hard beyond.` },
    { icon: ListChecks, title: 'Focused sessions', text: `Work one block at a time, up to ${cfg.session_round_cap} rounds per session. Progress is always saved.` },
    { icon: Layers, title: 'Evidence-based completion', text: `A block is complete at ${pct(cfg.mastery_threshold)} average mastery, every concept at least ${pct(cfg.concept_floor)}, and every concept actually answered.` },
    { icon: BrainCircuit, title: 'Curated resources', text: 'Videos and official documentation are hand-picked per concept, never generated.' },
  ]

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_30%,var(--primary-soft),transparent)]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.15fr_0.85fr] md:px-6 md:py-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden /> Adaptive Python tutoring
            </p>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
              A Python tutor that explains <span className="text-primary">why you&apos;re stuck</span>, not just that you are.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              NeuroTutor tracks your mastery of {cfg.concept_count} Python concepts on a prerequisite graph, chooses what to practise next, and tells you the reason behind every step.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to={ROUTES.start} size="lg" icon={<ArrowRight className="size-5" />}>Start learning</LinkButton>
              <LinkButton to={`${ROUTES.landing}#how-it-works`} variant="secondary" size="lg">How it works</LinkButton>
            </div>
          </div>
          <div className="flex justify-center py-6" aria-hidden>
            <AnimatedCubeLogo size={170} />
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 md:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold">How it works</h2>
          <p className="mt-2 max-w-2xl text-muted">Three cooperating parts: a tracker that estimates what you know, an agent that picks what to study, and rules that pick how to teach it.</p>
        </Reveal>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.06}>
              <li className="h-full list-none">
                <Card className="h-full">
                  <CardBody>
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary"><s.icon className="size-5" aria-hidden /></span>
                      <span className="text-xs font-semibold text-muted">Step {i + 1}</span>
                    </div>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-muted">{s.text}</p>
                  </CardBody>
                </Card>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* features */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <Reveal><h2 className="text-3xl font-semibold">Built for understanding, not just scores</h2></Reveal>
          <div className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.05}>
                <div className="flex gap-3.5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><f.icon className="size-5" aria-hidden /></span>
                  <div><h3 className="font-semibold">{f.title}</h3><p className="mt-1 text-sm text-muted">{f.text}</p></div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* curriculum (real concept names from GET /graph) */}
      <section id="curriculum" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 md:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold">The curriculum</h2>
          <p className="mt-2 max-w-2xl text-muted">Five blocks, {cfg.concept_count} concepts, connected by prerequisites: later ideas build on earlier ones.</p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {graph.isPending && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-40" />)}
          {graph.data?.blocks.map((b) => {
            const Icon = BLOCK_ICONS[b.index] ?? BLOCK_ICONS[0]!
            return (
              <Reveal key={b.index} delay={b.index * 0.04}>
                <Card className="h-full">
                  <CardBody>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-lg text-white" style={{ background: BLOCK_COLORS[b.index] }}><Icon className="size-5" aria-hidden /></span>
                      <div><h3 className="font-semibold">{b.name}</h3><p className="text-xs text-muted">Block {b.index + 1} · {b.concepts.length} concepts</p></div>
                    </div>
                    <p className="text-sm text-muted">{b.concepts.join(' · ')}</p>
                  </CardBody>
                </Card>
              </Reveal>
            )
          })}
          {graph.isError && <p className="text-sm text-muted sm:col-span-2 lg:col-span-3">The curriculum list could not be loaded right now. You can still get started.</p>}
        </div>
      </section>

      {/* under the hood */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
          <Reveal>
            <h2 className="text-3xl font-semibold">Under the hood</h2>
            <p className="mt-3 text-muted">
              A dual-pathway graph neural network estimates your mastery of every concept; a PPO reinforcement-learning agent chooses the next concept within your chosen block; a rule-based content engine picks the format and writes the explanation.
            </p>
            <p className="mt-3 text-muted">
              In our simulated evaluation the agent matches, but does not beat, a simple linear-curriculum baseline. What NeuroTutor adds is transparent mastery tracking and an explanation for every recommendation.
            </p>
          </Reveal>
        </div>
      </section>

      {/* call to action */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <Reveal>
          <div className="flex flex-col items-center gap-5 rounded-xl border border-border bg-surface px-6 py-12 text-center shadow-card">
            <AnimatedCubeLogo size={48} motion="hover" bare />
            <h2 className="text-3xl font-semibold">Ready to find your starting point?</h2>
            <p className="max-w-lg text-muted">Take the {cfg.placement_concepts.length}-question placement quiz, then pick up where you actually are.</p>
            <LinkButton to={ROUTES.start} size="lg" icon={<ArrowRight className="size-5" />}>Get started</LinkButton>
          </div>
        </Reveal>
      </section>
    </>
  )
}
