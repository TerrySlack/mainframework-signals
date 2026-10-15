// eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  // 1) Ignore generated and vendor content
  {
    ignores: [
      "dist/**",
      "build/**",
      "coverage/**",
      ".next/**",
      "out/**",
      ".rollup.cache/**",
      "node_modules/**",
      "pnpm-lock.yaml",
      "package-lock.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
    ],
  },

  // 2) Base JS recommended rules
  js.configs.recommended,

  // 3) TypeScript type-aware rules — scoped to .ts/.tsx only
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),

  // 4) Language options for TS (type-aware; matches tsconfig.eslint.json)
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        JSX: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "19",
      },
    },
    rules: {
      ...(reactHooks.configs?.recommended?.rules ?? {}),
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // 5) React recommended rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    ...react.configs.flat.recommended,
    settings: {
      react: {
        version: "19",
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },

  // 6) JS/MJS config files — non-type-checked TypeScript rules
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.mjs", "**/*.js"],
  })),

  // 7) Globals for browser and node
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
  },

  // 8) Test files: relax strict rules and add Vitest globals
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },

  // 9) Legacy signals module (pending migration to src/shared/core)
  {
    files: ["src/shared/utils/signals/**"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-misused-promises": "off",
    },
  },

  eslintConfigPrettier,
  eslintPluginPrettierRecommended,
];
