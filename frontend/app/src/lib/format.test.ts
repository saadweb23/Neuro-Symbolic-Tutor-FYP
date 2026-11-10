import { describe, expect, it } from 'vitest'
import { formatDuration, plural, relativeTime } from './format'

describe('format', () => {
  it('formats durations', () => {
    expect(formatDuration(42)).toBe('42s')
    expect(formatDuration(125)).toBe('2m 5s')
    expect(formatDuration(3720)).toBe('1h 2m')
  })
  it('pluralises', () => {
    expect(plural(1, 'day')).toBe('1 day')
    expect(plural(3, 'day')).toBe('3 days')
  })
  it('describes relative time', () => {
    const now = new Date('2026-01-10T12:00:00Z').getTime()
    expect(relativeTime('2026-01-10T11:59:40Z', now)).toBe('just now')
    expect(relativeTime('2026-01-10T11:30:00Z', now)).toBe('30 min ago')
    expect(relativeTime('2026-01-10T07:00:00Z', now)).toBe('5 h ago')
    expect(relativeTime(null, now)).toBe('never')
  })
})
