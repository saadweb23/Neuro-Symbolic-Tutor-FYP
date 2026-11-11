import { useMetaConfig } from '@/app/providers/MetaProvider'
import { useStudentContext } from '@/app/providers/StudentProvider'
import { LinkButton } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ROUTES } from '@/constants/routes'
import { pct } from '@/lib/tiers'

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
    <h2 id={`${id}-h`} className="mb-3 text-xl font-semibold">{title}</h2>
    <div className="space-y-3 text-[15px] leading-relaxed text-text/90">{children}</div>
  </section>
)

const FAQ = (cfg: ReturnType<typeof useMetaConfig>): [string, string][] => [
  ['Why does the quiz have only ' + cfg.placement_concepts.length + ' questions?', `Each answer informs related concepts up to two hops away on the prerequisite graph, so a short quiz still gives an estimate for all ${cfg.concept_count} concepts. Concepts far from every quizzed one stay near a neutral starting value until you reach them.`],
  ['What does the percentage mean?', 'It is the tracker\'s estimate of how well you know a concept, built from all your answers (and from related concepts). It is an estimate, not a grade: one question does not certify or erase mastery.'],
  ['Why did I get a video / a question / a documentation page?', `A concept you have not met yet starts with a video. After that you get practice questions. After ${cfg.escalation_threshold} wrong answers in a row on a concept, you are sent to the official documentation, and you return to practice questions once you have read it.`],
  ['Why is my block not marked complete although the average is above the target?', `A block is complete only when its average is at least ${pct(cfg.mastery_threshold)}, every concept in it is at least ${pct(cfg.concept_floor)}, and you have actually answered a question on every concept. Watching a video does not count as an answer.`],
  ['Does reloading the page use up a round?', 'No. The step you are on is restored. Only asking for a new step uses a round.'],
  ['Can I retake the placement quiz?', 'Not currently. Your starting estimate is kept so your later progress is never reset.'],
  ['Who can see my progress?', 'Only you, once signed in. Every request to your learning data is checked against your account on the server.'],
]

export function HelpPage() {
  const cfg = useMetaConfig()
  const { studentId } = useStudentContext()
  const toc = [['start', 'Getting started'], ['how', 'How NeuroTutor decides'], ['faq', 'FAQ'], ['glossary', 'Glossary'], ['keys', 'Keyboard shortcuts'], ['trouble', 'Troubleshooting'], ['about', 'About the project']]
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-0">
      <h1 className={`mb-1 text-3xl font-semibold ${studentId ? 'md:sr-only' : ''}`}>Help &amp; support</h1>
      <p className="mb-8 max-w-2xl text-muted">How NeuroTutor works, answers to common questions, and what to do if something is not working.</p>
      <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {toc.map(([id, label]) => <li key={id}><a href={`#${id}`} className="block rounded-md px-3 py-1.5 text-sm text-muted hover:bg-raised hover:text-text">{label}</a></li>)}
          </ul>
        </nav>
        <div className="space-y-10">
          <Section id="start" title="Getting started">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Sign in with your username and password.</li>
              <li>New students answer a {cfg.placement_concepts.length}-question placement quiz that sets a starting estimate.</li>
              <li>Choose a focus area (a block of 5 concepts). A session lasts up to {cfg.session_round_cap} rounds; you can always extend it.</li>
              <li>In each round you get a video, a practice question or a documentation page, with a reason for why it was chosen.</li>
              <li>Watch your estimates change on the dashboard, the concept map and the analytics page.</li>
            </ol>
          </Section>

          <Section id="how" title="How NeuroTutor decides">
            <p><strong>1. Tracking.</strong> A graph neural network keeps an estimate of your mastery of every concept. Each answer updates the concept you were asked about and related concepts up to two steps away on the prerequisite graph.</p>
            <p><strong>2. Choosing the concept.</strong> Inside the focus area you picked, a reinforcement-learning agent chooses which concept to work on next from your current estimates.</p>
            <p><strong>3. Choosing the lesson.</strong> Simple rules decide the format: a new concept starts with a video; then practice questions; repeated mistakes lead to the official documentation. Question difficulty is easy below {pct(cfg.difficulty_cutoffs.easy_below)} mastery, medium below {pct(cfg.difficulty_cutoffs.medium_below)}, otherwise hard.</p>
            <p><strong>4. Finishing.</strong> A block is complete at {pct(cfg.mastery_threshold)} average mastery with every concept at least {pct(cfg.concept_floor)} and every concept answered at least once.</p>
          </Section>

          <Section id="faq" title="FAQ">
            <div className="space-y-2">
              {FAQ(cfg).map(([q, a]) => (
                <details key={q} className="group rounded-lg border border-border bg-surface px-4 py-3 open:shadow-card">
                  <summary className="cursor-pointer select-none font-medium marker:text-muted">{q}</summary>
                  <p className="mt-2 text-sm text-muted">{a}</p>
                </details>
              ))}
            </div>
          </Section>

          <Section id="glossary" title="Glossary">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[170px_1fr]">
              {[['Belief / mastery estimate', 'The tracker\'s probability-like estimate that you know a concept.'], ['Block', 'One of five groups of five concepts; a session is scoped to one block.'], ['Round', 'One step in a session: a video, a question or a documentation page.'], ['Prerequisite', 'A concept another concept builds on. Weak prerequisites often explain why a concept is hard.'], ['Placement', 'The short starting quiz.'], ['Deep-dive', 'The official Python documentation page for a concept.']].map(([t, d]) => (
                <div key={t} className="contents"><dt className="font-medium">{t}</dt><dd className="text-muted">{d}</dd></div>
              ))}
            </dl>
          </Section>

          <Section id="keys" title="Keyboard shortcuts">
            <p>Available while answering questions (turn them off in Settings):</p>
            <ul className="space-y-1.5">
              {[['1 – 4', 'choose an answer'], ['Enter', 'submit, mark done, or continue'], ['?', 'show the shortcut list in a session']].map(([k, d]) => <li key={k} className="flex items-center gap-3"><kbd className="min-w-14 rounded border border-border-strong bg-raised px-2 py-0.5 text-center font-mono text-xs">{k}</kbd><span className="text-muted">{d}</span></li>)}
            </ul>
          </Section>

          <Section id="trouble" title="Troubleshooting">
            <Card><CardBody className="space-y-3 text-sm">
              <p><strong>&ldquo;Can&apos;t reach the server&rdquo;.</strong> The backend must be running (it takes 30–40 seconds to start the first time). In the project folder: <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[13px]">cd backend &amp;&amp; python -m uvicorn main:app --host 0.0.0.0 --port 8000</code>.</p>
              <p><strong>Opening the app from a phone.</strong> Use the computer&apos;s current local network address on port 5173 (it changes between networks), and allow ports 8000 and 5173 through the firewall. The app finds the server at the same address on port 8000.</p>
              <p><strong>A page says there is not enough data.</strong> Charts need a few answered questions. Complete a session and come back.</p>
            </CardBody></Card>
          </Section>

          <Section id="about" title="About the project">
            <p>NeuroTutor is a final-year project exploring a neuro-symbolic tutor: a graph neural network for tracking, a reinforcement-learning agent for choosing, and transparent rules for teaching.</p>
            <p>In the project&apos;s simulated evaluation the agent matches, but does not beat, a simple linear-curriculum baseline. The value of the system is the explainable mastery tracking and recommendations, not a claim of better outcomes.</p>
            <div className="pt-2"><LinkButton to={ROUTES.start} variant="secondary">Back to the app</LinkButton></div>
          </Section>
        </div>
      </div>
    </div>
  )
}
