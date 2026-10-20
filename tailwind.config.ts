import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        loop: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bce0ff",
          300: "#8ecdff",
          400: "#59b0ff",
          500: "#338fff",
          600: "#1b70f5",
          700: "#1559e1",
          800: "#1849b6",
          900: "#1a418f"
        },
        lime: {
          400: "#a3e635",
          500: "#84cc16"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 12px 32px -18px rgba(15,23,42,.18)"
      }
    }
  },
  plugins: []
};

export default config;
