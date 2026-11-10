import { describe, expect, it } from 'vitest'
import { tierFor } from './tiers'

const cut = { easy_below: 0.4, medium_below: 0.7 }

describe('tierFor', () => {
  it('uses the backend-provided cut-offs', () => {
    expect(tierFor(0.39, cut)).toBe('weak')
    expect(tierFor(0.4, cut)).toBe('developing')
    expect(tierFor(0.69, cut)).toBe('developing')
    expect(tierFor(0.7, cut)).toBe('mastered')
    expect(tierFor(0.5, { easy_below: 0.6, medium_below: 0.9 })).toBe('weak')
  })
})
