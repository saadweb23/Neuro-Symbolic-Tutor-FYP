import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reduced = vi.hoisted(() => ({ value: false }))
vi.mock('motion/react', async (orig) => ({ ...(await orig<typeof import('motion/react')>()), useReducedMotion: () => reduced.value }))

import { Typewriter, type Phrase } from './Typewriter'

const phrases: Phrase[] = [[{ text: 'Hi ' }, { text: 'AI', highlight: true }], [{ text: 'Bye' }]]
// each timer is scheduled by an effect after a render, so advance one tick per act()
const tick = (ms: number, times = 1) => { for (let i = 0; i < times; i++) act(() => { vi.advanceTimersByTime(ms) }) }
const visible = (c: HTMLElement) => c.querySelector('.absolute')!.textContent

describe('Typewriter', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0.5) })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('types a phrase, holds it, deletes it and moves on to the next', () => {
    const { container } = render(<Typewriter phrases={phrases} typeMs={10} deleteMs={5} holdMs={100} gapMs={20} />)
    expect(visible(container)).toBe('')
    tick(10)
    expect(visible(container)).toBe('H')
    tick(10, 4)
    expect(visible(container)).toBe('Hi AI')
    tick(100)                                           // held on screen, then deleting starts
    tick(5, 3)
    expect(visible(container)).toBe('Hi')
    tick(5, 2); tick(20)                                // fully deleted, short pause, next phrase
    tick(10, 3)
    expect(visible(container)).toBe('Bye')
  })

  it('keeps the gradient on the highlighted segment only', () => {
    const { container } = render(<Typewriter phrases={phrases} typeMs={10} holdMs={1000} />)
    tick(10, 5)
    expect(container.querySelector('.nt-gradient-text')!.textContent).toBe('AI')
  })

  it('reserves space with an invisible copy of the longest phrase and is hidden from assistive tech', () => {
    const { container } = render(<Typewriter phrases={phrases} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.invisible')!.textContent).toBe('Hi AI')
  })

  it('shows the first phrase without animating when reduced motion is requested', () => {
    reduced.value = true
    const { container } = render(<Typewriter phrases={phrases} />)
    expect(visible(container)).toBe('Hi AI')
    tick(60_000)
    expect(visible(container)).toBe('Hi AI')
    reduced.value = false
  })
})
