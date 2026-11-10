import { ArrowRight, BrainCircuit, GitBranch, Layers, Lightbulb, ListChecks, Target } from 'lucide-react'
import { useGraph } from '@/api/queries/hooks'
import { useMetaConfig } from '@/app/providers/MetaProvider'
import { GraphPreview } from '@/components/domain/GraphPreview'
import { BrandMark } from '@/components/brand/BrandMark'
import { LinkButton } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { Skeleton } from '@/components/ui/Skeleton'
import { BLOCK_ICONS } from '@/constants/blocks'
import { ROUTES } from '@/constants/routes'
import { BLOCK_COLORS, pct } from '@/lib/tiers'
import type { ReactNode } from 'react'

function SectionHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center md:mb-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      {children && <p className="mt-3 text-base text-muted md:text-lg">{children}</p>}
    </div>
  )
}

const Section = ({ id, className = '', children }: { id?: string; className?: string; children: ReactNode }) => (
  <section id={id} className={`scroll-mt-20 ${className}`}>
    <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">{children}</div>
  </section>
)

export function LandingPage() {
  const cfg = useMetaConfig()
  const graph = useGraph()

  const stats = [
    { value: cfg.concept_count, label: 'Python concepts' },
    { value: cfg.block_count, label: 'Learning blocks' },
    { value: cfg.placement_concepts.length, label: 'Question placement quiz' },
    { value: cfg.session_round_cap, label: 'Rounds per session' },
  ]
  const steps = [
    { icon: ListChecks, title: 'Find your level', text: `A ${cfg.placement_concepts.length}-question placement quiz gives a first estimate across all ${cfg.concept_count} concepts.` },
    { icon: BrainCircuit, title: 'The agent picks', text: 'Choose a focus area. A reinforcement-learning agent selects the concept inside it to work on next.' },
    { icon: Layers, title: 'Rules choose the lesson', text: 'Transparent rules pick a video, a practice question or documentation, and set the difficulty.' },
    { icon: Lightbulb, title: 'You see why', text: 'Every step explains itself, including the weaker prerequisite a concept often traces back to.' },
  ]
  const features = [
    { icon: Lightbulb, title: 'Glass-box recommendations', text: 'No unexplained "next". Each recommendation says why it was chosen.' },
    { icon: GitBranch, title: 'Knowledge-graph aware', text: 'A graph neural network updates related concepts within two hops of each answer.' },
    { icon: Target, title: 'Adaptive difficulty', text: `Easy below ${pct(cfg.difficulty_cutoffs.easy_below)} mastery, medium up to ${pct(cfg.difficulty_cutoffs.medium_below)}, hard beyond.` },
    { icon: ListChecks, title: 'Focused sessions', text: `Work one block at a time, up to ${cfg.session_round_cap} rounds per session. Progress is always saved.` },
    { icon: Layers, title: 'Evidence-based completion', text: `A block is complete at ${pct(cfg.mastery_threshold)} average, every concept at least ${pct(cfg.concept_floor)}, and every concept answered.` },
    { icon: BrainCircuit, title: 'Curated resources', text: 'Videos and official documentation are hand-picked per concept, never generated.' },
  ]

  return (
    <>
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_30%,transparent_75%)] opacity-60"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,var(--primary-soft),transparent)]" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-16 text-center md:px-6 md:pb-24 md:pt-24">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1 text-xs font-semibold text-muted shadow-card">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            Adaptive Python tutoring
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            A Python tutor that explains <span className="text-primary">why you&apos;re stuck</span>, not just that you are.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted md:text-xl">
            NeuroTutor tracks your mastery of {cfg.concept_count} Python concepts on a prerequisite graph, chooses what to practise next, and tells you the reason behind every step.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton to={ROUTES.start} size="lg" icon={<ArrowRight className="size-5" />}>Start learning</LinkButton>
            <LinkButton to={`${ROUTES.landing}#how-it-works`} variant="secondary" size="lg">How it works</LinkButton>
          </div>
          <dl className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-card sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-surface px-4 py-5">
                <dd className="text-3xl font-semibold tabular-nums tracking-tight">{s.value}</dd>
                <dt className="mt-1 text-xs font-medium text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ----------------------------------------------- the real prerequisite graph */}
      <Section className="border-b border-border bg-surface">
        <Reveal>
          <SectionHeader eyebrow="The knowledge graph" title="See how every concept connects">
            Later ideas build on earlier ones. This is the actual prerequisite graph the tutor reasons over: each arrow reads &ldquo;builds on&rdquo;.
          </SectionHeader>
          <div className="overflow-hidden rounded-xl border border-border bg-bg shadow-raised">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5 text-xs text-muted">
              <span className="font-medium text-text">Python curriculum</span>
              {graph.data && <span>{graph.data.nodes.length} concepts · {graph.data.edges.length} prerequisite links</span>}
            </div>
            <div className="overflow-x-auto p-4 md:p-6">
              {graph.isPending && <Skeleton className="h-72 w-full min-w-[760px]" />}
              {graph.isError && <p className="py-16 text-center text-sm text-muted">The graph could not be loaded right now. You can still get started.</p>}
              {graph.data && <GraphPreview graph={graph.data} />}
            </div>
            {graph.data && (
              <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-border bg-surface px-4 py-3 text-xs text-muted">
                {graph.data.blocks.map((b) => (
                  <li key={b.index} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: BLOCK_COLORS[b.index] }} aria-hidden />
                    {b.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
      </Section>

      {/* ----------------------------------------------------------- how it works */}
      <Section id="how-it-works">
        <Reveal>
          <SectionHeader eyebrow="How it works" title="Four steps from placement to mastery">
            A tracker estimates what you know, an agent picks what to study, and rules pick how to teach it.
          </SectionHeader>
        </Reveal>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="list-none">
              <Reveal delay={i * 0.06} className="h-full">
                <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-6 shadow-card">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-lg bg-primary-soft text-primary"><s.icon className="size-5" aria-hidden /></span>
                    <span className="text-3xl font-semibold tabular-nums text-border-strong" aria-hidden>{i + 1}</span>
                  </div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </Section>

      {/* ---------------------------------------------------------------- features */}
      <Section className="border-y border-border bg-surface">
        <Reveal>
          <SectionHeader eyebrow="Why it is different" title="Built for understanding, not just scores" />
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.05} className="h-full">
              <div className="h-full rounded-xl border border-border bg-bg p-6">
                <span className="mb-4 flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent"><f.icon className="size-5" aria-hidden /></span>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------------------- curriculum */}
      <Section id="curriculum">
        <Reveal>
          <SectionHeader eyebrow="Curriculum" title={`${cfg.block_count} blocks, ${cfg.concept_count} concepts`}>
            Pick any block to start a focused session. Progress in every block is always saved.
          </SectionHeader>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {graph.isPending && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44" />)}
          {graph.data?.blocks.map((b) => {
            const Icon = BLOCK_ICONS[b.index] ?? BLOCK_ICONS[0]!
            return (
              <Reveal key={b.index} delay={b.index * 0.04} className="h-full">
                <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-6 shadow-card">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-lg text-white" style={{ background: BLOCK_COLORS[b.index] }}><Icon className="size-5" aria-hidden /></span>
                    <div>
                      <h3 className="font-semibold">{b.name}</h3>
                      <p className="text-xs text-muted">Block {b.index + 1} · {b.concepts.length} concepts</p>
                    </div>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {b.concepts.map((c) => <li key={c} className="rounded-full bg-raised px-2.5 py-1 text-xs text-muted">{c}</li>)}
                  </ul>
                </div>
              </Reveal>
            )
          })}
          {graph.data && (
            <Reveal delay={0.25} className="h-full">
              <div className="flex h-full flex-col items-start justify-center rounded-xl border border-dashed border-primary/40 bg-primary-soft/50 p-6">
                <h3 className="text-lg font-semibold">Not sure where to begin?</h3>
                <p className="mt-2 text-sm text-muted">Take the {cfg.placement_concepts.length}-question placement quiz and the tutor will suggest a starting block.</p>
                <LinkButton to={ROUTES.start} className="mt-5" icon={<ArrowRight className="size-4" />}>Take the placement quiz</LinkButton>
              </div>
            </Reveal>
          )}
          {graph.isError && <p className="text-sm text-muted sm:col-span-2 lg:col-span-3">The curriculum list could not be loaded right now. You can still get started.</p>}
        </div>
      </Section>

      {/* -------------------------------------------------------------- under the hood */}
      <Section className="border-t border-border bg-surface">
        <Reveal>
          <SectionHeader eyebrow="Under the hood" title="Three parts working together" />
        </Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { t: 'Mastery tracker', d: 'A dual-pathway graph neural network estimates your mastery of every concept and updates related concepts after each answer.' },
            { t: 'Concept agent', d: 'A PPO reinforcement-learning agent chooses the next concept inside the block you picked, from your current estimates.' },
            { t: 'Content engine', d: 'A rule-based engine picks video, practice or documentation, sets the difficulty, and writes the explanation.' },
          ].map((x) => (
            <Reveal key={x.t} className="h-full">
              <div className="h-full rounded-xl border border-border bg-bg p-6">
                <h3 className="font-semibold">{x.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{x.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-muted">
          In our simulated evaluation the agent matches, but does not beat, a simple linear-curriculum baseline. What NeuroTutor adds is transparent mastery tracking and an explanation for every recommendation.
        </p>
      </Section>

      {/* ------------------------------------------------------------------- CTA */}
      <Section>
        <Reveal>
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-surface px-6 py-14 text-center shadow-raised">
            <BrandMark size={44} />
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Ready to find your starting point?</h2>
            <p className="max-w-lg text-muted">Take the {cfg.placement_concepts.length}-question placement quiz, then pick up where you actually are.</p>
            <LinkButton to={ROUTES.start} size="lg" icon={<ArrowRight className="size-5" />}>Get started</LinkButton>
          </div>
        </Reveal>
      </Section>
    </>
  )
}
