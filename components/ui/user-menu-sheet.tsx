'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface UserMenuSheetProps {
  email: string
  initial: string
  initialHasCalendar: boolean
}

export function UserMenuSheet({ email, initial, initialHasCalendar }: UserMenuSheetProps) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [hasCalendar, setHasCalendar] = useState(initialHasCalendar)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const router = useRouter()

  const handleSignOut = useCallback(async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }, [router])

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/calendar/disconnect', { method: 'POST' })
      if (res.ok) {
        setHasCalendar(false)
        setShowDisconnectConfirm(false)
        router.refresh()
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setDisconnecting(false)
    }
  }, [router])

  return (
    <>
      {/* Avatar trigger */}
      <button
        onClick={() => setOpen(true)}
        className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center
                   text-sm font-semibold text-primary transition-colors hover:bg-primary/25
                   active:scale-95"
        aria-label="User menu"
      >
        {initial}
      </button>

      {/* Backdrop — above tab bar (z-10), below sheet (z-[50]) */}
      {open && (
        <div
          className="fixed inset-0 z-[40] bg-text/20"
          style={{ opacity: 1, transition: 'opacity 150ms ease-out' }}
          onClick={() => { setOpen(false); setShowDisconnectConfirm(false) }}
        />
      )}

      {/* Bottom sheet — constrained to 430px container, above backdrop */}
      <div
        className={cn(
          'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[50]',
          'bg-bg-card rounded-t-lg shadow-md px-lg pt-lg pb-2xl',
          'transition-transform duration-200 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ paddingBottom: 'max(48px, env(safe-area-inset-bottom))' }}
      >
        {/* Handle */}
        <div className="flex justify-center mb-lg">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* User info */}
        <div className="flex items-center gap-md mb-lg">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center
                          text-base font-semibold text-primary">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-text truncate">{email}</p>
            <p className="text-xs text-text-secondary">MeOS</p>
          </div>
        </div>

        {/* Calendar integration */}
        <div className="mb-3">
          {hasCalendar ? (
            showDisconnectConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex-1 h-12 rounded-md text-sm font-medium text-accent-terra
                             bg-accent-terra/10 hover:bg-accent-terra/15 transition-colors
                             disabled:opacity-50 active:scale-[0.98]"
                >
                  {disconnecting ? 'Disconnecting...' : 'Confirm disconnect'}
                </button>
                <button
                  onClick={() => setShowDisconnectConfirm(false)}
                  className="h-12 px-4 rounded-md text-sm font-medium text-text-secondary
                             hover:bg-bg-sage transition-colors active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="w-full h-12 rounded-md text-sm font-medium text-text-secondary
                           flex items-center justify-between px-4
                           hover:bg-bg-sage transition-colors active:scale-[0.98]"
              >
                <span className="flex items-center gap-2.5">
                  <CalendarIcon />
                  Google Calendar
                </span>
                <span className="text-xs text-accent-sage font-semibold">Connected</span>
              </button>
            )
          ) : (
            <a
              href="/api/calendar/connect"
              className="w-full h-12 rounded-md text-sm font-medium text-text
                         flex items-center gap-2.5 px-4
                         hover:bg-bg-sage transition-colors active:scale-[0.98]"
            >
              <CalendarIcon />
              Connect Google Calendar
            </a>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full h-12 rounded-md text-sm font-medium text-accent-terra
                     bg-accent-terra/10 hover:bg-accent-terra/15 transition-colors
                     disabled:opacity-50 active:scale-[0.98]"
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </>
  )
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
