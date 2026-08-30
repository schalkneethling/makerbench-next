import {
  access,
  copyFile,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { COPYFILE_EXCL } from "node:constants";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, devices, type Browser } from "playwright";
import { strToU8, zipSync } from "fflate";

import { installBrowserMetrics } from "./browser-metrics.ts";
import { sanitizeHar, validateSanitizedHar, type SanitizedHar } from "./har.ts";
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
const MAX_RAW_HAR_BYTES = 128 * 1024 * 1024;
const BASELINE_ARTIFACT_PREFIX = "pre-taxonomy";

interface CaptureOptions {
  target: URL;
  runCount: number;
  baselineDate?: string;
  artifactId?: string;
}

interface CapturePaths {
  directory: string;
  checkpointDirectory: string;
  captureJson: string;
  failureJson: string;
  successJson: string;
  desktopHar: string;
  mobileHar: string;
  summaryJson: string;
  summaryMarkdown: string;
}

type CaptureStage =
  | "browser-launch"
  | "context-create"
  | "scenario"
  | "har-checkpoint"
  | "finalization";

interface CaptureLocation {
  stage: CaptureStage;
  device?: PerformanceDevice;
  run?: number;
}

interface FailureEvidenceInput extends CaptureLocation {
  target: URL;
  capturedAt: string;
  runCount: number;
  completedRunCount: number;
  error: unknown;
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
  await assertCaptureDirectoryDoesNotExist(paths.directory);
  await mkdir(paths.checkpointDirectory, { recursive: true });
  await writeJsonExclusive(paths.captureJson, {
    schemaVersion: 1,
    status: "running",
    target: options.target.origin,
    capturedAt,
    runCountPerDevice: options.runCount,
    devices: deviceProfiles.map(({ name }) => name),
  });

  const sanitizedHars = new Map<PerformanceDevice, SanitizedHar[]>();
  const runs: PerformanceRun[] = [];
  let completedRunCount = 0;
  let location: CaptureLocation = { stage: "browser-launch" };

  let browser: Browser | undefined;
  let temporaryDirectory: string | undefined;
  try {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), "makerbench-performance-"),
    );
    browser = await launchChromium();

    for (const profile of deviceProfiles) {
      const deviceHars: SanitizedHar[] = [];
      sanitizedHars.set(profile.name, deviceHars);

      for (let run = 1; run <= options.runCount; run += 1) {
        location = {
          stage: "context-create",
          device: profile.name,
          run,
        };
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
        let scenarioRuns: PerformanceRun[] | undefined;
        let scenarioError: unknown;

        try {
          await context.tracing.startHar(rawHarPath, {
            content: "omit",
            mode: "full",
          });

          location = { stage: "scenario", device: profile.name, run };
          const page = await context.newPage();
          await installBrowserMetrics(page);
          scenarioRuns = await runProductionScenarios(
            page,
            options.target,
            profile.name,
            run,
          );
        } catch (error) {
          scenarioError = error;
        } finally {
          try {
            await context.tracing.stopHar();
          } finally {
            await context.close();
          }
        }

        location = {
          stage: "har-checkpoint",
          device: profile.name,
          run,
        };
        const rawHar = await readBoundedRawHar(rawHarPath);
        const sanitizedHar = sanitizeHar(rawHar);
        await writeSanitizedHarArchive(
          join(paths.checkpointDirectory, `${profile.name}-${run}.har.zip`),
          sanitizedHar,
        );
        deviceHars.push(sanitizedHar);

        if (scenarioError !== undefined) {
          location = { stage: "scenario", device: profile.name, run };
          throw scenarioError;
        }

        if (!scenarioRuns) {
          throw new Error("Production scenario capture produced no results.");
        }

        runs.push(...scenarioRuns);
        completedRunCount += 1;
      }
    }

    location = { stage: "finalization" };
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

    await writeCaptureOutputs(
      paths,
      desktopHar,
      mobileHar,
      summary,
      temporaryDirectory,
    );
    await browser.close();
    browser = undefined;
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
    await writeJsonExclusive(paths.successJson, {
      schemaVersion: 1,
      status: "passed",
      target: options.target.origin,
      capturedAt,
      completedRunCount,
      expectedRunCount: options.runCount * deviceProfiles.length,
    });
  } catch (error) {
    await writeCaptureFailureEvidence(paths.failureJson, {
      ...location,
      target: options.target,
      capturedAt,
      runCount: options.runCount,
      completedRunCount,
      error,
    });

    const failure = describeCaptureFailure(location.stage);
    throw new Error(failure.message, { cause: error });
  } finally {
    try {
      await browser?.close();
    } catch {
      process.stderr.write("Performance browser cleanup did not complete.\n");
    }

    if (temporaryDirectory) {
      try {
        await rm(temporaryDirectory, { recursive: true, force: true });
      } catch {
        process.stderr.write(
          "Temporary performance evidence cleanup did not complete.\n",
        );
      }
    }
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
  let artifactId: string | undefined;

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

    if (argument.startsWith("--artifact=")) {
      artifactId = parseArtifactId(argument.slice("--artifact=".length));
      continue;
    }

    throw new Error(`Unknown performance capture option: ${argument}`);
  }

  if (baselineDate && artifactId) {
    throw new Error(
      "Performance capture cannot combine --baseline and --artifact.",
    );
  }

  return {
    target,
    runCount,
    ...(baselineDate ? { baselineDate } : {}),
    ...(artifactId ? { artifactId } : {}),
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
      checkpointDirectory: join(directory, "checkpoints"),
      captureJson: join(directory, "capture.json"),
      failureJson: join(directory, "failure.json"),
      successJson: join(directory, "success.json"),
      desktopHar: join(
        directory,
        `${BASELINE_ARTIFACT_PREFIX}-desktop.har.zip`,
      ),
      mobileHar: join(directory, `${BASELINE_ARTIFACT_PREFIX}-mobile.har.zip`),
      summaryJson: join(directory, "summary.json"),
      summaryMarkdown: join(directory, "summary.md"),
    };
  }

  const captureId = options.artifactId ?? capturedAt.replaceAll(/[:.]/g, "-");
  const directory = join("performance", "artifacts", captureId);
  return {
    directory,
    checkpointDirectory: join(directory, "checkpoints"),
    captureJson: join(directory, "capture.json"),
    failureJson: join(directory, "failure.json"),
    successJson: join(directory, "success.json"),
    desktopHar: join(directory, "desktop.har.zip"),
    mobileHar: join(directory, "mobile.har.zip"),
    summaryJson: join(directory, "summary.json"),
    summaryMarkdown: join(directory, "summary.md"),
  };
}

/** Fails before capture when the immutable output directory already exists. */
async function assertCaptureDirectoryDoesNotExist(
  directory: string,
): Promise<void> {
  if (await pathExists(directory)) {
    throw new Error(
      `Performance capture will not overwrite existing artifact directory: ${directory}`,
    );
  }
}

/** Stages every output before exclusively committing the complete capture. */
async function writeCaptureOutputs(
  paths: CapturePaths,
  desktopHar: SanitizedHar,
  mobileHar: SanitizedHar,
  summary: ReturnType<typeof createPerformanceSummary>,
  temporaryDirectory: string,
): Promise<void> {
  const stagedDirectory = join(temporaryDirectory, "outputs");
  const stagedPaths = {
    directory: stagedDirectory,
    desktopHar: join(stagedDirectory, basename(paths.desktopHar)),
    mobileHar: join(stagedDirectory, basename(paths.mobileHar)),
    summaryJson: join(stagedDirectory, basename(paths.summaryJson)),
    summaryMarkdown: join(stagedDirectory, basename(paths.summaryMarkdown)),
  };

  await mkdir(stagedDirectory, { recursive: true });
  await writeSanitizedHarArchive(stagedPaths.desktopHar, desktopHar);
  await writeSanitizedHarArchive(stagedPaths.mobileHar, mobileHar);
  await writeFile(
    stagedPaths.summaryJson,
    renderPerformanceSummaryJson(summary),
    {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    },
  );
  await writeFile(
    stagedPaths.summaryMarkdown,
    renderPerformanceSummaryMarkdown(summary),
    {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    },
  );

  const directoryExisted = await pathExists(paths.directory);
  const commits = [
    [stagedPaths.desktopHar, paths.desktopHar],
    [stagedPaths.mobileHar, paths.mobileHar],
    [stagedPaths.summaryJson, paths.summaryJson],
    [stagedPaths.summaryMarkdown, paths.summaryMarkdown],
  ] as const;
  const committedOutputs: string[] = [];

  await mkdir(paths.directory, { recursive: true });

  try {
    for (const [stagedPath, outputPath] of commits) {
      await copyFile(stagedPath, outputPath, COPYFILE_EXCL);
      committedOutputs.push(outputPath);
    }
  } catch (error) {
    await Promise.all(
      committedOutputs.map((outputPath) => rm(outputPath, { force: true })),
    );

    if (!directoryExisted) {
      await rm(paths.directory, { recursive: true, force: true });
    }

    throw error;
  }
}

/** Checks path existence without loading file contents. */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

/** Creates a validated, body-free single-file HAR ZIP without overwriting. */
export async function writeSanitizedHarArchive(
  outputPath: string,
  input: unknown,
): Promise<SanitizedHar> {
  const har = sanitizeHar(input);
  validateSanitizedHar(har);
  const archiveEntryName = basename(outputPath, ".zip");
  const serializedHar = `${JSON.stringify(har, null, 2)}\n`;
  const archive = zipSync(
    {
      [archiveEntryName]: strToU8(serializedHar),
    },
    { level: 9 },
  );

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, archive, {
    flag: "wx",
    mode: 0o600,
  });

  return har;
}

/** Reads a raw HAR only after enforcing its allocation bound. */
async function readBoundedRawHar(path: string): Promise<unknown> {
  const before = await lstat(path);
  if (!before.isFile() || before.size > MAX_RAW_HAR_BYTES) {
    throw new Error(
      `Raw HAR must be a file no larger than ${MAX_RAW_HAR_BYTES} bytes.`,
    );
  }

  const serialized = await readFile(path, "utf8");
  if (Buffer.byteLength(serialized, "utf8") > MAX_RAW_HAR_BYTES) {
    throw new Error(
      `Raw HAR exceeded ${MAX_RAW_HAR_BYTES} bytes while being read.`,
    );
  }

  return JSON.parse(serialized) as unknown;
}

/** Writes a redacted, fixed-vocabulary artifact for every failed capture. */
export async function writeCaptureFailureEvidence(
  outputPath: string,
  input: FailureEvidenceInput,
): Promise<void> {
  const failure = describeCaptureFailure(input.stage);

  await writeJsonExclusive(outputPath, {
    schemaVersion: 1,
    status: "failed",
    target: input.target.origin,
    capturedAt: input.capturedAt,
    runCountPerDevice: input.runCount,
    completedRunCount: input.completedRunCount,
    expectedRunCount: input.runCount * deviceProfiles.length,
    failure: {
      category: failure.category,
      message: failure.message,
      stage: input.stage,
      ...(input.device ? { device: input.device } : {}),
      ...(input.run ? { run: input.run } : {}),
    },
  });

  // The original error is deliberately not serialized because browser errors
  // can contain redirected URLs, response bodies, or other production data.
  void input.error;
}

/** Maps internal capture stages to secret-free operator evidence. */
function describeCaptureFailure(stage: CaptureStage): {
  category: string;
  message: string;
} {
  switch (stage) {
    case "browser-launch":
      return {
        category: "browser-unavailable",
        message: "The performance browser could not be started.",
      };
    case "context-create":
      return {
        category: "browser-context-failed",
        message: "A fresh performance browser context could not be created.",
      };
    case "scenario":
      return {
        category: "production-scenario-failed",
        message:
          "The production scenario did not complete after bounded retries.",
      };
    case "har-checkpoint":
      return {
        category: "evidence-sanitization-failed",
        message: "Captured network evidence could not be safely sanitized.",
      };
    case "finalization":
      return {
        category: "evidence-finalization-failed",
        message: "The complete performance evidence could not be finalized.",
      };
  }
}

/** Exclusively writes stable JSON evidence with private file permissions. */
async function writeJsonExclusive(
  outputPath: string,
  value: unknown,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
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

/** Restricts deterministic artifact directories to one safe path segment. */
function parseArtifactId(value: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)) {
    throw new Error(
      "Performance artifact id must be 1-64 ASCII letters, numbers, underscores, or hyphens.",
    );
  }

  return value;
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
