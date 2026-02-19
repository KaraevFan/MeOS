'use client'

import type { ReactNode } from 'react'
import { SidebarProvider } from './sidebar-context'
import type { SessionType } from '@/types/chat'

interface ChatLayoutProps {
  userId: string
  sessionType: SessionType
  children: ReactNode
}

/**
 * Wraps ChatView in SidebarProvider so useSidebarContext() is safe in all session types.
 * Progress indicator is handled by LifeMapProgressPill inside ChatView.
 * (LifeMapSidebar is parked for future desktop layout.)
 */
export function ChatLayout({ children }: ChatLayoutProps) {
  return <SidebarProvider>{children}</SidebarProvider>
}
