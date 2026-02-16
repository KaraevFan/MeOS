'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface UserMenuSheetProps {
  email: string
  initial: string
}

export function UserMenuSheet({ email, initial }: UserMenuSheetProps) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()

  const handleSignOut = useCallback(async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
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

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-text/20 animate-fade-up"
          style={{ animation: 'none', opacity: 1, transition: 'opacity 150ms ease-out' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Bottom sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 bg-bg-card rounded-t-lg shadow-md px-lg pt-lg pb-2xl',
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
