'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useActiveSession } from '@/components/providers/active-session-provider'
import { TAB_BAR_HEIGHT_PX } from '@/lib/constants'

function getOrbHref(hour: number): string {
  if (hour < 11) return '/chat?type=open_day' // Morning → Open Day
  if (hour < 18) return '/home?capture=1'     // Mid-Day → Quick Capture (home screen capture bar)
  return '/chat?type=close_day'               // Evening → Close Day
}

function getOrbLabel(hour: number): string {
  if (hour < 11) return 'Open your day'
  if (hour < 18) return 'Quick capture'
  return 'Close your day'
}

const leftTabs = [
  {
    label: 'Home',
    href: '/home',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" className={cn(active ? 'text-amber-600' : 'text-warm-gray/50')}>
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: 'Chat',
    href: '/chat',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" className={cn(active ? 'text-amber-600' : 'text-warm-gray/50')}>
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
]

const rightTabs = [
  {
    label: 'Life Map',
    href: '/life-map',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" className={cn(active ? 'text-amber-600' : 'text-warm-gray/50')}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    label: 'History',
    href: '/history',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" className={cn(active ? 'text-amber-600' : 'text-warm-gray/50')}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
]

function TabLink({ tab }: { tab: { label: string; href: string; icon: (active: boolean) => React.ReactNode } }) {
  const pathname = usePathname()
  const isActive = pathname.startsWith(tab.href)

  return (
    <Link
      href={tab.href}
      className="flex flex-col items-center gap-1 w-14"
    >
      {tab.icon(isActive)}
      <span
        className={cn(
          'text-[10px]',
          isActive ? 'font-semibold text-amber-600' : 'font-medium text-warm-gray/50'
        )}
      >
        {tab.label}
      </span>
    </Link>
  )
}

interface BottomTabBarProps {
  onboardingCompleted: boolean
}

export function BottomTabBar({ onboardingCompleted }: BottomTabBarProps) {
  const { hasActiveSession } = useActiveSession()
  const [hour, setHour] = useState(12) // Default to midday for SSR
  const pathname = usePathname()

  useEffect(() => {
    setHour(new Date().getHours())
  }, [])

  // State machine:
  // - pre-onboarding: hide tab bar + FAB entirely
  // - active session on /chat: hide tab bar — session header replaces it with an exit affordance
  //   "Active session" = status:active with ≥1 user message (same definition as ActiveSessionCard)
  //   Idle /chat (no active session) shows the tab bar — user can navigate away freely
  // - otherwise: show tab bar + FAB
  const isActiveSession = pathname.startsWith('/chat') && hasActiveSession

  if (!onboardingCompleted || isActiveSession) {
    return null
  }

  return (
    // Centered within 430px phone container; z-10 (tab bar layer).
    // Orb is z-30 (scoped inside nav); bottom sheets are z-[40]/z-[50] and render above.
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-10">
      {/* Orb — protruding above the bar */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-7 z-30">
        {/* Background mask to blend orb into bar */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-[84px] h-[44px] bg-warm-bg/95 rounded-t-full backdrop-blur-xl" />
        <Link
          href={getOrbHref(hour)}
          aria-label={getOrbLabel(hour)}
          className="relative w-[64px] h-[64px] rounded-full flex items-center justify-center shadow-[0_6px_24px_rgba(245,158,11,0.3),0_2px_8px_rgba(245,158,11,0.15)] transition-transform active:scale-95 animate-orb-breathe z-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 35% 30%, #fbbf24 0%, #f59e0b 45%, #d97706 100%)',
          }}
        >
          <div className="absolute inset-0 rounded-full bg-white/15 animate-orb-inner-glow" />
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white relative z-10"
          >
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </Link>
      </div>

      {/* Bar */}
      <div style={{ height: TAB_BAR_HEIGHT_PX }} className="bg-warm-bg/95 backdrop-blur-xl border-t border-warm-dark/[0.06] pb-[env(safe-area-inset-bottom)] pt-3">
        <div className="flex justify-between items-start px-5 h-full">
          {/* Left Tabs */}
          <div className="flex-1 flex justify-around">
            {leftTabs.map((tab) => (
              <TabLink key={tab.href} tab={tab} />
            ))}
          </div>

          {/* Center spacer for orb */}
          <div className="w-[72px] shrink-0" />

          {/* Right Tabs */}
          <div className="flex-1 flex justify-around">
            {rightTabs.map((tab) => (
              <TabLink key={tab.href} tab={tab} />
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
