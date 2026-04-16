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
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: "unit",
          environment: "node",
          globals: true,
          include: ["tests/unit/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
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
