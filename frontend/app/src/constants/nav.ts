import { BookOpen, ChartLine, History, LayoutDashboard, LifeBuoy, Library, Network, Settings, type LucideIcon } from 'lucide-react'
import { ROUTES } from './routes'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** short label for the mobile tab bar */
  short?: string
}

export const NAV_LEARN: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { to: ROUTES.learn, label: 'Learning Paths', short: 'Learn', icon: BookOpen },
  { to: ROUTES.mastery, label: 'Concept Mastery', short: 'Mastery', icon: Network },
]

export const NAV_INSIGHTS: NavItem[] = [
  { to: ROUTES.analytics, label: 'Analytics', short: 'Progress', icon: ChartLine },
  { to: ROUTES.history, label: 'History', icon: History },
  { to: ROUTES.resources, label: 'Resources', icon: Library },
]

export const NAV_FOOTER: NavItem[] = [
  { to: ROUTES.settings, label: 'Settings', icon: Settings },
  { to: ROUTES.help, label: 'Help', icon: LifeBuoy },
]

/** Bottom tab bar on phones; everything else lives under "More". */
export const NAV_TABS: NavItem[] = [NAV_LEARN[0]!, NAV_LEARN[1]!, NAV_LEARN[2]!, NAV_INSIGHTS[0]!]
export const NAV_MORE: NavItem[] = [NAV_INSIGHTS[1]!, NAV_INSIGHTS[2]!, ...NAV_FOOTER]
