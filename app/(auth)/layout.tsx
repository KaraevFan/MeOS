export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-[430px] min-h-[100dvh] bg-bg flex items-center justify-center px-md shadow-[0_0_60px_rgba(0,0,0,0.07)] relative">
      {children}
    </div>
  )
}
