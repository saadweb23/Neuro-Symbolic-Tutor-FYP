import { Ellipsis } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Dialog } from '@/components/ui/Dialog'
import { NAV_MORE, NAV_TABS } from '@/constants/nav'
import { cn } from '@/lib/cn'

/** Bottom tab bar for phones (< md). "More" opens a sheet with the remaining destinations. */
export function MobileNavigation() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV_TABS.map(({ to, icon: Icon, label, short }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-primary' : 'text-muted')
            }
          >
            <Icon className="size-5" aria-hidden />
            {short ?? label}
          </NavLink>
        ))}
        <button onClick={() => setOpen(true)} className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted">
          <Ellipsis className="size-5" aria-hidden />
          More
        </button>
      </nav>
      <Dialog open={open} onOpenChange={setOpen} title="More" variant="sheet">
        <ul className="space-y-1">
          {NAV_MORE.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <button
                onClick={() => {
                  setOpen(false)
                  navigate(to)
                }}
                className="flex h-12 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] font-medium hover:bg-raised"
              >
                <Icon className="size-5 text-muted" aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  )
}
