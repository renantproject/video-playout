/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        broadcast: {
          dark: '#0c0e14',
          panel: '#151821',
          card: '#1e2230',
          border: '#2a3044',
          accent: '#3b82f6',
          live: '#ef4444',
          cue: '#f59e0b',
          ready: '#10b981'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}

