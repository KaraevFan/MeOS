'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Tracks user activity by updating last_active_at on mount.
 * Fire-and-forget — doesn't block rendering or report errors to UI.
 * Used for conditional Day 3 push notification gating.
 */
export function ActivityTracker() {
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('users')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', user.id)
          .then(undefined, () => {
            // Swallow errors — activity tracking is non-critical
          })
      }
    })
  }, [])

  return null
}
