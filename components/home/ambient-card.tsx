'use client'

const REFLECTIVE_PROMPTS = [
  'What feels most true about where you are right now?',
  'What surprised you about today?',
  'What would you tell yourself a year from now?',
  'What are you avoiding that deserves attention?',
  'What felt easy this week? What felt heavy?',
  'Where is the gap between what you say matters and how you spend your time?',
  'What would change if you trusted yourself more?',
  'What conversation have you been putting off?',
  'When did you last feel fully present?',
  'What is one thing you could let go of today?',
  'Who would benefit from hearing from you right now?',
  'What pattern keeps showing up that you haven\'t named yet?',
  'If today were the only day that mattered, what would you do differently?',
  'What would your future self thank you for starting today?',
  'What boundary needs reinforcing?',
]

function getPromptForToday(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  )
  return REFLECTIVE_PROMPTS[dayOfYear % REFLECTIVE_PROMPTS.length]
}

interface AmbientCardProps {
  onTap?: (prompt: string) => void
}

export function AmbientCard({ onTap }: AmbientCardProps) {
  const prompt = getPromptForToday()

  return (
    <div className="mx-5 mt-5 mb-6">
      <button
        type="button"
        onClick={() => onTap?.(prompt)}
        className="w-full text-left p-5 rounded-2xl transition-colors hover:bg-warm-dark/[0.03] active:bg-warm-dark/[0.06]"
      >
        <p className="text-[11px] tracking-[0.06em] font-bold uppercase text-sage/70 mb-2">
          Something to sit with
        </p>
        <p className="text-[15px] italic text-warm-dark/60 leading-relaxed">
          {prompt}
        </p>
        <p className="text-[12px] font-medium text-primary mt-3">
          Explore with Sage
        </p>
      </button>
    </div>
  )
}
