/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E', // Primary Deep Teal
          800: '#115E59',
          900: '#134E4A',
          950: '#042F2E',
        },
        status: {
          paid: '#16A34A',     // Green
          paidLight: '#DCFCE7',
          overdue: '#DC2626',  // Red
          overdueLight: '#FEE2E2',
          partial: '#D97706',  // Amber
          partialLight: '#FEF3C7',
        }
      },
      minHeight: {
        touch: '56px',
      },
      minWidth: {
        touch: '56px',
      }
    },
  },
  plugins: [],
}

