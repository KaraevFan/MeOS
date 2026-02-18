'use client'

import Link from 'next/link'

interface HeroCardProps {
  icon: React.ReactNode
  title: string
  sageText: string
  ctaText: string
  ctaHref: string
}

export function HeroCard({ icon, title, sageText, ctaText, ctaHref }: HeroCardProps) {
  return (
    <div className="mx-5 mt-3">
      <div className="rounded-3xl p-6 bg-gradient-to-br from-amber-100/60 via-amber-50/40 to-orange-50/20 border border-amber-200/30 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-3">
            {icon && (
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                {icon}
              </div>
            )}
            <h2 className="text-[20px] font-bold text-warm-dark leading-tight tracking-[-0.02em]">
              {title}
            </h2>
          </div>

          <p className="text-[15px] text-warm-dark/70 leading-relaxed font-medium mb-5 pl-[2px]">
            {sageText}
          </p>

          <Link
            href={ctaHref}
            className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl h-[48px] text-[15px] font-semibold transition-colors shadow-[0_2px_8px_rgba(245,158,11,0.25)] flex items-center justify-center gap-2"
          >
            {ctaText}
          </Link>
        </div>
      </div>
    </div>
  )
}
