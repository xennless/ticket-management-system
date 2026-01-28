/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-in-out',
        'slide-up': 'slideUp 200ms ease-in-out',
        'slide-down': 'slideDown 200ms ease-in-out',
        'scale-in': 'scaleIn 200ms ease-in-out',
      },
    },
  },
  plugins: [],
}

