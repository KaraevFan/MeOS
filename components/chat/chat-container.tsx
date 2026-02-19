'use client'

import { useActiveSession } from '@/components/providers/active-session-provider'
import { TAB_BAR_HEIGHT_PX } from '@/lib/constants'

export function ChatContainer({ children }: { children: React.ReactNode }) {
  const { hasActiveSession } = useActiveSession()

  return (
    <div
      className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] pb-[env(safe-area-inset-bottom)]"
      style={{ bottom: hasActiveSession ? 0 : TAB_BAR_HEIGHT_PX }}
    >
      {children}
    </div>
  )
}
