import { BrainCircuit, ClipboardCheck, LineChart, Route } from 'lucide-react'
import { motion } from 'motion/react'
import { useMetaConfig } from '@/app/providers/MetaProvider'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

/** "Watch Demo": a short animated walk-through of the learning loop, built from the platform's real settings. */
export function DemoDialog({ open, onOpenChange, onStart, startLabel, scope }: { open: boolean; onOpenChange: (o: boolean) => void; onStart: () => void; startLabel: string; scope: string }) {
  const cfg = useMetaConfig()
  const steps = [
    { icon: ClipboardCheck, title: 'Take the placement quiz', text: `${cfg.placement_concepts.length} short questions give a first estimate of what you already know.` },
    { icon: BrainCircuit, title: 'The tracker maps your mastery', text: `A neural tracker follows ${cfg.concept_count} Python concepts on a prerequisite graph and updates after every answer.` },
    { icon: Route, title: 'The tutor picks your next step', text: 'A video, a practice question or a documentation deep-dive, with the reason shown each time.' },
    { icon: LineChart, title: 'Watch your progress grow', text: `Work through ${cfg.block_count} learning blocks and see strengths, gaps and streaks on your dashboard.` },
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="How Neuro Symbolic Tutor works" description="The learning loop in four steps." className={scope}>
      <ol className="relative space-y-5 border-l border-[color:var(--w-nav-border)] pl-6">
        {steps.map((s, i) => (
          <motion.li key={s.title} initial={{ opacity: 0, x: -12 }} animate={open ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.12 + i * 0.12, duration: 0.45 }} className="relative">
            <span className="absolute -left-[41px] flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--w-a)] to-[color:var(--w-c)] text-white shadow-[0_0_18px_-2px_rgb(var(--w-glow))]"><s.icon className="size-4" aria-hidden /></span>
            <h3 className="font-semibold">{i + 1}. {s.title}</h3>
            <p className="mt-0.5 text-sm text-muted">{s.text}</p>
          </motion.li>
        ))}
      </ol>
      <Button size="lg" className="mt-6 w-full" onClick={() => { onOpenChange(false); onStart() }}>{startLabel}</Button>
    </Dialog>
  )
}
