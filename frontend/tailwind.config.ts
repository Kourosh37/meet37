import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "./tests/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        "muted-foreground": "rgb(var(--muted-foreground) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-foreground": "rgb(var(--surface-foreground) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-foreground": "rgb(var(--primary-foreground) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        "danger-foreground": "rgb(var(--danger-foreground) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)"
      },
      fontFamily: {
        mono: ["var(--meet-font-current)"],
        sans: ["var(--meet-font-current)"]
      }
    }
  },
  plugins: []
};

export default config;
