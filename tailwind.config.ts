import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        surface: {
          DEFAULT: 'var(--bg-surface)',
          2: 'var(--bg-surface-2)',
          hover: 'var(--bg-surface-hover)'
        },
        space: {
          950: 'var(--bg-app)',
          900: 'var(--bg-surface)',
          850: 'var(--bg-surface-2)',
          800: 'var(--bg-surface-2)',
          700: 'var(--bg-surface-hover)',
          600: 'var(--bg-surface-hover)'
        },
        neon: {
          cyan: 'var(--accent-cyan)',
          purple: 'var(--accent-purple)',
          violet: 'var(--accent-violet)',
          pink: 'var(--accent-rose)',
          magenta: 'var(--accent-magenta)',
          emerald: 'var(--accent-emerald)',
          amber: 'var(--accent-amber)',
          rose: 'var(--accent-rose)'
        }
      },
      textColor: {
        main: 'var(--text-main)',
        muted: 'var(--text-muted)',
        dim: 'var(--text-dim)'
      },
      borderColor: {
        subtle: 'var(--border-subtle)',
        active: 'var(--border-active)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      backdropBlur: {
        xs: '2px',
        glass: '16px'
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
        'neon-cyan': '0 0 20px -3px var(--accent-cyan)',
        'neon-purple': '0 0 20px -3px var(--accent-purple)',
        'neon-emerald': '0 0 20px -3px var(--accent-emerald)'
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        '4xl': '2rem'
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite alternate'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        glow: {
          '0%': { filter: 'drop-shadow(0 0 5px var(--accent-cyan))' },
          '100%': { filter: 'drop-shadow(0 0 15px var(--accent-cyan))' }
        }
      }
    }
  },
  plugins: []
} satisfies Config;
