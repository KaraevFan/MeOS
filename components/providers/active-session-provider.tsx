'use client'

import { createContext, useContext, useState, useCallback, useMemo } from 'react'

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
  const [hasActiveSession, setHasActiveSessionRaw] = useState(initialValue)
  const setHasActiveSession = useCallback((v: boolean) => {
    setHasActiveSessionRaw(v)
  }, [])

  const value = useMemo(
    () => ({ hasActiveSession, setHasActiveSession }),
    [hasActiveSession, setHasActiveSession]
  )

  return (
    <ActiveSessionContext.Provider value={value}>
      {children}
    </ActiveSessionContext.Provider>
  )
}
