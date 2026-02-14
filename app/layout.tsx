import type { Metadata, Viewport } from 'next'
import { ServiceWorkerRegister } from '@/components/sw-register'
import './globals.css'

export const metadata: Metadata = {
  title: 'MeOS',
  description: 'Your AI life partner — map your life, stay aligned.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MeOS',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#D97706',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
