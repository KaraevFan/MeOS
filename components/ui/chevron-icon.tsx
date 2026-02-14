import { cn } from '@/lib/utils'

interface ChevronIconProps {
  rotated?: boolean
  className?: string
}

export function ChevronIcon({ rotated, className }: ChevronIconProps) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={cn(
        'text-text-secondary transition-transform',
        rotated && 'rotate-180',
        className
      )}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
