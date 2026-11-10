import { describe, expect, it } from 'vitest'
import { checkStudentId } from './studentId'

describe('checkStudentId', () => {
  it('trims and accepts normal ids, preserving case', () => {
    expect(checkStudentId('  Alex_Khan ')).toEqual({ ok: true, id: 'Alex_Khan' })
    expect(checkStudentId('alex_khan')).toEqual({ ok: true, id: 'alex_khan' })
  })
  it('rejects empty, too long, slashes and control characters', () => {
    expect(checkStudentId('   ').ok).toBe(false)
    expect(checkStudentId('x'.repeat(65)).ok).toBe(false)
    expect(checkStudentId('x'.repeat(64)).ok).toBe(true)
    expect(checkStudentId('a/b').ok).toBe(false)
    expect(checkStudentId('a\\b').ok).toBe(false)
    expect(checkStudentId('a\u0007b').ok).toBe(false)
  })
})
