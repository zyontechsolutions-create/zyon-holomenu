/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F5F0E4",
        creamDeep: "#EDE4CF",
        paper: "#FBF8F1",
        ink: "#1E1B16",
        inkSoft: "#6b6455",
        gold: "#B8873F",
        goldDeep: "#8C6428",
        navy: "#15161C",
      },
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        sans: ["'Jost'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
