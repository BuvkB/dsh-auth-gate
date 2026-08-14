import js from "@eslint/js";
import globals from "globals";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * ESLint flat configuration for dsh-auth (a Node library).
 *
 * Mirrors the rsp/com baseline, minus the browser-only pieces (React, TanStack
 * Query, FSD layers, Stylelint). The complexity/length caps the reference
 * project enforces through Betterer are applied directly as rules here: the
 * repo starts below every threshold, so a fresh baseline is trivially clean.
 */
export default defineConfig([
  globalIgnores(["node_modules", "lib", "dist", "coverage"]),
  {
    files: ["**/*.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
    ],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      "import-x/resolver": {
        typescript: { project: ["./tsconfig.json"] },
      },
    },
    rules: {
      "import-x/order": "off",
      "no-console": "error",
      "no-nested-ternary": "error",
      // Complexity/length caps (rsp/com baseline: ADR-0012 values).
      complexity: ["error", 15],
      "max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
      // Default .sort()/.toSorted() is lexicographic and unreliable outside
      // plain ASCII strings; require an explicit comparator.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(sort|toSorted)$/][arguments.length=0]",
          message:
            "Provide a compare function to .sort()/.toSorted(): default sort is lexicographic and unreliable outside plain ASCII strings.",
        },
      ],
    },
  },
  // Tests: identical rules, explicit vitest imports (no ambient globals needed).
  {
    files: ["src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  // Build/config scripts are Node tooling, not shipped logic: console allowed.
  {
    files: ["*.config.{ts,js,mjs}", "scripts/**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "no-console": "off",
    },
  },
]);
