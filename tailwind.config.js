/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#FAF8F4', 100: '#F0EDE7', 200: '#DED9D0', 300: '#C9C2B7',
          400: '#B4ADA3', 500: '#968E83', 600: '#797269', 700: '#49443D',
          800: '#302D28', 900: '#1A1917', 950: '#111110',
        },
        accent: {
          50: '#FBF6EB', 100: '#F5E8CD', 200: '#ECD4A5', 300: '#E1BE82',
          400: '#DCB878', 500: '#D4AE6B', 600: '#BD934F', 700: '#8B6B35',
          800: '#594626', 900: '#30291C', 950: '#1D190F',
        },
      },
    },
  },
  plugins: [],
};
