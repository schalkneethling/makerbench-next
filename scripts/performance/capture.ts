import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, devices } from "playwright";
import { strToU8, zipSync } from "fflate";

import { installBrowserMetrics } from "./browser-metrics.ts";
import {
  sanitizeHar,
  validateSanitizedHar,
  writeSanitizedHar,
  type SanitizedHar,
} from "./har.ts";
import { runProductionScenarios } from "./scenarios.ts";
import {
  createPerformanceSummary,
  renderPerformanceSummaryJson,
  renderPerformanceSummaryMarkdown,
  type PerformanceDevice,
  type PerformanceRun,
} from "./summary.ts";

const DEFAULT_TARGET = "https://makerbench.schalkneethling.com";
const DEFAULT_RUN_COUNT = 5;
const MAX_RUN_COUNT = 20;
const BASELINE_ARTIFACT_PREFIX = "pre-taxonomy";

interface CaptureOptions {
  target: URL;
  runCount: number;
  baselineDate?: string;
}

interface CapturePaths {
  directory: string;
  desktopHar: string;
  mobileHar: string;
  summaryJson: string;
  summaryMarkdown: string;
}

const deviceProfiles: ReadonlyArray<{
  name: PerformanceDevice;
  descriptor: (typeof devices)[keyof typeof devices];
}> = [
  {
    name: "desktop",
    descriptor: devices["Desktop Chrome"],
  },
  {
    name: "mobile",
    descriptor: devices["Pixel 5"],
  },
];

/**
 * Captures production performance evidence without mutating production data.
 */
export async function captureProductionPerformance(
  options: CaptureOptions,
): Promise<CapturePaths> {
  const capturedAt = new Date().toISOString();
  const paths = createCapturePaths(options, capturedAt);
  await assertOutputsDoNotExist(paths);

  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "makerbench-performance-"),
  );
  const sanitizedHars = new Map<PerformanceDevice, SanitizedHar[]>();
  const runs: PerformanceRun[] = [];

  let browser;
  try {
    browser = await launchChromium();

    for (const profile of deviceProfiles) {
      const deviceHars: SanitizedHar[] = [];
      sanitizedHars.set(profile.name, deviceHars);

      for (let run = 1; run <= options.runCount; run += 1) {
        process.stdout.write(
          `Capturing ${profile.name} run ${run}/${options.runCount}…\n`,
        );

        const rawHarPath = join(
          temporaryDirectory,
          `${profile.name}-${run}.har`,
        );
        const context = await browser.newContext({
          ...profile.descriptor,
          locale: "en-US",
        });

        try {
          await context.tracing.startHar(rawHarPath, {
            content: "omit",
            mode: "full",
          });

          const page = await context.newPage();
          await installBrowserMetrics(page);
          runs.push(
            ...(await runProductionScenarios(
              page,
              options.target,
              profile.name,
              run,
            )),
          );
        } finally {
          await context.tracing.stopHar();
          await context.close();
        }

        const rawHar: unknown = JSON.parse(await readFile(rawHarPath, "utf8"));
        deviceHars.push(sanitizeHar(rawHar));
      }
    }

    const desktopHar = mergeSanitizedHars(
      requireDeviceHars(sanitizedHars, "desktop"),
    );
    const mobileHar = mergeSanitizedHars(
      requireDeviceHars(sanitizedHars, "mobile"),
    );
    const summary = createPerformanceSummary({
      target: options.target.origin,
      capturedAt,
      runs,
    });

    await mkdir(paths.directory, { recursive: true });
    await writeHarArchive(paths.desktopHar, desktopHar, temporaryDirectory);
    await writeHarArchive(paths.mobileHar, mobileHar, temporaryDirectory);
    await writeFile(paths.summaryJson, renderPerformanceSummaryJson(summary), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await writeFile(
      paths.summaryMarkdown,
      renderPerformanceSummaryMarkdown(summary),
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      },
    );
  } finally {
    await browser?.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  return paths;
}

/**
 * Merges body-free context HARs into one validated per-device artifact.
 */
export function mergeSanitizedHars(
  hars: readonly SanitizedHar[],
): SanitizedHar {
  const firstHar = hars[0];
  if (!firstHar) {
    throw new Error("At least one sanitized HAR is required.");
  }

  const merged: SanitizedHar = {
    log: {
      version: firstHar.log.version,
      creator: {
        name: "makerbench-har-sanitizer",
        version: "1",
      },
      entries: hars.flatMap((har) => har.log.entries),
    },
  };

  validateSanitizedHar(merged);
  return merged;
}

/**
 * Parses bounded CLI options for baseline and subsequent artifact captures.
 */
export function parseCaptureOptions(
  arguments_: readonly string[],
): CaptureOptions {
  let target = new URL(DEFAULT_TARGET);
  let runCount = DEFAULT_RUN_COUNT;
  let baselineDate: string | undefined;

  for (const argument of arguments_) {
    if (argument === "--") {
      continue;
    }

    if (argument.startsWith("--target=")) {
      target = parseTarget(argument.slice("--target=".length));
      continue;
    }

    if (argument.startsWith("--runs=")) {
      runCount = parseRunCount(argument.slice("--runs=".length));
      continue;
    }

    if (argument.startsWith("--baseline=")) {
      baselineDate = parseBaselineDate(argument.slice("--baseline=".length));
      continue;
    }

    throw new Error(`Unknown performance capture option: ${argument}`);
  }

  return {
    target,
    runCount,
    ...(baselineDate ? { baselineDate } : {}),
  };
}

/** Launches Chromium with an actionable setup failure. */
async function launchChromium() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("Executable doesn't exist") ||
      message.includes("browser executable")
    ) {
      throw new Error(
        "Playwright Chromium is unavailable. Run `npx playwright install --with-deps chromium` and retry.",
        { cause: error },
      );
    }

    throw error;
  }
}

/** Builds immutable baseline paths or timestamped gitignored artifact paths. */
function createCapturePaths(
  options: CaptureOptions,
  capturedAt: string,
): CapturePaths {
  if (options.baselineDate) {
    const directory = join("performance", "baselines", options.baselineDate);
    return {
      directory,
      desktopHar: join(
        directory,
        `${BASELINE_ARTIFACT_PREFIX}-desktop.har.zip`,
      ),
      mobileHar: join(directory, `${BASELINE_ARTIFACT_PREFIX}-mobile.har.zip`),
      summaryJson: join(directory, "summary.json"),
      summaryMarkdown: join(directory, "summary.md"),
    };
  }

  const captureId = capturedAt.replaceAll(/[:.]/g, "-");
  const directory = join("performance", "artifacts", captureId);
  return {
    directory,
    desktopHar: join(directory, "desktop.har.zip"),
    mobileHar: join(directory, "mobile.har.zip"),
    summaryJson: join(directory, "summary.json"),
    summaryMarkdown: join(directory, "summary.md"),
  };
}

/** Fails before capture when any immutable output already exists. */
async function assertOutputsDoNotExist(paths: CapturePaths): Promise<void> {
  const outputs = [
    paths.desktopHar,
    paths.mobileHar,
    paths.summaryJson,
    paths.summaryMarkdown,
  ];

  for (const output of outputs) {
    try {
      await readFile(output);
      throw new Error(
        `Performance capture will not overwrite existing artifact: ${output}`,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }

      throw error;
    }
  }
}

/** Creates a single-file ZIP after the sanitized HAR passes strict validation. */
async function writeHarArchive(
  outputPath: string,
  har: SanitizedHar,
  temporaryDirectory: string,
): Promise<void> {
  validateSanitizedHar(har);
  const archiveEntryName = basename(outputPath, ".zip");
  const sanitizedHarPath = join(temporaryDirectory, archiveEntryName);
  await writeSanitizedHar(sanitizedHarPath, har);
  const serializedHar = await readFile(sanitizedHarPath, "utf8");
  const archive = zipSync(
    {
      [archiveEntryName]: strToU8(serializedHar),
    },
    { level: 9 },
  );

  await writeFile(outputPath, archive, {
    flag: "wx",
    mode: 0o600,
  });
}

/** Reads a completed device collection or fails closed. */
function requireDeviceHars(
  hars: ReadonlyMap<PerformanceDevice, SanitizedHar[]>,
  device: PerformanceDevice,
): SanitizedHar[] {
  const result = hars.get(device);
  if (!result || result.length === 0) {
    throw new Error(`No ${device} HARs were captured.`);
  }

  return result;
}

/** Accepts only an HTTP(S) origin without credentials, query, or fragment. */
function parseTarget(value: string): URL {
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new Error("Performance target must be a valid HTTP(S) URL.");
  }

  if (
    (target.protocol !== "http:" && target.protocol !== "https:") ||
    target.username ||
    target.password ||
    target.search ||
    target.hash
  ) {
    throw new Error(
      "Performance target must be an HTTP(S) origin without credentials, query, or fragment.",
    );
  }

  target.pathname = "/";
  return target;
}

/** Parses a safe bounded count of fresh browser contexts per device. */
function parseRunCount(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error("Performance run count must be an integer.");
  }

  const runCount = Number(value);
  if (runCount < 1 || runCount > MAX_RUN_COUNT) {
    throw new Error(
      `Performance run count must be between 1 and ${MAX_RUN_COUNT}.`,
    );
  }

  return runCount;
}

/** Restricts committed baseline directories to calendar-date names. */
function parseBaselineDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Baseline date must use YYYY-MM-DD.");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Baseline date must be a real calendar date.");
  }

  return value;
}

/** CLI entry point. */
async function main(): Promise<void> {
  const paths = await captureProductionPerformance(
    parseCaptureOptions(process.argv.slice(2)),
  );
  process.stdout.write(`Performance evidence written to ${paths.directory}\n`);
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
