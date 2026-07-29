import type { Page, Response } from "@playwright/test";

import {
  calculateCumulativeLayoutShift,
  collectBrowserMetrics,
  markBrowserTiming,
  measureBrowserTiming,
  type BrowserMetricsSnapshot,
  type SerializablePerformanceEntry,
} from "./browser-metrics.ts";
import type {
  BrowserPerformanceMetrics,
  PerformanceDevice,
  PerformanceRun,
} from "./summary.ts";

const NAVIGATION_RETRY_COUNT = 3;
const NAVIGATION_RETRY_DELAY_MS = 1_000;
const RESPONSE_TIMEOUT_MS = 20_000;

interface ScenarioMeasurement {
  before?: BrowserMetricsSnapshot;
  after: BrowserMetricsSnapshot;
  measureName: string;
  navigation: boolean;
}

/**
 * Runs the complete non-mutating production scenario sequence in one fresh context.
 */
export async function runProductionScenarios(
  page: Page,
  target: URL,
  device: PerformanceDevice,
  run: number,
): Promise<PerformanceRun[]> {
  const results: PerformanceRun[] = [];

  results.push(
    await runNavigationScenario(
      page,
      device,
      run,
      "cold-tools-load",
      async () => {
        await navigateWithRetries(page, new URL("/", target).toString());
        await waitForCollection(page, ".ToolGrid", ".ToolCardSkeleton");
      },
    ),
  );

  results.push(
    await runNavigationScenario(
      page,
      device,
      run,
      "warm-tools-reload",
      async () => {
        await reloadWithRetries(page);
        await waitForCollection(page, ".ToolGrid", ".ToolCardSkeleton");
      },
    ),
  );

  results.push(
    await runInteractionScenario(
      page,
      device,
      run,
      "tool-text-search",
      async () => {
        const response = waitForResponsePath(page, "/api/tools/search");
        await page
          .getByRole("searchbox", { name: "Search by title or tag" })
          .fill("css");
        await recordResponseEvidence(await response, "tool-text-search");
        await waitForCollection(page, ".ToolGrid", ".ToolCardSkeleton");
      },
    ),
  );

  const tagScenario = await runOptionalToolTagScenario(page, device, run);
  if (tagScenario) {
    results.push(tagScenario);
  }

  results.push(
    await runInteractionScenario(
      page,
      device,
      run,
      "navigate-to-resources",
      async () => {
        const response = waitForResponsePath(page, "/api/resources");
        await page
          .getByRole("link", { name: "Resources", exact: true })
          .click();
        await recordResponseEvidence(await response, "navigate-to-resources");
        await page
          .getByRole("heading", { level: 1, name: "Resources" })
          .waitFor();
        await waitForCollection(page, ".ResourceGrid", ".ToolCardSkeleton");
      },
    ),
  );

  results.push(
    await runInteractionScenario(
      page,
      device,
      run,
      "resource-text-search",
      async () => {
        const response = waitForResponsePath(page, "/api/resources/search");
        await page
          .getByRole("searchbox", { name: "Search resources" })
          .fill("design");
        await recordResponseEvidence(await response, "resource-text-search");
        await waitForCollection(page, ".ResourceGrid", ".ToolCardSkeleton");
      },
    ),
  );

  results.push(
    await runInteractionScenario(
      page,
      device,
      run,
      "resource-sort-change",
      async () => {
        await page
          .getByRole("combobox", { name: "Sort" })
          .selectOption("oldest");
        await page.waitForURL(
          (url) => url.searchParams.get("sort") === "oldest",
        );
        await waitForRenderingOpportunity(page);
      },
    ),
  );

  results.push(
    await runInteractionScenario(
      page,
      device,
      run,
      "navigate-to-submit",
      async () => {
        await page
          .getByRole("link", { name: "Submit Resource", exact: true })
          .click();
        await page
          .getByRole("heading", { level: 1, name: "Submit a Resource" })
          .waitFor();
        await page.getByRole("radio", { name: "Tool" }).waitFor();
      },
    ),
  );

  results.push(
    await runInteractionScenario(
      page,
      device,
      run,
      "submission-type-switch",
      async () => {
        const tool = page.getByRole("radio", { name: "Tool" });
        const resource = page.getByRole("radio", { name: "Resource" });

        await tool.check();
        await resource.check();
        await waitForRenderingOpportunity(page);
      },
    ),
  );

  return results;
}

/** Measures an action that creates a new document and performance timeline. */
async function runNavigationScenario(
  page: Page,
  device: PerformanceDevice,
  run: number,
  scenario: string,
  action: () => Promise<void>,
): Promise<PerformanceRun> {
  await action();

  const measureName = scenarioMeasureName(scenario);
  await page.evaluate(
    ({ endName, measure, startName }) => {
      performance.clearMarks(startName);
      performance.clearMarks(endName);
      performance.clearMeasures(measure);
      performance.mark(startName, { startTime: 0 });
      performance.mark(endName);
      performance.measure(measure, startName, endName);
    },
    {
      startName: `${measureName}:start`,
      endName: `${measureName}:end`,
      measure: measureName,
    },
  );

  await waitForRenderingOpportunity(page);
  const after = await collectBrowserMetrics(page);

  return createPerformanceRun({
    device,
    run,
    scenario,
    measurement: {
      after,
      measureName,
      navigation: true,
    },
  });
}

/** Measures a same-document interaction against a before/after timeline snapshot. */
async function runInteractionScenario(
  page: Page,
  device: PerformanceDevice,
  run: number,
  scenario: string,
  action: () => Promise<void>,
): Promise<PerformanceRun> {
  const before = await collectBrowserMetrics(page);
  const measureName = scenarioMeasureName(scenario);
  const startName = `${measureName}:start`;
  const endName = `${measureName}:end`;

  await markBrowserTiming(page, startName);
  await action();
  await waitForRenderingOpportunity(page);
  await markBrowserTiming(page, endName);
  await measureBrowserTiming(page, {
    name: measureName,
    start: startName,
    end: endName,
  });

  const after = await collectBrowserMetrics(page);

  return createPerformanceRun({
    device,
    run,
    scenario,
    measurement: {
      before,
      after,
      measureName,
      navigation: false,
    },
  });
}

/** Runs tag selection only when the production catalog exposes at least one tag. */
async function runOptionalToolTagScenario(
  page: Page,
  device: PerformanceDevice,
  run: number,
): Promise<PerformanceRun | null> {
  const search = page.getByRole("searchbox", {
    name: "Search by title or tag",
  });
  if ((await search.inputValue()) !== "") {
    await search.fill("");
    await waitForCollection(page, ".ToolGrid", ".ToolCardSkeleton");
  }

  const tagButtons = page
    .getByRole("region", { name: "Filter by tag" })
    .getByRole("button");

  if ((await tagButtons.count()) === 0) {
    return null;
  }

  return runInteractionScenario(
    page,
    device,
    run,
    "tool-tag-selection",
    async () => {
      const response = waitForResponsePath(page, "/api/tools/search");
      await tagButtons.first().click();
      await recordResponseEvidence(await response, "tool-tag-selection");
      await waitForCollection(page, ".ToolGrid", ".ToolCardSkeleton");
    },
  );
}

/** Converts one before/after snapshot pair into the summary module contract. */
export function createPerformanceRun({
  device,
  run,
  scenario,
  measurement,
}: {
  device: PerformanceDevice;
  run: number;
  scenario: string;
  measurement: ScenarioMeasurement;
}): PerformanceRun {
  const { after, before, measureName, navigation } = measurement;
  const timelineStart =
    before && before.timeOrigin === after.timeOrigin
      ? before.capturedAt
      : Number.NEGATIVE_INFINITY;
  const resources = entriesSince(after.resources, timelineStart);
  const navigationEntries = navigation ? after.navigation : [];
  const events = entriesSince(after.events, timelineStart);
  const longTasks = entriesSince(after.longTasks, timelineStart);
  const longAnimationFrames = entriesSince(
    after.longAnimationFrames,
    timelineStart,
  );
  const layoutShifts = entriesSince(after.layoutShifts, timelineStart);
  const scenarioMeasure = after.measures.find(
    (entry) => entry.name === measureName,
  );
  const metrics: BrowserPerformanceMetrics = {
    ...optionalMetric(
      "navigationDurationMs",
      navigationEntries.at(-1)?.duration,
    ),
    ...optionalMetric(
      "firstContentfulPaintMs",
      navigation
        ? after.paints.find((entry) => entry.name === "first-contentful-paint")
            ?.startTime
        : undefined,
    ),
    ...optionalMetric(
      "largestContentfulPaintMs",
      navigation && after.lcp
        ? after.lcp.renderTime || after.lcp.loadTime || after.lcp.startTime
        : undefined,
    ),
    ...optionalMetric(
      "cumulativeLayoutShift",
      supportsEntryType(after, "layout-shift")
        ? navigation
          ? after.cls
          : before && before.timeOrigin === after.timeOrigin
            ? calculateCumulativeLayoutShift(layoutShifts)
            : undefined
        : undefined,
    ),
    ...optionalMetric(
      "interactionLatencyMs",
      supportsEntryType(after, "event")
        ? (maximum(events.map((entry) => entry.duration)) ?? 0)
        : undefined,
    ),
    ...optionalMetric(
      "longTaskDurationMs",
      supportsEntryType(after, "longtask")
        ? sumDurations(longTasks)
        : undefined,
    ),
    ...optionalMetric(
      "longAnimationFrameDurationMs",
      supportsEntryType(after, "long-animation-frame")
        ? sumDurations(longAnimationFrames)
        : undefined,
    ),
    ...optionalMetric("scenarioDurationMs", scenarioMeasure?.duration),
  };

  return {
    device,
    scenario,
    run,
    metrics,
    network: {
      requestCount: resources.length + navigationEntries.length,
      transferBytes:
        resources.reduce((total, entry) => total + entry.transferSize, 0) +
        navigationEntries.reduce(
          (total, entry) => total + entry.transferSize,
          0,
        ),
    },
  };
}

/** Keeps entries that began after the previous snapshot. */
function entriesSince<T extends SerializablePerformanceEntry>(
  entries: readonly T[],
  startTime: number,
): T[] {
  return entries.filter((entry) => entry.startTime >= startTime);
}

/** Omits optional metrics when the browser API did not provide a value. */
function optionalMetric<Key extends keyof BrowserPerformanceMetrics>(
  key: Key,
  value: number | undefined,
): Pick<BrowserPerformanceMetrics, Key> | Record<never, never> {
  return value === undefined || !Number.isFinite(value) || value < 0
    ? {}
    : ({ [key]: value } as Pick<BrowserPerformanceMetrics, Key>);
}

/** Sums durations, including a meaningful zero for supported APIs. */
function sumDurations(
  entries: readonly SerializablePerformanceEntry[],
): number {
  return entries.reduce((total, entry) => total + entry.duration, 0);
}

/** Returns the largest value without sorting or mutating metric data. */
function maximum(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  let result = values[0];
  for (const value of values) {
    result = Math.max(result ?? value, value);
  }

  return result;
}

/** Distinguishes an unsupported browser API from a supported zero-entry result. */
function supportsEntryType(
  snapshot: BrowserMetricsSnapshot,
  entryType: string,
): boolean {
  return snapshot.supportedEntryTypes.includes(entryType);
}

/** Uses a bounded retry policy for production navigation availability. */
async function navigateWithRetries(page: Page, url: string): Promise<void> {
  await retryNavigation(async () => {
    const response = await page.goto(url, { waitUntil: "load" });
    await assertSuccessfulNavigation(response);
  });
}

/** Uses the same bounded retry policy for warm reloads. */
async function reloadWithRetries(page: Page): Promise<void> {
  await retryNavigation(async () => {
    const response = await page.reload({ waitUntil: "load" });
    await assertSuccessfulNavigation(response);
  });
}

/** Retries only bounded production availability failures. */
async function retryNavigation(action: () => Promise<void>): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= NAVIGATION_RETRY_COUNT; attempt += 1) {
    try {
      await action();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < NAVIGATION_RETRY_COUNT) {
        await new Promise((resolve) => {
          setTimeout(resolve, NAVIGATION_RETRY_DELAY_MS * attempt);
        });
      }
    }
  }

  throw lastError;
}

/** Waits for the expected first-party API response so its status enters the HAR. */
function waitForResponsePath(page: Page, path: string): Promise<Response> {
  const response = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return response.request().method() === "GET" && url.pathname === path;
    },
    { timeout: RESPONSE_TIMEOUT_MS },
  );

  // Keep the original promise awaitable while observing early action failures.
  void response.catch(() => {});
  return response;
}

/** Rejects unavailable production document navigations with a useful status. */
async function assertSuccessfulNavigation(
  response: Response | null,
): Promise<void> {
  if (!response) {
    throw new Error(
      "Production navigation completed without an HTTP response.",
    );
  }

  if (!response.ok()) {
    throw new Error(
      `Production request failed with ${response.status()} ${response.statusText()} for ${response.url()}.`,
    );
  }
}

/** Keeps non-success API responses in evidence while making them explicit to operators. */
async function recordResponseEvidence(
  response: Response,
  scenario: string,
): Promise<void> {
  if (!response.ok()) {
    process.stderr.write(
      `Recorded HTTP ${response.status()} for ${scenario}: ${response.url()}\n`,
    );
  }
}

/** Waits for result copy and loading placeholders to settle. */
async function waitForCollection(
  page: Page,
  collectionSelector: string,
  skeletonSelector: string,
): Promise<void> {
  await page.locator(".ResultCount").waitFor({ state: "visible" });
  await page
    .locator(`${collectionSelector}, ${collectionSelector}-empty`)
    .first()
    .waitFor({ state: "visible" });
  await page.locator(skeletonSelector).first().waitFor({ state: "detached" });
  await waitForRenderingOpportunity(page);
}

/** Waits for two animation frames so browser observers see the committed UI. */
async function waitForRenderingOpportunity(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      }),
  );
}

/** Produces stable custom mark and measure names. */
function scenarioMeasureName(scenario: string): string {
  return `makerbench:scenario:${scenario}`;
}
