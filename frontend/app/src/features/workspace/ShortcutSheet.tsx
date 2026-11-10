import { Dialog } from '@/components/ui/Dialog'

const ROWS: [string, string][] = [
  ['1 – 4', 'Choose an answer'],
  ['Enter', 'Submit the answer, mark done, or continue'],
  ['?', 'Show this list'],
  ['Esc', 'Close dialogs'],
]

export function ShortcutSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Keyboard shortcuts" description="Shortcuts can be turned off in Settings.">
      <dl className="divide-y divide-border">
        {ROWS.map(([k, d]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <dt><kbd className="rounded border border-border-strong bg-raised px-2 py-0.5 font-mono text-xs">{k}</kbd></dt>
            <dd className="text-muted">{d}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
