'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BreathingOrb } from '@/components/ui/breathing-orb'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogleSignIn() {
    const supabase = createClient()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function handleMagicLink() {
    if (!email) return
    const supabase = createClient()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setEmailSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm flex flex-col items-center text-center">
      {/* Breathing orb */}
      <div className="mb-14">
        <BreathingOrb variant="hero" />
      </div>

      {/* Title */}
      <div
        className="animate-fade-in-up"
        style={{ animation: 'fade-in-up 0.8s ease-out 0.3s both' }}
      >
        <h1 className="text-2xl font-bold tracking-tight">
          MeOS
        </h1>
      </div>

      {/* Subtitle */}
      <div
        className="animate-fade-in-up"
        style={{ animation: 'fade-in-up 0.8s ease-out 0.5s both' }}
      >
        <p className="mt-3 text-lg text-text-secondary">
          Your AI life partner
        </p>
      </div>

      {/* Auth section */}
      <div
        className="mt-12 w-full animate-fade-in-up"
        style={{ animation: 'fade-in-up 0.8s ease-out 0.7s both' }}
      >
        {emailSent ? (
          <div className="bg-bg-sage rounded-md p-lg">
            <p className="text-text font-medium mb-sm">Check your email</p>
            <p className="text-text-secondary text-sm">
              We sent a magic link to <span className="font-medium text-text">{email}</span>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-12 bg-bg-card border border-border rounded-full font-medium text-text
                         hover:bg-bg-sage transition-colors disabled:opacity-50 flex items-center justify-center gap-2
                         shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            {showEmailInput ? (
              <div className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()}
                  className="w-full h-12 px-4 bg-bg-card border border-border rounded-full text-text
                             placeholder:text-text-secondary focus:outline-none focus:ring-2
                             focus:ring-primary focus:ring-offset-2"
                />
                <button
                  onClick={handleMagicLink}
                  disabled={loading || !email}
                  className="w-full h-12 bg-primary text-white rounded-full font-medium
                             hover:bg-primary-hover transition-colors disabled:opacity-50
                             shadow-lg shadow-primary/20"
                >
                  {loading ? 'Sending...' : 'Send Magic Link'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowEmailInput(true)}
                className="w-full h-12 bg-bg border border-border rounded-full font-medium text-text-secondary
                           hover:bg-bg-sage transition-colors"
              >
                Continue with Email
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="mt-md text-sm text-accent-terra">{error}</p>
        )}

        {loading && !error && (
          <div className="mt-lg flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-secondary">Redirecting...</span>
          </div>
        )}
      </div>

      {/* Terms & privacy */}
      <div
        className="mt-16 animate-fade-in-up"
        style={{ animation: 'fade-in-up 0.8s ease-out 0.9s both' }}
      >
        <p className="text-sm text-text-secondary max-w-xs mx-auto leading-relaxed">
          By continuing, you agree to our{' '}
          <a href="#" className="underline decoration-border hover:text-text transition-colors">
            Terms
          </a>{' '}
          and{' '}
          <a href="#" className="underline decoration-border hover:text-text transition-colors">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  )
}
