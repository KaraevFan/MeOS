export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-[430px] min-h-[100dvh] bg-bg relative shadow-[0_0_60px_rgba(0,0,0,0.07)]">
      {children}
    </div>
  )
}
