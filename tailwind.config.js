/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        clubRed: "#E31B23",
        clubYellow: "#FFDE00",
      },
    },
  },
  plugins: [],
}