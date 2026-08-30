import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { readCoverageThresholdFile } from "./scripts/quality/check-coverage-thresholds.ts";

process.env.APP_ENV ??= "test";

const dirname = import.meta.dirname;
const coverageThresholds = readCoverageThresholdFile(
  new URL("./coverage-thresholds.json", import.meta.url),
);

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    globals: true,
    // MSW patches Node's process-wide request APIs, so concurrent project files
    // could close another file's interceptor and fall through to the network.
    fileParallelism: false,
    exclude: [...configDefaults.exclude, "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "src/**/*.{ts,tsx}",
        "netlify/functions/**/*.{ts,mts}",
        "scripts/**/*.{ts,mts}",
      ],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.stories.tsx",
        "src/**/__tests__/**",
        "src/test/**",
        "netlify/functions/**/__tests__/**",
        "scripts/**/__tests__/**",
      ],
      thresholds: coverageThresholds,
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          sequence: { groupOrder: 1 },
          include: [
            "src/**/*.test.ts",
            "netlify/**/*.test.ts",
            "scripts/**/*.test.ts",
          ],
          environment: "node",
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          sequence: { groupOrder: 2 },
          include: [
            "src/components/**/*.test.tsx",
            "src/hooks/**/*.test.tsx",
            "src/pages/**/*.test.tsx",
          ],
          environment: "happy-dom",
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          sequence: { groupOrder: 3 },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
        },
      },
    ],
  },
});
