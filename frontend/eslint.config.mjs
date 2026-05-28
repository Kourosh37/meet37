// ESLint configuration placeholder.
//
// Planned responsibilities:
// - Extend Next.js recommended rules.
// - Enforce TypeScript strictness.
// - Prevent unsafe browser APIs in server components.
// - Keep hooks dependency rules enabled.

import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url))
});

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "next-env.d.ts",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**"
    ]
  }
];

export default config;
