const REFLECTIVE_PROMPTS = [
  'What feels most true about where you are right now?',
  'What surprised you about today?',
  'What would you tell yourself a year from now?',
  'What are you avoiding that deserves attention?',
  'What felt easy this week? What felt heavy?',
  'Where is the gap between what you say matters and how you spend your time?',
  'What would change if you trusted yourself more?',
]

function getPromptForToday(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  )
  return REFLECTIVE_PROMPTS[dayOfYear % REFLECTIVE_PROMPTS.length]
}

export function AmbientCard() {
  const prompt = getPromptForToday()

  return (
    <div className="mx-5 mt-5 mb-6">
      <div className="w-full text-left p-5 rounded-2xl">
        <p className="text-[11px] tracking-[0.06em] font-bold uppercase text-sage/70 mb-2">
          Something to sit with
        </p>
        <p className="text-[15px] italic text-warm-dark/60 leading-relaxed">
          {prompt}
        </p>
      </div>
    </div>
  )
}
