import { useState, type ComponentType } from 'react'
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { FocusLayout } from '@/layouts/FocusLayout'
import { AppShell } from '@/layouts/AppShell'
import { PublicLayout } from '@/layouts/PublicLayout'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { AdaptiveLayout, RequirePlacement, RequireStudent, RootRedirect } from './guards'

/** Route-level code splitting: each page module is fetched on first visit. */
export const lazyPage =
  <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  async () => ({ Component: (await load())[name] })

export const routes: RouteObject[] = [
  { path: ROUTES.root, element: <RootRedirect /> },
  {
    element: <PublicLayout />,
    children: [
      { path: ROUTES.landing, handle: { title: 'NeuroTutor' }, lazy: lazyPage(() => import('@/pages/landing/LandingPage'), 'LandingPage') },
      { path: ROUTES.login, handle: { title: 'Sign in' }, lazy: lazyPage(() => import('@/pages/login/LoginPage'), 'LoginPage') },
    ],
  },
  {
    element: <RequireStudent />,
    children: [
      { element: <FocusLayout />, children: [
        { path: ROUTES.placement, handle: { title: 'Placement quiz' }, lazy: lazyPage(() => import('@/pages/placement/PlacementPage'), 'PlacementPage') },
        { path: ROUTES.placementResults, handle: { title: 'Your starting point' }, lazy: lazyPage(() => import('@/pages/placement/PlacementResultsPage'), 'PlacementResultsPage') },
        { element: <RequirePlacement />, children: [{ path: ROUTES.session, handle: { title: 'Learning session' }, lazy: lazyPage(() => import('@/pages/workspace/WorkspacePage'), 'WorkspacePage') }] },
      ] },
      {
        element: <AppShell />,
        children: [
          { path: ROUTES.settings, handle: { title: 'Profile & settings' }, lazy: lazyPage(() => import('@/pages/settings/SettingsPage'), 'SettingsPage') },
          { element: <RequirePlacement />, children: [
            { path: ROUTES.dashboard, handle: { title: 'Dashboard' }, lazy: lazyPage(() => import('@/pages/dashboard/DashboardPage'), 'DashboardPage') },
            { path: ROUTES.learn, handle: { title: 'Learning paths' }, lazy: lazyPage(() => import('@/pages/learn/LearningPathsPage'), 'LearningPathsPage') },
            { path: ROUTES.mastery, handle: { title: 'Concept mastery' }, lazy: lazyPage(() => import('@/pages/mastery/MasteryPage'), 'MasteryPage') },
            { path: ROUTES.analytics, handle: { title: 'Progress analytics' }, lazy: lazyPage(() => import('@/pages/analytics/AnalyticsPage'), 'AnalyticsPage') },
            { path: ROUTES.history, handle: { title: 'Learning history' }, lazy: lazyPage(() => import('@/pages/history/HistoryPage'), 'HistoryPage') },
            { path: ROUTES.resources, handle: { title: 'Resource library' }, lazy: lazyPage(() => import('@/pages/resources/ResourcesPage'), 'ResourcesPage') },
          ] },
        ],
      },
    ],
  },
  { element: <AdaptiveLayout />, children: [{ path: ROUTES.help, handle: { title: 'Help & support' }, lazy: lazyPage(() => import('@/pages/help/HelpPage'), 'HelpPage') }] },
  { element: <AdaptiveLayout />, children: [{ path: '*', element: <NotFoundPage /> }] },
]

/** Shown while the first lazily-loaded route module is fetched (the boot screen has usually just left). */
function InitialLoad() {
  return <div className="mx-auto max-w-3xl p-6"><SkeletonCard lines={4} /></div>
}

export function AppRoutes() {
  const [router] = useState(() => createBrowserRouter([{ HydrateFallback: InitialLoad, children: routes }]))
  return <RouterProvider router={router} />
}
