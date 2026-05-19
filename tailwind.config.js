/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0c10",
          soft: "#111217",
          card: "#15171f",
          ring: "#1f2230",
        },
        accent: {
          DEFAULT: "#6ee7b7",
          glow: "#7dd3fc",
          ring: "rgba(110,231,183,0.45)",
        },
        danger: "#ff5c5c",
        ok: "#5cffae",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: [
          "InterDisplay",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(110,231,183,0.22), 0 8px 40px -8px rgba(110,231,183,0.28)",
        card: "0 10px 40px -20px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "grid-fade": "radial-gradient(ellipse at top, rgba(110,231,183,0.1), transparent 60%)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 8s linear infinite",
      },
    },
  },
  plugins: [],
};
