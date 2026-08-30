import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const METRICS = ["branches", "functions", "lines", "statements"] as const;

type CoverageMetric = (typeof METRICS)[number];

const MAX_COVERAGE_THRESHOLDS_BYTES = 4_096;

export type CoverageThresholds = Record<CoverageMetric, number>;

/** Validates a coverage floor file before it controls the CI gate. */
export function parseCoverageThresholds(contents: string): CoverageThresholds {
  const parsed: unknown = JSON.parse(contents);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Coverage thresholds must be a JSON object.");
  }

  const thresholds = parsed as Partial<Record<CoverageMetric, unknown>>;
  const keys = Object.keys(thresholds);

  if (
    keys.length !== METRICS.length ||
    keys.some((key) => !METRICS.includes(key as CoverageMetric))
  ) {
    throw new Error(
      `Coverage thresholds must contain only: ${METRICS.join(", ")}.`,
    );
  }

  const result = {} as CoverageThresholds;

  for (const metric of METRICS) {
    const value = thresholds[metric];

    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    ) {
      throw new Error(
        `Coverage threshold ${metric} must be a number from 0 to 100.`,
      );
    }

    result[metric] = value;
  }

  return result;
}

/** Reads a small coverage configuration without allocating for an oversized file. */
export function readCoverageThresholdFile(
  path: string | URL,
): CoverageThresholds {
  const metadata = lstatSync(path);

  if (!metadata.isFile()) {
    throw new Error("Coverage thresholds must be a regular file.");
  }

  if (metadata.size > MAX_COVERAGE_THRESHOLDS_BYTES) {
    throw new Error("Coverage thresholds file exceeds 4096 bytes.");
  }

  const contents = readFileSync(path, "utf8");

  if (Buffer.byteLength(contents, "utf8") > MAX_COVERAGE_THRESHOLDS_BYTES) {
    throw new Error("Coverage thresholds file exceeds 4096 bytes.");
  }

  return parseCoverageThresholds(contents);
}

/** Returns the metrics that would weaken an established coverage floor. */
export function findLoweredThresholds(
  baseline: CoverageThresholds,
  candidate: CoverageThresholds,
): CoverageMetric[] {
  return METRICS.filter((metric) => candidate[metric] < baseline[metric]);
}

/** Reads one bounded coverage floor file from a Git revision. */
function readThresholdsAtRevision(
  repositoryRoot: string,
  revision: string,
): CoverageThresholds | undefined {
  const matchingPath = execFileSync(
    "git",
    ["ls-tree", "--name-only", revision, "--", "coverage-thresholds.json"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: MAX_COVERAGE_THRESHOLDS_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (matchingPath.trim() === "") {
    return undefined;
  }

  const contents = execFileSync(
    "git",
    ["show", `${revision}:coverage-thresholds.json`],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: MAX_COVERAGE_THRESHOLDS_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  return parseCoverageThresholds(contents);
}

/** Combines every prior floor so no stacked commit can weaken one metric. */
function strongestThresholds(
  thresholds: CoverageThresholds[],
): CoverageThresholds | undefined {
  if (thresholds.length === 0) {
    return undefined;
  }

  return METRICS.reduce((strongest, metric) => {
    strongest[metric] = Math.max(
      ...thresholds.map((threshold) => threshold[metric]),
    );
    return strongest;
  }, {} as CoverageThresholds);
}

/** Reads an explicit base or the strongest floor reachable from the current stack. */
export function readBaseThresholds(
  repositoryRoot: string,
  baseRef = process.env.COVERAGE_BASE_REF,
): CoverageThresholds | undefined {
  if (baseRef === undefined) {
    const revisions = execFileSync(
      "git",
      ["log", "--format=%H", "HEAD", "--", "coverage-thresholds.json"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        maxBuffer: 64 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
      .trim()
      .split("\n")
      .filter(Boolean);

    return strongestThresholds(
      revisions.flatMap((revision) => {
        const thresholds = readThresholdsAtRevision(repositoryRoot, revision);
        return thresholds === undefined ? [] : [thresholds];
      }),
    );
  }

  const baseCommit = execFileSync(
    "git",
    ["rev-parse", "--verify", `${baseRef}^{commit}`],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: MAX_COVERAGE_THRESHOLDS_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
  const headCommit = execFileSync(
    "git",
    ["rev-parse", "--verify", "HEAD^{commit}"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: MAX_COVERAGE_THRESHOLDS_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();

  if (baseCommit !== headCommit) {
    try {
      execFileSync(
        "git",
        ["merge-base", "--is-ancestor", baseCommit, headCommit],
        {
          cwd: repositoryRoot,
          stdio: "ignore",
        },
      );
    } catch {
      throw new Error(
        `Coverage base ref ${baseRef} is stale because it is not an ancestor of HEAD.`,
      );
    }
  }
  return readThresholdsAtRevision(repositoryRoot, baseRef);
}

/** Prevents a pull request from lowering an existing coverage floor. */
function main(): void {
  const repositoryRoot = process.cwd();
  const candidate = readCoverageThresholdFile(
    resolve(repositoryRoot, "coverage-thresholds.json"),
  );
  const baseline = readBaseThresholds(repositoryRoot);

  if (baseline === undefined) {
    console.log(
      "Coverage floors established; a future branch may only increase them.",
    );
    return;
  }

  const lowered = findLoweredThresholds(baseline, candidate);

  if (lowered.length > 0) {
    throw new Error(`Coverage floors may not decrease: ${lowered.join(", ")}.`);
  }

  console.log(
    "Coverage floors are unchanged or higher than the selected baseline.",
  );
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
