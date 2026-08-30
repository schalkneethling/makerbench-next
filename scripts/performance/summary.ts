/** A browser profile used for a production performance run. */
export type PerformanceDevice = "desktop" | "mobile";

/** Browser metrics collected for one scenario run, in milliseconds unless noted. */
export interface BrowserPerformanceMetrics {
  navigationDurationMs?: number;
  firstContentfulPaintMs?: number;
  largestContentfulPaintMs?: number;
  cumulativeLayoutShift?: number;
  interactionLatencyMs?: number;
  longTaskDurationMs?: number;
  longAnimationFrameDurationMs?: number;
  scenarioDurationMs?: number;
}

/** Request and transfer totals calculated from one scenario run's resource entries. */
export interface NetworkTotals {
  requestCount: number;
  transferBytes: number;
}

/** The measurements collected from one fresh browser context. */
export interface PerformanceRun {
  device: PerformanceDevice;
  scenario: string;
  run: number;
  metrics: BrowserPerformanceMetrics;
  network: NetworkTotals;
}

/** Inputs required to produce a portable performance baseline summary. */
export interface PerformanceSummaryInput {
  target: string;
  capturedAt: string;
  runs: readonly PerformanceRun[];
}

/** A deterministic nearest-rank percentile distribution. */
export interface MetricDistribution {
  sampleCount: number;
  missingRunCount: number;
  p50: number | null;
  p75: number | null;
  max: number | null;
}

/** A network metric distribution with the summed result across all runs. */
export interface NetworkMetricSummary extends MetricDistribution {
  total: number;
}

/** Browser metrics, including explicit absent-metric counts. */
export type BrowserMetricsSummary = {
  [MetricName in keyof BrowserPerformanceMetrics]-?: MetricDistribution;
};

/** Summarised request and transferred-byte totals. */
export interface NetworkTotalsSummary {
  requestCount: NetworkMetricSummary;
  transferBytes: NetworkMetricSummary;
}

/** A device/scenario group in a performance baseline. */
export interface ScenarioPerformanceSummary {
  device: PerformanceDevice;
  scenario: string;
  runCount: number;
  metrics: BrowserMetricsSummary;
  network: NetworkTotalsSummary;
}

/** Machine-readable data written to a baseline summary.json file. */
export interface PerformanceSummary {
  schemaVersion: 1;
  target: string;
  capturedAt: string;
  runCount: number;
  scenarios: readonly ScenarioPerformanceSummary[];
}

const browserMetricNames = [
  "navigationDurationMs",
  "firstContentfulPaintMs",
  "largestContentfulPaintMs",
  "cumulativeLayoutShift",
  "interactionLatencyMs",
  "longTaskDurationMs",
  "longAnimationFrameDurationMs",
  "scenarioDurationMs",
] as const satisfies readonly (keyof BrowserPerformanceMetrics)[];

const deviceOrder: Readonly<Record<PerformanceDevice, number>> = {
  desktop: 0,
  mobile: 1,
};

const metricLabels: Readonly<Record<keyof BrowserPerformanceMetrics, string>> =
  {
    navigationDurationMs: "Navigation duration (ms)",
    firstContentfulPaintMs: "First contentful paint (ms)",
    largestContentfulPaintMs: "Largest contentful paint (ms)",
    cumulativeLayoutShift: "Cumulative layout shift",
    interactionLatencyMs: "Interaction latency (ms)",
    longTaskDurationMs: "Long task duration (ms)",
    longAnimationFrameDurationMs: "Long animation frame duration (ms)",
    scenarioDurationMs: "Scenario duration (ms)",
  };

/**
 * Calculates nearest-rank p50, p75, and max values without mutating the input.
 */
export function summarizeMetricValues(
  values: readonly (number | undefined)[],
): MetricDistribution {
  const presentValues = values.filter(
    (value): value is number => value !== undefined,
  );
  presentValues.forEach((value) =>
    assertNonNegativeFinite(value, "metric value"),
  );

  if (presentValues.length === 0) {
    return {
      sampleCount: 0,
      missingRunCount: values.length,
      p50: null,
      p75: null,
      max: null,
    };
  }

  const sortedValues = [...presentValues].sort(
    (first, second) => first - second,
  );

  return {
    sampleCount: sortedValues.length,
    missingRunCount: values.length - sortedValues.length,
    p50: nearestRank(sortedValues, 0.5),
    p75: nearestRank(sortedValues, 0.75),
    max: sortedValues.at(-1) ?? null,
  };
}

/**
 * Groups per-run measurements by device and scenario in a stable order.
 */
export function createPerformanceSummary(
  input: PerformanceSummaryInput,
): PerformanceSummary {
  assertSummaryInput(input);

  const groups = new Map<string, PerformanceRun[]>();

  for (const run of input.runs) {
    const key = `${run.device}\u0000${run.scenario}`;
    const group = groups.get(key);

    if (group) {
      group.push(run);
    } else {
      groups.set(key, [run]);
    }
  }

  const scenarios = [...groups.values()]
    .map((runs) => createScenarioSummary(runs))
    .sort(compareScenarioSummaries);

  return {
    schemaVersion: 1,
    target: input.target,
    capturedAt: input.capturedAt,
    runCount: input.runs.length,
    scenarios,
  };
}

/**
 * Serializes a summary with a final newline for stable summary.json artifacts.
 */
export function renderPerformanceSummaryJson(
  summary: PerformanceSummary,
): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}

/**
 * Renders the readable, deterministic companion for a summary.md baseline artifact.
 */
export function renderPerformanceSummaryMarkdown(
  summary: PerformanceSummary,
): string {
  const lines = [
    "# Production performance baseline",
    "",
    `- Target: ${summary.target}`,
    `- Captured: ${summary.capturedAt}`,
    `- Runs: ${summary.runCount}`,
  ];

  for (const scenario of summary.scenarios) {
    lines.push(
      "",
      `## ${titleCase(scenario.device)} — ${scenario.scenario}`,
      "",
      "### Browser metrics",
      "",
      "| Metric | Samples | Missing | p50 | p75 | Max |",
      "| --- | ---: | ---: | ---: | ---: | ---: |",
    );

    for (const metricName of browserMetricNames) {
      const metric = scenario.metrics[metricName];
      lines.push(
        `| ${metricLabels[metricName]} | ${metric.sampleCount} | ${metric.missingRunCount} | ${formatMetric(metric.p50)} | ${formatMetric(metric.p75)} | ${formatMetric(metric.max)} |`,
      );
    }

    lines.push(
      "",
      "### First-party network totals",
      "",
      "| Metric | Total | p50 | p75 | Max |",
      "| --- | ---: | ---: | ---: | ---: |",
      renderNetworkMetricRow("Requests", scenario.network.requestCount),
      renderNetworkMetricRow(
        "Transferred bytes",
        scenario.network.transferBytes,
      ),
    );
  }

  return `${lines.join("\n")}\n`;
}

/** Creates one device/scenario summary from validated per-run measurements. */
function createScenarioSummary(
  runs: readonly PerformanceRun[],
): ScenarioPerformanceSummary {
  const firstRun = runs[0];

  if (!firstRun) {
    throw new Error("Cannot create a scenario summary without runs.");
  }

  return {
    device: firstRun.device,
    scenario: firstRun.scenario,
    runCount: runs.length,
    metrics: createBrowserMetricsSummary(runs),
    network: {
      requestCount: summarizeNetworkMetric(runs, "requestCount"),
      transferBytes: summarizeNetworkMetric(runs, "transferBytes"),
    },
  };
}

/** Creates fixed-shape browser metric summaries so unavailable APIs remain visible. */
function createBrowserMetricsSummary(
  runs: readonly PerformanceRun[],
): BrowserMetricsSummary {
  return {
    navigationDurationMs: summarizeMetricValues(
      runs.map((run) => run.metrics.navigationDurationMs),
    ),
    firstContentfulPaintMs: summarizeMetricValues(
      runs.map((run) => run.metrics.firstContentfulPaintMs),
    ),
    largestContentfulPaintMs: summarizeMetricValues(
      runs.map((run) => run.metrics.largestContentfulPaintMs),
    ),
    cumulativeLayoutShift: summarizeMetricValues(
      runs.map((run) => run.metrics.cumulativeLayoutShift),
    ),
    interactionLatencyMs: summarizeMetricValues(
      runs.map((run) => run.metrics.interactionLatencyMs),
    ),
    longTaskDurationMs: summarizeMetricValues(
      runs.map((run) => run.metrics.longTaskDurationMs),
    ),
    longAnimationFrameDurationMs: summarizeMetricValues(
      runs.map((run) => run.metrics.longAnimationFrameDurationMs),
    ),
    scenarioDurationMs: summarizeMetricValues(
      runs.map((run) => run.metrics.scenarioDurationMs),
    ),
  };
}

/** Adds a total to an otherwise standard metric distribution. */
function summarizeNetworkMetric(
  runs: readonly PerformanceRun[],
  metric: keyof NetworkTotals,
): NetworkMetricSummary {
  const values = runs.map((run) => run.network[metric]);

  return {
    ...summarizeMetricValues(values),
    total: values.reduce((total, value) => total + value, 0),
  };
}

/** Returns the nearest-rank percentile from ascending numeric values. */
function nearestRank(
  sortedValues: readonly number[],
  percentile: number,
): number {
  const index = Math.ceil(sortedValues.length * percentile) - 1;
  return sortedValues[index] ?? 0;
}

/** Orders baseline groups without locale-dependent comparison. */
function compareScenarioSummaries(
  first: ScenarioPerformanceSummary,
  second: ScenarioPerformanceSummary,
): number {
  const deviceDifference =
    deviceOrder[first.device] - deviceOrder[second.device];

  if (deviceDifference !== 0) {
    return deviceDifference;
  }

  return compareStrings(first.scenario, second.scenario);
}

/** Compares strings by Unicode code point for cross-machine stable output. */
function compareStrings(first: string, second: string): number {
  if (first < second) {
    return -1;
  }

  if (first > second) {
    return 1;
  }

  return 0;
}

/** Validates input values before they can produce misleading baseline data. */
function assertSummaryInput(input: PerformanceSummaryInput): void {
  if (input.target.trim().length === 0) {
    throw new Error("Performance summary target must not be empty.");
  }

  if (input.capturedAt.trim().length === 0) {
    throw new Error("Performance summary capturedAt must not be empty.");
  }

  if (input.runs.length === 0) {
    throw new Error("Performance summary requires at least one run.");
  }

  for (const run of input.runs) {
    if (run.scenario.trim().length === 0) {
      throw new Error("Performance run scenario must not be empty.");
    }

    if (!Number.isInteger(run.run) || run.run < 1) {
      throw new Error("Performance run number must be a positive integer.");
    }

    if (
      !Number.isInteger(run.network.requestCount) ||
      run.network.requestCount < 0
    ) {
      throw new Error("Network request count must be a non-negative integer.");
    }

    assertNonNegativeFinite(
      run.network.transferBytes,
      "Network transfer bytes",
    );
  }
}

/** Rejects invalid values rather than making an invalid baseline look legitimate. */
function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number.`);
  }
}

/** Formats numbers without locale-dependent separators or unnecessary precision. */
function formatMetric(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return Number(value.toFixed(3)).toString();
}

/** Renders a single network table row. */
function renderNetworkMetricRow(
  label: string,
  metric: NetworkMetricSummary,
): string {
  return `| ${label} | ${formatMetric(metric.total)} | ${formatMetric(metric.p50)} | ${formatMetric(metric.p75)} | ${formatMetric(metric.max)} |`;
}

/** Converts a known device label to its heading form. */
function titleCase(value: string): string {
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}
