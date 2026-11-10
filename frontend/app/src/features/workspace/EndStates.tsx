import { ArrowRight, GraduationCap, PauseCircle, PartyPopper } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { BlockCompleteStep, CompleteStep, SessionPausedStep } from '@/api/types'
import { Button, LinkButton } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ROUTES } from '@/constants/routes'
import { pct } from '@/lib/tiers'

function Shell({ icon, title, children, tone }: { icon: React.ReactNode; title: string; children: React.ReactNode; tone: string }) {
  return (
    <Card className="overflow-hidden">
      <div className={`h-1.5 ${tone}`} />
      <CardBody className="flex flex-col items-center gap-4 px-6 py-10 text-center sm:px-12">
        <div className="flex size-14 items-center justify-center rounded-full bg-raised">{icon}</div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        {children}
      </CardBody>
    </Card>
  )
}

const Metric = ({ value, label }: { value: string; label: string }) => (
  <div className="rounded-lg border border-border bg-raised/60 px-6 py-3">
    <div className="text-2xl font-semibold tabular-nums">{value}</div>
    <div className="text-xs text-muted">{label}</div>
  </div>
)

export function BlockCompleteCard({ step }: { step: BlockCompleteStep }) {
  const c = step.content
  return (
    <Shell tone="bg-good" icon={<PartyPopper className="size-7 text-good" aria-hidden />} title={`${c.block_name} complete`}>
      <p className="max-w-md text-muted">{step.explanation}</p>
      <Metric value={pct(c.average_mastery)} label="block average mastery" />
      <div className="flex flex-wrap justify-center gap-3">
        <LinkButton to={ROUTES.learn} icon={<ArrowRight className="size-4" />}>Choose the next block</LinkButton>
        <LinkButton to={ROUTES.dashboard} variant="secondary">Dashboard</LinkButton>
      </div>
    </Shell>
  )
}

export function SessionPausedCard({ step, onContinue, continuing }: { step: SessionPausedStep; onContinue: () => void; continuing: boolean }) {
  const c = step.content
  return (
    <Shell tone="bg-primary" icon={<PauseCircle className="size-7 text-primary" aria-hidden />} title="Session paused">
      <p className="max-w-md text-muted">{step.explanation}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Metric value={pct(c.average_mastery)} label={`${c.block_name} average`} />
        <Metric value={`${c.round_count}/${c.round_cap}`} label="rounds used" />
      </div>
      <p className="text-sm text-muted">Weakest here: <strong className="text-text">{c.weakest_concept}</strong> ({pct(c.weakest_belief)})</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={onContinue} loading={continuing} icon={<ArrowRight className="size-4" />}>Continue this block</Button>
        <LinkButton to={ROUTES.learn} variant="secondary">Choose a different block</LinkButton>
        <LinkButton to={ROUTES.dashboard} variant="ghost">Dashboard</LinkButton>
      </div>
    </Shell>
  )
}

export function CurriculumCompleteCard({ step }: { step: CompleteStep }) {
  const c = step.content
  return (
    <Shell tone="bg-good" icon={<GraduationCap className="size-7 text-good" aria-hidden />} title="Curriculum complete">
      <p className="max-w-md text-muted">{step.explanation}</p>
      <Metric value={pct(c.average_mastery)} label="average mastery" />
      {c.weakest_concepts.length > 0 && (
        <p className="max-w-md text-sm text-muted">Still the softest: <strong className="text-text">{c.weakest_concepts.map((w) => w.concept).join(', ')}</strong>. Worth a manual review even though the target was reached.</p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <LinkButton to={ROUTES.mastery}>View concept mastery</LinkButton>
        <Link to={ROUTES.dashboard} className="inline-flex h-11 items-center px-4 text-sm font-semibold text-primary hover:underline">Dashboard</Link>
      </div>
    </Shell>
  )
}
