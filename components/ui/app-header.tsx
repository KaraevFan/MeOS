import { UserMenuSheet } from '@/components/ui/user-menu-sheet'

interface AppHeaderProps {
  email: string
  displayName: string | null
  hasCalendar: boolean
}

export function AppHeader({ email, displayName, hasCalendar }: AppHeaderProps) {
  const initial = (displayName?.[0] || email[0] || '?').toUpperCase()

  return (
    <header className="h-12 flex items-center justify-end px-md max-w-lg mx-auto">
      <UserMenuSheet email={email} initial={initial} initialHasCalendar={hasCalendar} />
    </header>
  )
}
