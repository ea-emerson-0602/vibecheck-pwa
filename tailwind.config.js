/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
      },
      colors: {
        ink: "#0a0612",
        surface: "#120d1e",
        card: "#1c1530",
        border: "#2a1f42",
        muted: "#4a3d6b",
        moods: {
          happy:   "#fbbf24",
          loved:   "#f472b6",
          calm:    "#60a5fa",
          sad:     "#818cf8",
          anxious: "#fb923c",
          tired:   "#a78bfa",
          angry:   "#f87171",
          excited: "#34d399",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        glow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.9" },
        },
      },
    },
  },
  plugins: [],
};
