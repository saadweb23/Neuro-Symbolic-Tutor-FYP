import { get, studentPath } from '@/api/client'
import type { HistoryItem, HistoryPage } from '@/api/types'

const COLUMNS: [string, (i: HistoryItem) => unknown][] = [
  ['time', (i) => i.at],
  ['concept', (i) => i.concept],
  ['type', (i) => i.content_type],
  ['result', (i) => (i.passed === null ? 'viewed' : i.passed ? 'correct' : 'incorrect')],
  ['difficulty', (i) => i.difficulty ?? ''],
  ['seconds', (i) => i.time_taken.toFixed(1)],
  ['belief_before', (i) => i.belief_before.toFixed(4)],
  ['belief_after', (i) => i.belief_after.toFixed(4)],
]

const cell = (v: unknown) => {
  const s = String(v)
  // quote cells with separators / quotes / newlines; neutralise spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function historyToCsv(items: HistoryItem[]): string {
  const head = COLUMNS.map(([h]) => h).join(',')
  const rows = items.map((i) => COLUMNS.map(([, f]) => cell(f(i))).join(','))
  return [head, ...rows].join('\n') + '\n'
}

/** Every history row (oldest page last), fetched page by page from GET /history. */
export async function fetchAllHistory(studentId: string): Promise<HistoryItem[]> {
  const all: HistoryItem[] = []
  let cursor: number | null = null
  for (let guard = 0; guard < 200; guard++) {
    const q = new URLSearchParams({ limit: '100' })
    if (cursor !== null) q.set('cursor', String(cursor))
    const page: HistoryPage = await get<HistoryPage>(studentPath(studentId, `/history?${q}`))
    all.push(...page.items)
    if (page.next_cursor === null) break
    cursor = page.next_cursor
  }
  return all
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
