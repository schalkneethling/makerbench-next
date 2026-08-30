import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import * as v from "valibot";

import type {
  BrowserPerformanceMetrics,
  NetworkTotals,
  MetricDistribution,
  PerformanceDevice,
  PerformanceSummary,
  ScenarioPerformanceSummary,
} from "./summary.ts";

const DEFAULT_BUDGET_PATH = "performance/budgets.json";
const MAX_BUDGET_BYTES = 64 * 1024;
const MAX_SUMMARY_BYTES = 4 * 1024 * 1024;
const MAX_EVIDENCE_PATH_LENGTH = 4_096;

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

const networkMetricNames = [
  "requestCount",
  "transferBytes",
] as const satisfies readonly (keyof NetworkTotals)[];

const distributionSchema = v.strictObject({
  sampleCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  missingRunCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  p50: v.nullable(v.pipe(v.number(), v.finite(), v.minValue(0))),
  p75: v.nullable(v.pipe(v.number(), v.finite(), v.minValue(0))),
  max: v.nullable(v.pipe(v.number(), v.finite(), v.minValue(0))),
});

const networkDistributionSchema = v.strictObject({
  sampleCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  missingRunCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  p50: v.nullable(v.pipe(v.number(), v.finite(), v.minValue(0))),
  p75: v.nullable(v.pipe(v.number(), v.finite(), v.minValue(0))),
  max: v.nullable(v.pipe(v.number(), v.finite(), v.minValue(0))),
  total: v.pipe(v.number(), v.finite(), v.minValue(0)),
});

const metricsSchema = v.strictObject(
  Object.fromEntries(
    browserMetricNames.map((metric) => [metric, distributionSchema]),
  ) as Record<(typeof browserMetricNames)[number], typeof distributionSchema>,
);

const networkSchema = v.strictObject(
  Object.fromEntries(
    networkMetricNames.map((metric) => [metric, networkDistributionSchema]),
  ) as Record<
    (typeof networkMetricNames)[number],
    typeof networkDistributionSchema
  >,
);

const performanceSummarySchema = v.strictObject({
  schemaVersion: v.literal(1),
  target: v.pipe(v.string(), v.maxLength(2_048)),
  capturedAt: v.pipe(v.string(), v.maxLength(64)),
  runCount: v.pipe(v.number(), v.integer(), v.minValue(1)),
  scenarios: v.pipe(
    v.array(
      v.strictObject({
        device: v.picklist(["desktop", "mobile"]),
        scenario: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
        runCount: v.pipe(v.number(), v.integer(), v.minValue(1)),
        metrics: metricsSchema,
        network: networkSchema,
      }),
    ),
    v.maxLength(100),
  ),
});

const requiredScenarioSchema = v.strictObject({
  device: v.picklist(["desktop", "mobile"]),
  scenario: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
});

const budgetStatisticSchema = v.picklist(["p75", "max"]);
const budgetEntrySchema = v.variant("source", [
  v.strictObject({
    source: v.literal("browser"),
    device: v.picklist(["desktop", "mobile"]),
    scenario: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    metric: v.picklist(browserMetricNames),
    statistic: budgetStatisticSchema,
    maximum: v.pipe(v.number(), v.finite(), v.minValue(0)),
  }),
  v.strictObject({
    source: v.literal("network"),
    device: v.picklist(["desktop", "mobile"]),
    scenario: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    metric: v.picklist(networkMetricNames),
    statistic: budgetStatisticSchema,
    maximum: v.pipe(v.number(), v.finite(), v.minValue(0)),
  }),
]);

const performanceBudgetSchema = v.strictObject({
  schemaVersion: v.literal(1),
  requiredRunsPerScenario: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.maxValue(20),
  ),
  requiredScenarios: v.pipe(v.array(requiredScenarioSchema), v.minLength(1)),
  budgets: v.pipe(v.array(budgetEntrySchema), v.minLength(1)),
});

export type PerformanceBudgetConfig = v.InferOutput<
  typeof performanceBudgetSchema
>;
type PerformanceBudgetEntry = PerformanceBudgetConfig["budgets"][number];

export interface PerformanceBudgetViolation {
  device: PerformanceDevice;
  scenario: string;
  reason:
    | "missing-scenario"
    | "unexpected-run-count"
    | "missing-metric"
    | "budget-exceeded";
  metric?: string;
  statistic?: "p75" | "max";
  actual?: number | null;
  maximum?: number;
}

export interface PerformanceBudgetReport {
  schemaVersion: 1;
  status: "passed" | "failed";
  requiredRunsPerScenario: number;
  checkedBudgetCount: number;
  violations: readonly PerformanceBudgetViolation[];
}

interface PerformanceBudgetPaths {
  summaryPath: string;
  budgetPath: string;
  evidencePath: string;
}

/** Evaluates required scenario completeness and every absolute performance budget. */
export function evaluatePerformanceBudget(
  summary: PerformanceSummary,
  config: PerformanceBudgetConfig,
): PerformanceBudgetReport {
  assertUniqueConfiguration(config);
  const scenarios = indexScenarios(summary.scenarios);
  const violations: PerformanceBudgetViolation[] = [];

  for (const required of config.requiredScenarios) {
    const scenario = scenarios.get(scenarioKey(required));
    if (!scenario) {
      violations.push({ ...required, reason: "missing-scenario" });
      continue;
    }

    if (scenario.runCount !== config.requiredRunsPerScenario) {
      violations.push({
        ...required,
        reason: "unexpected-run-count",
        actual: scenario.runCount,
        maximum: config.requiredRunsPerScenario,
      });
    }
  }

  for (const budget of config.budgets) {
    const scenario = scenarios.get(scenarioKey(budget));
    if (!scenario) {
      continue;
    }

    const distribution = readBudgetDistribution(scenario, budget);
    const actual = distribution[budget.statistic];
    if (
      actual === null ||
      distribution.missingRunCount !== 0 ||
      distribution.sampleCount !== scenario.runCount
    ) {
      violations.push({
        device: budget.device,
        scenario: budget.scenario,
        reason: "missing-metric",
        metric: budget.metric,
        statistic: budget.statistic,
        actual,
        maximum: budget.maximum,
      });
      continue;
    }

    if (actual > budget.maximum) {
      violations.push({
        device: budget.device,
        scenario: budget.scenario,
        reason: "budget-exceeded",
        metric: budget.metric,
        statistic: budget.statistic,
        actual,
        maximum: budget.maximum,
      });
    }
  }

  return {
    schemaVersion: 1,
    status: violations.length === 0 ? "passed" : "failed",
    requiredRunsPerScenario: config.requiredRunsPerScenario,
    checkedBudgetCount: config.budgets.length,
    violations,
  };
}

/** Reads bounded inputs, evaluates budgets, and always writes pass/fail evidence. */
export async function checkPerformanceBudgetFiles(
  paths: PerformanceBudgetPaths,
): Promise<PerformanceBudgetReport> {
  const summary = v.parse(
    performanceSummarySchema,
    await readBoundedJson(paths.summaryPath, MAX_SUMMARY_BYTES, "summary"),
  );
  const config = v.parse(
    performanceBudgetSchema,
    await readBoundedJson(paths.budgetPath, MAX_BUDGET_BYTES, "budget"),
  );
  const report = evaluatePerformanceBudget(summary, config);

  await mkdir(dirname(paths.evidencePath), { recursive: true });
  await writeFile(paths.evidencePath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });

  return report;
}

/** Reads JSON only after enforcing a pre-allocation and post-read byte bound. */
async function readBoundedJson(
  path: string,
  maximumBytes: number,
  label: string,
): Promise<unknown> {
  const before = await lstat(path);
  if (!before.isFile() || before.size > maximumBytes) {
    throw new Error(
      `Performance ${label} must be a file no larger than ${maximumBytes} bytes.`,
    );
  }

  const serialized = await readFile(path, "utf8");
  assertSerializedWithinByteLimit(serialized, maximumBytes, label);

  return JSON.parse(serialized) as unknown;
}

/** Retains the post-read bound needed for file-growth races and encoding changes. */
export function assertSerializedWithinByteLimit(
  serialized: string,
  maximumBytes: number,
  label: string,
): void {
  if (Buffer.byteLength(serialized, "utf8") > maximumBytes) {
    throw new Error(
      `Performance ${label} exceeded ${maximumBytes} bytes while being read.`,
    );
  }
}

/** Creates a stable lookup and rejects duplicate scenario evidence. */
function indexScenarios(
  scenarios: readonly ScenarioPerformanceSummary[],
): Map<string, ScenarioPerformanceSummary> {
  const indexed = new Map<string, ScenarioPerformanceSummary>();

  for (const scenario of scenarios) {
    const key = scenarioKey(scenario);
    if (indexed.has(key)) {
      throw new Error(
        `Performance summary contains duplicate ${scenario.device}/${scenario.scenario} evidence.`,
      );
    }
    indexed.set(key, scenario);
  }

  return indexed;
}

/** Rejects duplicate requirements or budget identities in versioned configuration. */
function assertUniqueConfiguration(config: PerformanceBudgetConfig): void {
  const required = new Set<string>();
  for (const scenario of config.requiredScenarios) {
    const key = scenarioKey(scenario);
    if (required.has(key)) {
      throw new Error(`Performance budget repeats required scenario ${key}.`);
    }
    required.add(key);
  }

  const budgets = new Set<string>();
  for (const budget of config.budgets) {
    const scenario = scenarioKey(budget);
    if (!required.has(scenario)) {
      throw new Error(
        `Performance budget references non-required scenario ${scenario}.`,
      );
    }
    const key = [scenario, budget.source, budget.metric, budget.statistic].join(
      "/",
    );
    if (budgets.has(key)) {
      throw new Error(`Performance budget repeats ${key}.`);
    }
    budgets.add(key);
  }
}

/** Reads the configured statistic from a browser or network distribution. */
function readBudgetDistribution(
  scenario: ScenarioPerformanceSummary,
  budget: PerformanceBudgetEntry,
): MetricDistribution {
  if (budget.source === "browser") {
    return scenario.metrics[budget.metric];
  }

  return scenario.network[budget.metric];
}

/** Produces one collision-safe scenario identity. */
function scenarioKey(value: {
  device: PerformanceDevice;
  scenario: string;
}): string {
  return `${value.device}\u0000${value.scenario}`;
}

/** Parses the three explicit CLI paths without accepting positional input. */
function parseBudgetPaths(
  arguments_: readonly string[],
): PerformanceBudgetPaths {
  let summaryPath: string | undefined;
  let budgetPath = DEFAULT_BUDGET_PATH;
  let evidencePath: string | undefined;

  for (const argument of arguments_) {
    if (argument === "--") {
      continue;
    }
    if (argument.startsWith("--summary=")) {
      summaryPath = parsePath(argument.slice("--summary=".length), "summary");
      continue;
    }
    if (argument.startsWith("--budgets=")) {
      budgetPath = parsePath(argument.slice("--budgets=".length), "budget");
      continue;
    }
    if (argument.startsWith("--evidence=")) {
      evidencePath = parsePath(
        argument.slice("--evidence=".length),
        "evidence",
      );
      continue;
    }
    throw new Error(`Unknown performance budget option: ${argument}`);
  }

  if (!summaryPath || !evidencePath) {
    throw new Error("Performance budget requires --summary and --evidence.");
  }

  return { summaryPath, budgetPath, evidencePath };
}

/** Rejects empty or unreasonably large path arguments. */
function parsePath(value: string, label: string): string {
  if (value.length === 0 || value.length > MAX_EVIDENCE_PATH_LENGTH) {
    throw new Error(
      `Performance ${label} path must be between 1 and ${MAX_EVIDENCE_PATH_LENGTH} characters.`,
    );
  }
  return value;
}

/** CLI entry point. */
async function main(): Promise<void> {
  const paths = parseBudgetPaths(process.argv.slice(2));
  const report = await checkPerformanceBudgetFiles(paths);

  if (report.status === "failed") {
    process.stderr.write(
      `Production performance budgets failed with ${report.violations.length} violation(s).\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Production performance budgets passed (${report.checkedBudgetCount} checks).\n`,
  );
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch(() => {
    process.stderr.write(
      "Production performance budget evidence was invalid or could not be checked.\n",
    );
    process.exitCode = 1;
  });
}
