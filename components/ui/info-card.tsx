import { cn } from '@/lib/utils'

interface InfoCardProps {
  borderColor?: 'amber' | 'sage' | 'terracotta' | 'blue-gray'
  children: React.ReactNode
  className?: string
}

const borderColors = {
  amber: 'border-l-amber-400',
  sage: 'border-l-sage',
  terracotta: 'border-l-terracotta',
  'blue-gray': 'border-l-blue-gray',
}

export function InfoCard({ borderColor = 'amber', children, className }: InfoCardProps) {
  return (
    <div
      className={cn(
        'mx-5 mt-4 bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(61,56,50,0.04)] border border-warm-dark/[0.04] border-l-[4px]',
        borderColors[borderColor],
        className,
      )}
    >
      {children}
    </div>
  )
}
