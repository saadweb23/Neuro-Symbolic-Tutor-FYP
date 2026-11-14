import { Check, Copy, Download, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStatus, useSummary } from '@/api/queries/hooks'
import { usePreferences, type ThemePref } from '@/app/providers/PreferencesProvider'
import { useStudentContext } from '@/app/providers/StudentProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { QueryBoundary } from '@/components/feedback/QueryBoundary'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmationDialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { ROUTES } from '@/constants/routes'
import { downloadCsv, fetchAllHistory, historyToCsv } from '@/features/history/export'
import { cn } from '@/lib/cn'
import { formatDate, formatDuration, plural, relativeTime } from '@/lib/format'
import { pct } from '@/lib/tiers'

const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium [overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}

function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-border-strong')}>
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  )
}

/** Switching student clears the id while this page is still mounted for one render, so the page
 *  renders nothing in that window instead of throwing. */
export function SettingsPage() {
  const { studentId } = useStudentContext()
  return studentId ? <SettingsContent id={studentId} /> : null
}

function SettingsContent({ id }: { id: string }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { user, signOut } = useStudentContext()
  const prefs = usePreferences()
  const status = useStatus(id)
  const summary = useSummary(id)
  const [params, setParams] = useSearchParams()
  const tab = ['profile', 'preferences', 'data'].includes(params.get('tab') ?? '') ? (params.get('tab') as string) : 'profile'
  const [confirm, setConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.show('Could not copy. Select the ID and copy it manually.', 'error')
    }
  }
  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllHistory(id)
      downloadCsv(`neurotutor-history-${id}.csv`, historyToCsv(all))
      toast.show(`Exported ${all.length} rows.`, 'success')
    } catch {
      toast.show('The export failed. Please try again.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Profile & settings" description="Your identity on this device, and how NeuroTutor looks and behaves." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList aria-label="Settings sections" className="mb-5">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Your profile" description="Your account on this server." />
            <CardBody>
              <dl>
                <Row label="Username" value={user?.name ?? '–'} />
                <Row label="Student ID" value={<span className="inline-flex items-center gap-2"><code className="rounded bg-raised px-2 py-0.5 font-mono text-[13px]">{id}</code><button onClick={() => void copy()} aria-label="Copy student ID" className="rounded p-1 text-muted hover:bg-raised hover:text-text">{copied ? <Check className="size-4 text-good" /> : <Copy className="size-4" />}</button></span>} />
                <QueryBoundary query={status}>
                  {(s) => (
                    <>
                      <Row label="Member since" value={s.created_at ? formatDate(s.created_at) : '–'} />
                      <Row label="Placement quiz" value={s.placement_completed_at ? `Completed ${formatDate(s.placement_completed_at)}` : 'Not taken yet'} />
                      <Row label="Last active" value={relativeTime(s.last_active_at)} />
                    </>
                  )}
                </QueryBoundary>
              </dl>
              <Button variant="secondary" className="mt-4" icon={<LogOut className="size-4" />} onClick={() => setConfirm(true)}>Sign out</Button>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Your totals" />
            <CardBody>
              <QueryBoundary query={summary}>
                {(s) => (
                  <dl>
                    <Row label="Questions answered" value={s.answered_questions} />
                    <Row label="Accuracy" value={s.accuracy === null ? '–' : pct(s.accuracy)} />
                    <Row label="Concepts attempted" value={`${s.concepts_attempted} of ${s.concepts_total}`} />
                    <Row label="Time answering questions" value={formatDuration(s.answering_time_seconds)} />
                    <Row label="Active days" value={s.active_days} />
                    <Row label="Longest streak" value={plural(s.longest_streak_days, 'day')} />
                  </dl>
                )}
              </QueryBoundary>
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card className="max-w-2xl">
            <CardBody>
              <fieldset>
                <legend className="mb-3 text-sm font-semibold">Theme</legend>
                <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
                  {THEMES.map(({ value, label, icon: Icon }) => (
                    <button key={value} role="radio" aria-checked={prefs.theme === value} onClick={() => prefs.setTheme(value)}
                      className={cn('flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium', prefs.theme === value ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:bg-raised')}>
                      <Icon className="size-5" aria-hidden />{label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="mt-4 divide-y divide-border border-t border-border">
                <Switch checked={prefs.reduceMotion} onChange={prefs.setReduceMotion} label="Reduce motion" description="Stops the loading animation and shortens transitions. Your system's reduced-motion setting is always honoured too." />
                <Switch checked={prefs.shortcuts} onChange={prefs.setShortcuts} label="Keyboard shortcuts" description="Press 1-4 to choose an answer and Enter to submit or continue during learning." />
              </div>
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <Card className="max-w-2xl">
            <CardHeader title="Your data" />
            <CardBody className="space-y-4 text-sm">
              <p>NeuroTutor stores your student ID and a record of every answer and lesson on the server it runs on. Your mastery estimates are recomputed from that record.</p>
              <p className="rounded-lg bg-mid-soft p-3 text-mid">Your records are tied to your account: only you, signed in, can read them through the API.</p>
              <Button variant="secondary" loading={exporting} onClick={() => void exportCsv()} icon={<Download className="size-4" />}>Export my history (CSV)</Button>
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmationDialog open={confirm} onOpenChange={setConfirm} title="Sign out?" description="Your progress stays saved on the server. Sign in again to continue."
        confirmLabel="Sign out" onConfirm={() => { void signOut().then(() => navigate(ROUTES.login, { replace: true })) }} />
    </div>
  )
}
