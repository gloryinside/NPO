import { defineConfig } from "vitest/config";
import path from "node:path";

const sharedResolve = {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
};

// Split unit/integration into vitest projects so that integration-only
// setup (env loader that reaches into `.env.local`/`.env`) does not
// pollute unit test runs. Playwright specs live under `e2e/` and are
// excluded globally — they use @playwright/test, not vitest.
export default defineConfig({
  resolve: sharedResolve,
  test: {
    // G-D142: coverage 기본 옵션 (vitest run --coverage 로 활성)
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
        "src/components/**",
      ],
      thresholds: {
        // 초기 기준선 — 점진 상향. lines 기준.
        lines: 15,
        functions: 20,
        branches: 60,
        statements: 15,
      },
    },
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
          exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
          setupFiles: ["tests/unit/a11y-setup.ts"],
        },
      },
      {
        resolve: sharedResolve,
        test: {
          name: "integration",
          environment: "node",
          globals: true,
          include: ["tests/integration/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
          setupFiles: ["tests/integration/setup.ts"],
        },
      },
    ],
  },
});
