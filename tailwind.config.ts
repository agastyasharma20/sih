import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // PIEMR institutional navy/maroon blended with SIH saffron/green accents.
        piemr: {
          50: '#eef4ff',
          100: '#dae6ff',
          200: '#bcd2ff',
          300: '#8db4ff',
          400: '#568bff',
          500: '#2e63ff',
          600: '#1743f5',
          700: '#1233e1',
          800: '#152db6',
          900: '#182c8f',
          950: '#0f1a57',
        },
        sih: {
          saffron: '#ff9933',
          green: '#138808',
          navy: '#0b1437',
        },
      },
      gridTemplateColumns: {
        // The activity heatmap is one column per hour of the day.
        24: 'repeat(24, minmax(0, 1fr))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        // Sweeps a highlight across skeletons and hovered surfaces.
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        // A slow breath for status dots that mean "live".
        'pulse-ring': {
          '0%': { transform: 'scale(.85)', opacity: '.7' },
          '70%, 100%': { transform: 'scale(1.9)', opacity: '0' },
        },
      },
      animation: {
        'gradient-pan': 'gradient-pan 12s ease infinite',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(.24,.4,.36,1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
