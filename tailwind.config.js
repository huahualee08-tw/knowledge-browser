/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        surface: {
          900: '#0f1117',
          800: '#161b27',
          700: '#1e2535',
          600: '#252d3d',
          500: '#2d3748',
        },
      },
    },
  },
  plugins: [],
}
