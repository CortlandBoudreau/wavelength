/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Matches web app CSS variables exactly
        surface: "#F5F0E8",   // --sand: main screen background
        card:    "#ffffff",   // white cards
        deep:    "#1a2a3a",   // --deep: nav bar, dark tiles
        ocean:   "#4A9EDB",   // --ocean: primary accent
        "ocean-dark": "#2c7cb8",
        "ocean-light": "#e8f4fd",
        border:  "#e0e7ef",   // --border
        textprimary: "#2c3e50", // --text
        muted:   "#6b7a8d",   // --muted
        // Score badge colors matching web
        "score-green": "#22c55e",
        "score-amber": "#f59e0b",
        "score-gray":  "#6b7280",
      },
    },
  },
  plugins: [],
};
