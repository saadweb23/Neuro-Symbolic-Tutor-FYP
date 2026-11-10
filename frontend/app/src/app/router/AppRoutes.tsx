// Temporary bridge (Phase 2): mounts the legacy JSX app while the new pages are built. Removed in Phase 3.
import LegacyApp from '../../App.jsx'

export function AppRoutes() {
  return <LegacyApp />
}
