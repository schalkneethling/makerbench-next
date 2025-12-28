import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: [...configDefaults.exclude, "**/e2e/**"],
    environmentMatchGlobs: [
      ["src/components/**/*.test.tsx", "happy-dom"],
      ["src/components/**/__tests__/*.test.tsx", "happy-dom"],
    ],
  },
});
