import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertSerializedWithinByteLimit,
  checkPerformanceBudgetFiles,
  evaluatePerformanceBudget,
  type PerformanceBudgetConfig,
} from "../budget.ts";
import type {
  MetricDistribution,
  NetworkMetricSummary,
  PerformanceSummary,
} from "../summary.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const distribution = (value: number): MetricDistribution => ({
  sampleCount: 5,
  missingRunCount: 0,
  p50: value,
  p75: value,
  max: value,
});

const networkDistribution = (value: number): NetworkMetricSummary => ({
  ...distribution(value),
  total: value * 5,
});

const summary: PerformanceSummary = {
  schemaVersion: 1,
  target: "https://makerbench.schalkneethling.com",
  capturedAt: "2026-08-30T10:00:00.000Z",
  runCount: 5,
  scenarios: [
    {
      device: "desktop",
      scenario: "cold-tools-load",
      runCount: 5,
      metrics: {
        navigationDurationMs: distribution(900),
        firstContentfulPaintMs: distribution(300),
        largestContentfulPaintMs: distribution(1_000),
        cumulativeLayoutShift: distribution(0.01),
        interactionLatencyMs: distribution(20),
        longTaskDurationMs: distribution(10),
        longAnimationFrameDurationMs: distribution(15),
        scenarioDurationMs: distribution(1_200),
      },
      network: {
        requestCount: networkDistribution(10),
        transferBytes: networkDistribution(50_000),
      },
    },
  ],
};

const passingConfig: PerformanceBudgetConfig = {
  schemaVersion: 1,
  requiredRunsPerScenario: 5,
  requiredScenarios: [{ device: "desktop", scenario: "cold-tools-load" }],
  budgets: [
    {
      source: "browser",
      device: "desktop",
      scenario: "cold-tools-load",
      metric: "largestContentfulPaintMs",
      statistic: "p75",
      maximum: 1_100,
    },
    {
      source: "network",
      device: "desktop",
      scenario: "cold-tools-load",
      metric: "transferBytes",
      statistic: "p75",
      maximum: 55_000,
    },
  ],
};

describe("evaluatePerformanceBudget", () => {
  it("passes complete evidence within every absolute ceiling", () => {
    expect(evaluatePerformanceBudget(summary, passingConfig)).toEqual({
      schemaVersion: 1,
      status: "passed",
      requiredRunsPerScenario: 5,
      checkedBudgetCount: 2,
      violations: [],
    });
  });

  it("fails closed for incomplete runs, absent scenarios, and regressions", () => {
    const failed = evaluatePerformanceBudget(
      {
        ...summary,
        scenarios: [
          {
            ...summary.scenarios[0],
            runCount: 4,
            metrics: {
              ...summary.scenarios[0]!.metrics,
              largestContentfulPaintMs: {
                ...summary.scenarios[0]!.metrics.largestContentfulPaintMs,
                sampleCount: 4,
                missingRunCount: 1,
              },
            },
            network: {
              ...summary.scenarios[0]!.network,
              transferBytes: {
                ...summary.scenarios[0]!.network.transferBytes,
                sampleCount: 4,
                missingRunCount: 0,
              },
            },
          },
        ],
      },
      {
        ...passingConfig,
        requiredScenarios: [
          ...passingConfig.requiredScenarios,
          { device: "mobile", scenario: "cold-tools-load" },
        ],
        budgets: [
          {
            ...passingConfig.budgets[0],
            maximum: 900,
          },
          {
            ...passingConfig.budgets[1],
            maximum: 40_000,
          },
        ],
      },
    );

    expect(failed.status).toBe("failed");
    expect(failed.violations.map(({ reason }) => reason)).toEqual([
      "unexpected-run-count",
      "missing-scenario",
      "missing-metric",
      "budget-exceeded",
    ]);
  });

  it("rejects duplicate and out-of-scope versioned configuration", () => {
    expect(() =>
      evaluatePerformanceBudget(summary, {
        ...passingConfig,
        requiredScenarios: [
          passingConfig.requiredScenarios[0]!,
          passingConfig.requiredScenarios[0]!,
        ],
      }),
    ).toThrow("repeats required scenario");

    expect(() =>
      evaluatePerformanceBudget(summary, {
        ...passingConfig,
        budgets: [passingConfig.budgets[0]!, passingConfig.budgets[0]!],
      }),
    ).toThrow("repeats desktop\u0000cold-tools-load/browser");

    expect(() =>
      evaluatePerformanceBudget(summary, {
        ...passingConfig,
        budgets: [
          {
            ...passingConfig.budgets[0]!,
            device: "mobile",
          },
        ],
      }),
    ).toThrow("references non-required scenario mobile\u0000cold-tools-load");
  });

  it("rejects duplicate scenario evidence before applying budgets", () => {
    expect(() =>
      evaluatePerformanceBudget(
        {
          ...summary,
          scenarios: [summary.scenarios[0]!, summary.scenarios[0]!],
        },
        passingConfig,
      ),
    ).toThrow("contains duplicate desktop/cold-tools-load evidence");
  });

  it("fails closed when a statistic is null or its samples are incomplete", () => {
    const incompleteDistributions = [
      {
        ...summary.scenarios[0]!.metrics.largestContentfulPaintMs,
        p75: null,
      },
      {
        ...summary.scenarios[0]!.metrics.largestContentfulPaintMs,
        missingRunCount: 1,
      },
      {
        ...summary.scenarios[0]!.metrics.largestContentfulPaintMs,
        sampleCount: 4,
      },
    ];

    for (const incomplete of incompleteDistributions) {
      const failed = evaluatePerformanceBudget(
        {
          ...summary,
          scenarios: [
            {
              ...summary.scenarios[0]!,
              metrics: {
                ...summary.scenarios[0]!.metrics,
                largestContentfulPaintMs: incomplete,
              },
            },
          ],
        },
        passingConfig,
      );

      expect(failed.violations).toEqual([
        expect.objectContaining({
          reason: "missing-metric",
          actual: incomplete.p75,
        }),
      ]);
    }
  });

  it("reports absent required evidence and skips its budget lookup", () => {
    const mobileBudget = {
      ...passingConfig.budgets[0]!,
      device: "mobile" as const,
    };
    const failed = evaluatePerformanceBudget(summary, {
      ...passingConfig,
      requiredScenarios: [
        ...passingConfig.requiredScenarios,
        { device: "mobile", scenario: "cold-tools-load" },
      ],
      budgets: [...passingConfig.budgets, mobileBudget],
    });

    expect(failed.violations).toEqual([
      {
        device: "mobile",
        scenario: "cold-tools-load",
        reason: "missing-scenario",
      },
    ]);
  });
});

describe("checkPerformanceBudgetFiles", () => {
  it("persists failed budget evidence before returning the result", async () => {
    const directory = await mkdtemp(join(tmpdir(), "makerbench-budget-"));
    temporaryDirectories.push(directory);
    const summaryPath = join(directory, "summary.json");
    const budgetPath = join(directory, "budgets.json");
    const evidencePath = join(directory, "budget-result.json");

    await writeFile(summaryPath, JSON.stringify(summary), "utf8");
    await writeFile(
      budgetPath,
      JSON.stringify({
        ...passingConfig,
        budgets: [
          {
            ...passingConfig.budgets[0],
            maximum: 900,
          },
        ],
      }),
      "utf8",
    );

    const report = await checkPerformanceBudgetFiles({
      summaryPath,
      budgetPath,
      evidencePath,
    });

    expect(report.status).toBe("failed");
    expect(JSON.parse(await readFile(evidencePath, "utf8"))).toMatchObject({
      status: "failed",
      violations: [
        {
          reason: "budget-exceeded",
          actual: 1_000,
          maximum: 900,
        },
      ],
    });
  });

  it("rejects a non-file input before attempting to read it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "makerbench-budget-"));
    temporaryDirectories.push(directory);
    const summaryPath = join(directory, "summary.json");

    await writeFile(summaryPath, JSON.stringify(summary), "utf8");

    await expect(
      checkPerformanceBudgetFiles({
        summaryPath,
        budgetPath: directory,
        evidencePath: join(directory, "budget-result.json"),
      }),
    ).rejects.toThrow("Performance budget must be a file");
  });

  it("rejects an oversized budget before allocating its contents", async () => {
    const directory = await mkdtemp(join(tmpdir(), "makerbench-budget-"));
    temporaryDirectories.push(directory);
    const summaryPath = join(directory, "summary.json");
    const budgetPath = join(directory, "budgets.json");

    await writeFile(summaryPath, JSON.stringify(summary), "utf8");
    await writeFile(budgetPath, "x".repeat(64 * 1_024 + 1), "utf8");

    await expect(
      checkPerformanceBudgetFiles({
        summaryPath,
        budgetPath,
        evidencePath: join(directory, "budget-result.json"),
      }),
    ).rejects.toThrow("Performance budget must be a file no larger than 65536");
  });
});

describe("assertSerializedWithinByteLimit", () => {
  it("retains a post-read UTF-8 byte bound for races and encoding changes", () => {
    expect(() =>
      assertSerializedWithinByteLimit("é", 2, "summary"),
    ).not.toThrow();
    expect(() => assertSerializedWithinByteLimit("é", 1, "summary")).toThrow(
      "Performance summary exceeded 1 bytes while being read",
    );
  });
});
