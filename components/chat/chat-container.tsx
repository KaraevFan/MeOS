'use client'

import { useActiveSession } from '@/components/providers/active-session-provider'
import { cn } from '@/lib/utils'

export function ChatContainer({ children }: { children: React.ReactNode }) {
  const { hasActiveSession } = useActiveSession()

  return (
    <div
      className={cn(
        'fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] pb-[env(safe-area-inset-bottom)]',
        hasActiveSession ? 'bottom-0' : 'bottom-[84px]'
      )}
    >
      {children}
    </div>
  )
}
