'use client'

import type { ReactNode } from 'react'
import { SidebarProvider } from './sidebar-context'
import { LifeMapSidebar } from './life-map-sidebar'
import type { SessionType } from '@/types/chat'

interface ChatLayoutProps {
  userId: string
  sessionType: SessionType
  children: ReactNode
}

/**
 * Wraps ChatView + LifeMapSidebar in a CSS Grid layout.
 * Sidebar only appears on desktop (lg+) for life_mapping sessions.
 */
export function ChatLayout({ userId, sessionType, children }: ChatLayoutProps) {
  const showSidebar = sessionType === 'life_mapping'

  if (!showSidebar) {
    return <>{children}</>
  }

  return (
    <SidebarProvider>
      <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_auto]">
        {children}
        <LifeMapSidebar userId={userId} sessionId={null} />
      </div>
    </SidebarProvider>
  )
}
