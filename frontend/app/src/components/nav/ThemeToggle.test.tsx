import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '@/constants/storage'
import { renderWithProviders } from '@/test/utils'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  it('switches to dark mode, persists it and updates the document class', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ThemeToggle />)
    await user.click(screen.getByRole('button', { name: /change theme/i }))
    await user.click(await screen.findByRole('menuitem', { name: /dark/i }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark')
    await user.click(screen.getByRole('button', { name: /change theme/i }))
    await user.click(await screen.findByRole('menuitem', { name: /light/i }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
