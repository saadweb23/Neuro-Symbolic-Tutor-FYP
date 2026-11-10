import { Table2, BarChart3 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Card, CardBody, CardHeader } from './Card'

/** A chart with a text alternative: every chart can be switched to a table of the same data
 *  (accessible to screen readers, and handy for exact values). */
export function ChartCard({ title, description, chart, table, summary }: { title: string; description?: string; chart: ReactNode; table: ReactNode; summary?: string }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        action={
          <button onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted hover:bg-raised hover:text-text">
            {asTable ? <BarChart3 className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
            {asTable ? 'Chart' : 'Table'}
          </button>
        }
      />
      <CardBody>
        {summary && <p className="sr-only">{summary}</p>}
        {asTable ? <div tabIndex={0} role="region" aria-label={`${title} data table`} className="max-h-72 overflow-auto">{table}</div> : chart}
      </CardBody>
    </Card>
  )
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted">
        <tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-1.5 tabular-nums">{c}</td>)}</tr>)}
      </tbody>
    </table>
  )
}
