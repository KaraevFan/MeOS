'use client'

import { createContext, useContext, useState } from 'react'

interface ActiveSessionContextValue {
  hasActiveSession: boolean
  setHasActiveSession: (v: boolean) => void
}

const ActiveSessionContext = createContext<ActiveSessionContextValue>({
  hasActiveSession: false,
  setHasActiveSession: () => {},
})

export function useActiveSession() {
  return useContext(ActiveSessionContext)
}

export function ActiveSessionProvider({
  initialValue,
  children,
}: {
  initialValue: boolean
  children: React.ReactNode
}) {
  const [hasActiveSession, setHasActiveSession] = useState(initialValue)

  return (
    <ActiveSessionContext.Provider value={{ hasActiveSession, setHasActiveSession }}>
      {children}
    </ActiveSessionContext.Provider>
  )
}
