// Vitest configuration placeholder.
//
// Planned responsibilities:
// - Run fast unit tests for hooks, stores, services, and pure utilities.
// - Use jsdom for React component tests.
// - Resolve the "@/..." alias through tsconfig paths.

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}"
    ]
  }
});
