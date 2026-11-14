import type { ReactNode } from 'react'
import { BootGate } from './boot/BootGate'
import { PreferencesProvider } from './providers/PreferencesProvider'
import { QueryProvider } from './providers/QueryProvider'
import { StudentProvider } from './providers/StudentProvider'
import { ToastProvider } from './providers/ToastProvider'
import { MotionRoot } from '@/components/motion/MotionRoot'
import { TooltipProvider } from '@/components/ui/Tooltip'

/** Provider order matters: preferences first (theme applies even to the boot screen), then the
 *  query client, then identity, and BootGate last so pages only mount once GET /meta has answered. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <QueryProvider>
        <StudentProvider>
          <ToastProvider>
            <TooltipProvider delayDuration={250}>
              <MotionRoot><BootGate>{children}</BootGate></MotionRoot>
            </TooltipProvider>
          </ToastProvider>
        </StudentProvider>
      </QueryProvider>
    </PreferencesProvider>
  )
}
