import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONCEPT_INFO } from './content'

describe('curriculum copy', () => {
  it('covers exactly the backend concepts', () => {
    const src = readFileSync(resolve(__dirname, '../../../../../backend/knowledge_graph/graph_builder.py'), 'utf8')
    const block = src.slice(src.indexOf('CONCEPTS = ['), src.indexOf(']', src.indexOf('CONCEPTS = [')))
    const backend = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]!)
    expect(backend).toHaveLength(25)
    expect(Object.keys(CONCEPT_INFO).sort()).toEqual([...backend].sort())
  })
  it('every concept has a summary and three objectives', () => {
    for (const [name, info] of Object.entries(CONCEPT_INFO)) {
      expect(info.summary.length, name).toBeGreaterThan(20)
      expect(info.objectives, name).toHaveLength(3)
    }
  })
})
