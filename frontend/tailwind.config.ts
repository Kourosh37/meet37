// Tailwind CSS configuration placeholder.
//
// Planned responsibilities:
// - Enable class-based dark mode for next-themes.
// - Scan app, components, hooks, services, stores, and lib directories.
// - Define design tokens that mirror shadcn/ui CSS variables.
// - Keep responsive breakpoints aligned with the frontend architecture document.

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "./tests/**/*.{ts,tsx}"],
  theme: {
    extend: {}
  },
  plugins: []
};

export default config;
