import { useState, type ComponentType } from 'react'
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { FocusLayout } from '@/layouts/FocusLayout'
import { AppShell } from '@/layouts/AppShell'
import { PublicLayout } from '@/layouts/PublicLayout'
import { ComingSoon } from '@/pages/ComingSoon'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AdaptiveLayout, RequirePlacement, RequireStudent } from './guards'

/** Route-level code splitting: each page module is fetched on first visit. */
export const lazyPage =
  <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  async () => ({ Component: (await load())[name] })

const soon = (name: string) => ({ element: <ComingSoon name={name} /> })

export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: ROUTES.landing, handle: { title: 'NeuroTutor' }, lazy: lazyPage(() => import('@/pages/landing/LandingPage'), 'LandingPage') },
      { path: ROUTES.start, lazy: lazyPage(() => import('@/pages/onboarding/OnboardingPage'), 'OnboardingPage') },
    ],
  },
  {
    element: <RequireStudent />,
    children: [
      { element: <FocusLayout />, children: [
        { path: ROUTES.placement, lazy: lazyPage(() => import('@/pages/placement/PlacementPage'), 'PlacementPage') },
        { path: ROUTES.placementResults, lazy: lazyPage(() => import('@/pages/placement/PlacementResultsPage'), 'PlacementResultsPage') },
        { element: <RequirePlacement />, children: [{ path: ROUTES.session, ...soon('Learning workspace') }] },
      ] },
      {
        element: <AppShell />,
        children: [
          { path: ROUTES.settings, handle: { title: 'Profile & settings' }, ...soon('Settings') },
          { element: <RequirePlacement />, children: [
            { path: ROUTES.dashboard, handle: { title: 'Dashboard' }, ...soon('Dashboard') },
            { path: ROUTES.learn, handle: { title: 'Learning paths' }, ...soon('Learning paths') },
            { path: ROUTES.mastery, handle: { title: 'Concept mastery' }, ...soon('Concept mastery') },
            { path: ROUTES.analytics, handle: { title: 'Progress analytics' }, ...soon('Analytics') },
            { path: ROUTES.history, handle: { title: 'Learning history' }, ...soon('History') },
            { path: ROUTES.resources, handle: { title: 'Resource library' }, ...soon('Resources') },
          ] },
        ],
      },
    ],
  },
  { element: <AdaptiveLayout />, children: [{ path: ROUTES.help, handle: { title: 'Help & support' }, ...soon('Help') }] },
  { element: <AdaptiveLayout />, children: [{ path: '*', element: <NotFoundPage /> }] },
]

export function AppRoutes() {
  const [router] = useState(() => createBrowserRouter(routes))
  return <RouterProvider router={router} />
}
