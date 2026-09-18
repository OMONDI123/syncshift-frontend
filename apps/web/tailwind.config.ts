import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0B1B3A",
          900: "#0F2148",
          800: "#14264D",
          700: "#1B3163",
        },
        gold: {
          500: "#F5A623",
          600: "#DB8F14",
          100: "#FDEBC9",
        },
        ink: {
          900: "#1A1F2B",
          600: "#4B5468",
          400: "#8A93A8",
        },
        paper: {
          50: "#F7F8FA",
          100: "#EEF0F4",
        },
        signal: {
          red: "#E5484D",
          redBg: "#FBE7E7",
          green: "#2FAE66",
          greenBg: "#E4F6EC",
          amber: "#F0A93A",
          amberBg: "#FDF2E1",
        },
      },
      fontFamily: {
        heading: ["Manrope", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
        ticket: "6px",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(11, 27, 58, 0.06), 0 1px 0 rgba(11,27,58,0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
