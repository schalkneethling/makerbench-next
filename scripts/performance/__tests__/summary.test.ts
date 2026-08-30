import { describe, expect, it } from "vitest";
import {
  createPerformanceSummary,
  renderPerformanceSummaryJson,
  renderPerformanceSummaryMarkdown,
  summarizeMetricValues,
  type PerformanceRun,
} from "../summary";

const desktopColdHomeRun: PerformanceRun = {
  device: "desktop",
  scenario: "cold-home",
  run: 1,
  metrics: {
    navigationDurationMs: 900,
    firstContentfulPaintMs: 300,
    largestContentfulPaintMs: 600,
    cumulativeLayoutShift: 0.02,
    interactionLatencyMs: 20,
    longTaskDurationMs: 10,
    scenarioDurationMs: 1_200,
  },
  network: {
    requestCount: 12,
    transferBytes: 20_000,
  },
};

describe("summarizeMetricValues", () => {
  it("uses nearest-rank percentiles without changing input order", () => {
    const values = [400, 100, 500, 200, 300];

    expect(summarizeMetricValues(values)).toEqual({
      sampleCount: 5,
      missingRunCount: 0,
      p50: 300,
      p75: 400,
      max: 500,
    });
    expect(values).toEqual([400, 100, 500, 200, 300]);
  });

  it("makes an unavailable optional browser metric explicit", () => {
    expect(summarizeMetricValues([undefined, undefined])).toEqual({
      sampleCount: 0,
      missingRunCount: 2,
      p50: null,
      p75: null,
      max: null,
    });
  });
});

describe("createPerformanceSummary", () => {
  it("sorts scenario groups and aggregates browser and network metrics", () => {
    const summary = createPerformanceSummary({
      target: "https://makerbench.schalkneethling.com",
      capturedAt: "2026-07-26T12:00:00.000Z",
      runs: [
        {
          ...desktopColdHomeRun,
          device: "mobile",
          scenario: "resource-search",
          run: 2,
          metrics: {
            navigationDurationMs: 1_400,
          },
          network: {
            requestCount: 22,
            transferBytes: 24_000,
          },
        },
        {
          ...desktopColdHomeRun,
          run: 2,
          metrics: {
            ...desktopColdHomeRun.metrics,
            navigationDurationMs: 1_000,
            largestContentfulPaintMs: 800,
            longAnimationFrameDurationMs: 12,
          },
          network: {
            requestCount: 16,
            transferBytes: 30_000,
          },
        },
        desktopColdHomeRun,
      ],
    });

    expect(
      summary.scenarios.map(({ device, scenario }) => ({ device, scenario })),
    ).toEqual([
      { device: "desktop", scenario: "cold-home" },
      { device: "mobile", scenario: "resource-search" },
    ]);

    expect(summary.scenarios[0]).toMatchObject({
      runCount: 2,
      metrics: {
        navigationDurationMs: {
          sampleCount: 2,
          missingRunCount: 0,
          p50: 900,
          p75: 1_000,
          max: 1_000,
        },
        longAnimationFrameDurationMs: {
          sampleCount: 1,
          missingRunCount: 1,
          p50: 12,
          p75: 12,
          max: 12,
        },
      },
      network: {
        requestCount: {
          total: 28,
          p50: 12,
          p75: 16,
          max: 16,
        },
        transferBytes: {
          total: 50_000,
          p50: 20_000,
          p75: 30_000,
          max: 30_000,
        },
      },
    });
  });

  it("rejects empty summaries and invalid network values", () => {
    expect(() =>
      createPerformanceSummary({
        target: "https://makerbench.schalkneethling.com",
        capturedAt: "2026-07-26T12:00:00.000Z",
        runs: [],
      }),
    ).toThrow("requires at least one run");

    expect(() =>
      createPerformanceSummary({
        target: "https://makerbench.schalkneethling.com",
        capturedAt: "2026-07-26T12:00:00.000Z",
        runs: [
          {
            ...desktopColdHomeRun,
            network: {
              requestCount: 1,
              transferBytes: -1,
            },
          },
        ],
      }),
    ).toThrow("Network transfer bytes");
  });
});

describe("summary renderers", () => {
  it("returns stable JSON and readable Markdown with missing metrics shown", () => {
    const summary = createPerformanceSummary({
      target: "https://makerbench.schalkneethling.com",
      capturedAt: "2026-07-26T12:00:00.000Z",
      runs: [desktopColdHomeRun],
    });

    expect(renderPerformanceSummaryJson(summary)).toBe(
      `${JSON.stringify(summary, null, 2)}\n`,
    );
    expect(renderPerformanceSummaryMarkdown(summary)).toContain(
      "## Desktop — cold-home",
    );
    expect(renderPerformanceSummaryMarkdown(summary)).toContain(
      "### First-party network totals",
    );
    expect(renderPerformanceSummaryMarkdown(summary)).toContain(
      "| Long animation frame duration (ms) | 0 | 1 | n/a | n/a | n/a |",
    );
    expect(renderPerformanceSummaryMarkdown(summary)).toContain(
      "| Requests | 12 | 12 | 12 | 12 |",
    );
  });
});
