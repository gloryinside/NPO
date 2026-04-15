import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Playwright specs live under `e2e/` and use @playwright/test — keep them
    // out of vitest collection to avoid the "Playwright Test did not expect
    // test.describe() to be called here" runtime error.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
