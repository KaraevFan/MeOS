'use client'

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface SidebarContextValue {
  activeDomain: string | null
  setActiveDomain: (domain: string | null) => void
}

const SidebarContext = createContext<SidebarContextValue>({
  activeDomain: null,
  setActiveDomain: () => {},
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [activeDomain, setActiveDomain] = useState<string | null>(null)

  return (
    <SidebarContext.Provider value={{ activeDomain, setActiveDomain }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarContext() {
  return useContext(SidebarContext)
}
