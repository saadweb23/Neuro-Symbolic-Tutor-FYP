import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { motion } from 'motion/react'
import { NavLink } from 'react-router-dom'
import { useStudentContext } from '@/app/providers/StudentProvider'
import { BrandMark, Wordmark } from '@/components/brand/BrandMark'
import { Tooltip } from '@/components/ui/Tooltip'
import { NAV_FOOTER, NAV_INSIGHTS, NAV_LEARN, type NavItem } from '@/constants/nav'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/cn'

function Item({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  const link = (
    <NavLink
      to={item.to}
      end={item.to === ROUTES.learn}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'nt-nav-item relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive ? 'text-primary' : 'text-muted hover:bg-raised hover:text-text',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active"
              aria-hidden
              className="absolute inset-0 rounded-md bg-primary-soft ring-1 ring-primary/20"
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            >
              <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" />
            </motion.span>
          )}
          <Icon className="nt-nav-icon relative size-5 shrink-0" aria-hidden />
          {!collapsed && <span className="relative truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  )
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}

function Group({ title, items, collapsed }: { title?: string; items: NavItem[]; collapsed: boolean }) {
  return (
    <div className="space-y-1">
      {title && !collapsed && <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>}
      {items.map((i) => (
        <Item key={i.to} item={i} collapsed={collapsed} />
      ))}
    </div>
  )
}

/** Signed-in student card at the bottom of the sidebar. */
function ProfileCard({ collapsed }: { collapsed: boolean }) {
  const { studentId } = useStudentContext()
  if (!studentId) return null
  const initial = studentId.slice(0, 1).toUpperCase()
  const avatar = <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-on-primary" style={{ background: 'var(--grad-brand)' }}>{initial}</span>
  return (
    <div className={cn('mb-2 flex items-center gap-3 rounded-lg border border-border bg-raised/50 p-2', collapsed && 'justify-center border-transparent bg-transparent p-0')}>
      {avatar}
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{studentId}</p>
          <p className="text-xs text-muted">Student</p>
        </div>
      )}
    </div>
  )
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <motion.aside
      initial={{ x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Main navigation"
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-surface transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <NavLink to={ROUTES.dashboard} className={cn('group flex h-16 items-center gap-3 px-5', collapsed && 'justify-center px-0')} aria-label="NeuroTutor home">
        <BrandMark size={26} />
        {!collapsed && <Wordmark />}
      </NavLink>
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        <Group title="Learn" items={NAV_LEARN} collapsed={collapsed} />
        <Group title="Insights" items={NAV_INSIGHTS} collapsed={collapsed} />
      </nav>
      <div className="space-y-1 border-t border-border px-3 py-3">
        <ProfileCard collapsed={collapsed} />
        <Group items={NAV_FOOTER} collapsed={collapsed} />
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn('flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted transition-colors hover:bg-raised hover:text-text', collapsed && 'justify-center px-0')}
        >
          {collapsed ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  )
}
