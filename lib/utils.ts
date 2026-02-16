import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Derive a display name with fallback chain:
 * display_name -> email prefix -> null
 */
export function getDisplayName(user: {
  display_name?: string | null
  email?: string | null
}): string | null {
  if (user.display_name) return user.display_name

  const email = user.email || ''
  const name = email.split('@')[0]?.split(/[._+-]/)[0] || null
  if (name) return name.charAt(0).toUpperCase() + name.slice(1)

  return null
}
