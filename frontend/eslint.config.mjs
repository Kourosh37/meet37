import nextPlugin from "@next/eslint-plugin-next";
import js from "@eslint/js";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const browserGlobals = {
  AbortController: "readonly",
  Blob: "readonly",
  console: "readonly",
  document: "readonly",
  Event: "readonly",
  File: "readonly",
  FormData: "readonly",
  localStorage: "readonly",
  MediaStream: "readonly",
  navigator: "readonly",
  Request: "readonly",
  Response: "readonly",
  sessionStorage: "readonly",
  URL: "readonly",
  WebSocket: "readonly",
  window: "readonly"
};

const nodeGlobals = {
  NodeJS: "readonly",
  process: "readonly"
};

const config = [
  {
    ignores: [
      ".next/**",
      "next-env.d.ts",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "tsconfig.tsbuildinfo"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...browserGlobals,
        ...nodeGlobals
      },
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        project: false,
        sourceType: "module"
      }
    },
    plugins: {
      "@next/next": nextPlugin,
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "no-undef": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    },
    settings: {
      next: {
        rootDir: ["frontend/"]
      }
    }
  },
  {
    files: ["tests/e2e/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        MediaStream: "readonly",
        module: "readonly",
        require: "readonly",
        window: "readonly"
      },
      sourceType: "commonjs"
    }
  }
];

export default config;
