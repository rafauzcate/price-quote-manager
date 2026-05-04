/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0A1628',
          900: '#101C2F',
          800: '#1a2332',
          700: '#2D3E50',
          600: '#44576e',
        },
        gold: {
          500: '#D4AF37',
          400: '#F4D03F',
          600: '#B8960E',
        },
        slatePremium: {
          50: '#f8fafc',
          100: '#eef2f7',
          200: '#d6dee8',
          300: '#bcc9d8',
          400: '#8fa2b8',
          500: '#6c829b',
          600: '#51657f',
          700: '#3c4f67',
          800: '#2a3749',
          900: '#1b2635',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        premium: '0 20px 40px rgba(10, 22, 40, 0.22)',
        glass: '0 8px 24px rgba(10, 22, 40, 0.12)',
      },
      backgroundImage: {
        'premium-gradient': 'linear-gradient(135deg, #0A1628 0%, #1a2332 50%, #2D3E50 100%)',
        'gold-glow': 'radial-gradient(circle at center, rgba(212,175,55,0.4), transparent 70%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};
