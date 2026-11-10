import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router-dom'
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
          'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-raised hover:text-text',
        )
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
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

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex',
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
    </aside>
  )
}
