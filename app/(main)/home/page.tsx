import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="px-md pt-2xl">
      <h1 className="text-2xl font-bold tracking-tight mb-2">
        Hey there
      </h1>
      <p className="text-text-secondary mb-xl">
        Ready to map your life? Let&apos;s talk.
      </p>
      <Link
        href="/chat"
        className="inline-flex items-center justify-center h-12 px-6 bg-primary text-white rounded-md font-medium
                   hover:bg-primary-hover transition-colors"
      >
        Talk to Sage
      </Link>
    </div>
  )
}
