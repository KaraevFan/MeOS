'use client'

import Link from 'next/link'

export function CaptureBar() {
  return (
    <div className="mx-5 mt-4">
      <Link
        href="/chat?type=ad_hoc"
        className="w-full flex items-center gap-3 px-4 h-[46px] rounded-2xl bg-warm-dark/[0.03] border border-warm-dark/[0.05] transition-colors hover:bg-warm-dark/[0.05] active:bg-warm-dark/[0.07]"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-500/80"
        >
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span className="text-[14px] text-warm-gray font-medium">
          Drop a thought
        </span>
      </Link>
    </div>
  )
}
