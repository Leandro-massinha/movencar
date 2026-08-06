/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#FFF7CC', 500: '#FFD600', 600: '#E8C200', 700: '#B99B00' },
        purple: { 50: '#EDE9FE', 500: '#7C3AED', 700: '#5B21B6' },
        lime: { 50: '#F1FFD1', 500: '#B7FF00', 700: '#6B9400' },
        ink: '#111827',
        canvas: '#F5F7FB',
      },
      boxShadow: { panel: '0 1px 2px rgb(15 23 42 / 6%), 0 8px 24px rgb(15 23 42 / 5%)' },
    },
  },
  plugins: [],
}
