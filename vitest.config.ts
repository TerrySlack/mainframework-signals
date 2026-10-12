import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["src/tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/shared/**/*.ts"],
      exclude: ["src/shared/**/index.ts", "src/tests/**"],
      thresholds: {
        lines: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
