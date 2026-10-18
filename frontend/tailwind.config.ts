import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f5fa',
          100: '#e1ecf6',
          200: '#c5d9ec',
          300: '#99bfdd',
          400: '#679eca',
          500: '#4381b4',
          600: '#326797',
          700: '#29537c',
          800: '#254767',
          900: '#1c3147',
          950: '#0f1d2b',
          DEFAULT: '#29537c',
        },
        accent: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb', // base
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
          DEFAULT: '#2563eb',
        },
      },
      boxShadow: {
        'neo':         'var(--neo-raised)',
        'neo-sm':      'var(--neo-raised-sm)',
        'neo-lg':      'var(--neo-raised-lg)',
        'neo-inset':   'var(--neo-inset)',
        'neo-inset-sm':'var(--neo-inset-sm)',
        'neo-flat':    'var(--neo-flat)',
        'neo-accent':  'var(--neo-accent-glow)',
      },
      borderRadius: {
        'neo-sm':  'var(--neo-r-sm)',
        'neo-md':  'var(--neo-r-md)',
        'neo-lg':  'var(--neo-r-lg)',
        'neo-xl':  'var(--neo-r-xl)',
      },
      backgroundColor: {
        'neo':       'var(--neo-bg)',
        'neo-card':  'var(--neo-card)',
        'neo-surf':  'var(--neo-surface)',
      },
      textColor: {
        'neo':   'var(--neo-text)',
        'neo-2': 'var(--neo-text-2)',
        'neo-3': 'var(--neo-text-3)',
      },
      fontFamily: {
        sans: ['Inter', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'var(--font-display)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulseSlow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
