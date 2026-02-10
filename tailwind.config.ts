import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#D4A574',
        'primary-hover': '#C4956A',
        'primary-glow': 'rgba(212, 165, 116, 0.3)',
        bg: '#FAF7F2',
        'bg-sage': '#F5F0E8',
        'bg-card': '#FFFFFF',
        text: '#3D3832',
        'text-secondary': '#8A7E74',
        border: 'rgba(61, 56, 50, 0.08)',
        'accent-sage': '#7D8E7B',
        'accent-terra': '#C17B5D',
        'accent-navy': '#5B6B7A',
        'status-thriving': '#7D8E7B',
        'status-stable': '#D4A574',
        'status-attention': '#C17B5D',
        'status-crisis': '#B05A5A',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '20px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(61, 56, 50, 0.06)',
        md: '0 4px 12px rgba(61, 56, 50, 0.08)',
        glow: '0 0 20px rgba(212, 165, 116, 0.25)',
      },
      fontFamily: {
        satoshi: ['Satoshi', 'DM Sans', 'sans-serif'],
      },
      fontSize: {
        xs: ['13px', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        sm: ['15px', { lineHeight: '1.5' }],
        base: ['16px', { lineHeight: '1.6' }],
        lg: ['20px', { lineHeight: '1.4', letterSpacing: '-0.02em' }],
        xl: ['24px', { lineHeight: '1.3', letterSpacing: '-0.02em' }],
        '2xl': ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
      },
      keyframes: {
        pulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pulse: 'pulse 3s ease-in-out infinite',
        'fade-up': 'fade-up 200ms ease-out',
      },
    },
  },
  plugins: [],
}

export default config
