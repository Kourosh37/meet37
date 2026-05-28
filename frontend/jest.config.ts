// Jest configuration placeholder.
//
// Planned responsibilities:
// - Run unit tests for hooks, stores, services, and pure utilities.
// - Configure jsdom for React component and browser API tests.
// - Map the "@/..." alias to src.
// - Load test setup for React Testing Library matchers.

import nextJest from "next/jest";
import type { Config } from "jest";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  }
};

export default createJestConfig(config);
