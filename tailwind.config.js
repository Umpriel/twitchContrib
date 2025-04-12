/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  safelist: [
    'bg-gray-900',
    'text-gray-100',
    'bg-gray-800',
    'bg-gray-950',
    'text-purple-400',
    'text-blue-400',
    'text-yellow-400',
    'text-green-400',
    'text-red-400',
  ],
  plugins: [],
} 