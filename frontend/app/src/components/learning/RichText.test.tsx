import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { looksLikeCode, RichText } from './RichText'

describe('RichText', () => {
  it('renders a multi-line snippet as a code block and prose as a paragraph', () => {
    const { container } = render(
      <RichText text={'Consider the following code:\n\na = [1, 2, 3]\nb = a\nprint(len(a), len(b))\n\nWhat is the output?'} />,
    )
    expect(container.querySelectorAll('pre')).toHaveLength(1)
    expect(screen.getByText('Consider the following code:')).toBeInTheDocument()
    expect(screen.getByText('What is the output?')).toBeInTheDocument()
  })

  it('renders `inline code` and never injects markup', () => {
    const { container } = render(<RichText text={'Use `append` <b>now</b>'} />)
    expect(container.querySelector('code')?.textContent).toBe('append')
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<b>now</b>')
  })

  it('keeps ordinary sentences as prose', () => {
    expect(looksLikeCode('What does the term "syntax" primarily refer to?')).toBe(false)
    expect(looksLikeCode('The set of rules that defines how Python statements must be structured.')).toBe(false)
    expect(looksLikeCode('my_list = [1, 2, 3]')).toBe(true)
  })
})
