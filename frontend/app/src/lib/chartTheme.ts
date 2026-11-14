/** Shared Recharts styling so every chart in the app reads as one family. */
export const AXIS = { fontSize: 12, fill: 'var(--muted)' }
export const GRID = { stroke: 'var(--border)', strokeDasharray: '3 3' }
export const TIP = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12, boxShadow: 'var(--shadow-2)' },
  labelStyle: { color: 'var(--muted)', fontWeight: 600 },
  itemStyle: { color: 'var(--text)' },
  cursor: { fill: 'var(--raised)', opacity: 0.6 },
}
export const LEVEL_COLORS = { strong: 'var(--good)', intermediate: 'var(--mid)', weak: 'var(--bad)' } as const
