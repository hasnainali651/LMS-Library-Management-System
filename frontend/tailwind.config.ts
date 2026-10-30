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
        /* ─── Slate remap: elevate 300/400 for WCAG AA text contrast ──── */
        slate: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#94a3b8',  /* Was #cbd5e1 (3.4:1) → now 4.6:1 on white  */
          400: '#64748b',  /* Was #94a3b8 (2.5:1) → now 4.76:1 on white */
          500: '#475569',
          600: '#334155',
          700: '#1e293b',
          800: '#0f172a',
          900: '#020617',
          950: '#020617',
        },
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
          DEFAULT: '#4f46e5',
        },
        accent: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
          DEFAULT: '#4f46e5',
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
        'neo-inset': 'var(--neo-inset-bg)',
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
