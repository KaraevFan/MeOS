'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'

interface SidebarContextValue {
  activeDomain: string | null
  setActiveDomain: (domain: string | null) => void
  /** True while Sage is streaming a response */
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void
  /** Domain name that was most recently completed (resets to null after 3s) */
  lastCompletedDomain: string | null
  /** Signal a domain completion — auto-resets after the given duration */
  signalDomainCompleted: (domain: string) => void
}

const COMPLETION_SIGNAL_DURATION = 3000 // ms

const SidebarContext = createContext<SidebarContextValue>({
  activeDomain: null,
  setActiveDomain: () => {},
  isStreaming: false,
  setIsStreaming: () => {},
  lastCompletedDomain: null,
  signalDomainCompleted: () => {},
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [activeDomain, setActiveDomain] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [lastCompletedDomain, setLastCompletedDomain] = useState<string | null>(null)

  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const signalDomainCompleted = useCallback((domain: string) => {
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current)
    setLastCompletedDomain(domain)
    completionTimerRef.current = setTimeout(() => {
      setLastCompletedDomain(null)
      completionTimerRef.current = null
    }, COMPLETION_SIGNAL_DURATION)
  }, [])

  return (
    <SidebarContext.Provider value={{
      activeDomain,
      setActiveDomain,
      isStreaming,
      setIsStreaming,
      lastCompletedDomain,
      signalDomainCompleted,
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarContext() {
  return useContext(SidebarContext)
}
