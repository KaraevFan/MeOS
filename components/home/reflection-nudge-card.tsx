'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ReflectionNudge } from '@/lib/supabase/home-data'

interface ReflectionNudgeCardProps {
  nudge: ReflectionNudge
}

export function ReflectionNudgeCard({ nudge }: ReflectionNudgeCardProps) {
  const router = useRouter()

  function handleTap() {
    // Mark nudge as used (fire-and-forget)
    const supabase = createClient()
    supabase
      .from('reflection_prompts')
      .update({ used_at: new Date().toISOString() })
      .eq('id', nudge.id)
      .then(undefined, () => {})

    // Navigate to ad-hoc session with nudge context
    router.push(`/chat?type=ad_hoc&nudge=${nudge.id}`)
  }

  return (
    <button
      onClick={handleTap}
      className="w-full text-left rounded-lg border border-accent-sage/20 bg-bg-sage/50 p-4 transition-colors
                 hover:bg-bg-sage active:scale-[0.99]"
    >
      <p className="text-xs font-medium text-accent-sage uppercase tracking-wide mb-1.5">
        Something to sit with
      </p>
      <p className="text-[15px] text-text leading-relaxed">
        {nudge.text}
      </p>
    </button>
  )
}
