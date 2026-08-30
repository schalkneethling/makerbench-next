import type { Page } from "@playwright/test";

const DEFAULT_MAX_ENTRIES = 500;
const MINIMUM_EVENT_DURATION_THRESHOLD = 16;
const METRICS_GLOBAL = "__makerbenchBrowserMetrics__";

export interface BrowserMetricsOptions {
  maxEntries?: number;
  eventDurationThreshold?: number;
}

export interface SerializablePerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
}

export interface SerializableServerTiming {
  name: string;
  duration: number;
  description: string;
}

export interface SerializableResourceTiming extends SerializablePerformanceEntry {
  initiatorType: string;
  nextHopProtocol: string;
  workerStart: number;
  redirectStart: number;
  redirectEnd: number;
  fetchStart: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  secureConnectionStart: number;
  connectEnd: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  serverTiming: SerializableServerTiming[];
}

export interface SerializableNavigationTiming extends SerializableResourceTiming {
  type: string;
  unloadEventStart: number;
  unloadEventEnd: number;
  domInteractive: number;
  domContentLoadedEventStart: number;
  domContentLoadedEventEnd: number;
  domComplete: number;
  loadEventStart: number;
  loadEventEnd: number;
  redirectCount: number;
}

export type SerializablePaintTiming = SerializablePerformanceEntry;

export interface SerializableLargestContentfulPaint extends SerializablePerformanceEntry {
  renderTime: number;
  loadTime: number;
  size: number;
  id: string;
  url: string;
}

export interface SerializableLayoutShift extends SerializablePerformanceEntry {
  value: number;
  hadRecentInput: boolean;
  lastInputTime: number;
}

export interface SerializableEventTarget {
  nodeName: string;
  id: string;
}

export interface SerializableEventTiming extends SerializablePerformanceEntry {
  interactionId: number;
  processingStart: number;
  processingEnd: number;
  cancelable: boolean;
  target: SerializableEventTarget | null;
}

export interface SerializableTaskAttribution extends SerializablePerformanceEntry {
  containerType: string;
  containerName: string;
  containerId: string;
  containerSrc: string;
}

export interface SerializableLongTask extends SerializablePerformanceEntry {
  attribution: SerializableTaskAttribution[];
}

export interface SerializableScriptTiming extends SerializablePerformanceEntry {
  invoker: string;
  invokerType: string;
  sourceURL: string;
  sourceFunctionName: string;
  sourceCharPosition: number;
  executionStart: number;
  forcedStyleAndLayoutDuration: number;
  pauseDuration: number;
  windowAttribution: string;
}

export interface SerializableLongAnimationFrame extends SerializablePerformanceEntry {
  renderStart: number;
  styleAndLayoutStart: number;
  firstUIEventTimestamp: number;
  blockingDuration: number;
  scripts: SerializableScriptTiming[];
}

export interface BrowserMetricsDroppedEntries {
  navigation: number;
  resource: number;
  paint: number;
  largestContentfulPaint: number;
  layoutShift: number;
  event: number;
  longTask: number;
  longAnimationFrame: number;
  mark: number;
  measure: number;
}

export interface BrowserMetricsSnapshot {
  timeOrigin: number;
  capturedAt: number;
  supportedEntryTypes: string[];
  navigation: SerializableNavigationTiming[];
  resources: SerializableResourceTiming[];
  paints: SerializablePaintTiming[];
  largestContentfulPaint: SerializableLargestContentfulPaint[];
  lcp: SerializableLargestContentfulPaint | null;
  layoutShifts: SerializableLayoutShift[];
  cls: number;
  events: SerializableEventTiming[];
  longTasks: SerializableLongTask[];
  longAnimationFrames: SerializableLongAnimationFrame[];
  marks: SerializablePerformanceEntry[];
  measures: SerializablePerformanceEntry[];
  droppedEntries: BrowserMetricsDroppedEntries;
}

export interface BrowserMeasureOptions {
  name: string;
  start: string;
  end?: string;
}

interface BrowserMetricsCollector {
  snapshot: () => BrowserMetricsSnapshot;
}

type LayoutShiftForScore = Pick<
  SerializableLayoutShift,
  "startTime" | "value" | "hadRecentInput"
>;

/**
 * Calculates CLS using the largest session window and ignores shifts after recent input.
 */
export function calculateCumulativeLayoutShift(
  entries: readonly LayoutShiftForScore[],
): number {
  const shifts = entries
    .filter(({ hadRecentInput, startTime, value }) => {
      return (
        !hadRecentInput &&
        Number.isFinite(startTime) &&
        Number.isFinite(value) &&
        value >= 0
      );
    })
    .toSorted((first, second) => first.startTime - second.startTime);

  let maximumScore = 0;
  let sessionScore = 0;
  let sessionStart = 0;
  let previousShift = 0;

  for (const shift of shifts) {
    const startsNewSession =
      sessionScore === 0 ||
      shift.startTime - previousShift > 1_000 ||
      shift.startTime - sessionStart > 5_000;

    if (startsNewSession) {
      sessionStart = shift.startTime;
      sessionScore = shift.value;
    } else {
      sessionScore += shift.value;
    }

    previousShift = shift.startTime;
    maximumScore = Math.max(maximumScore, sessionScore);
  }

  return maximumScore;
}

/**
 * Keeps the most recent entries from a monotonic performance timeline.
 */
export function keepRecentEntries<
  T extends Pick<PerformanceEntry, "startTime">,
>(entries: readonly T[], maximumEntries: number): T[] {
  const boundedMaximum = Math.max(1, Math.floor(maximumEntries));
  return entries
    .filter(({ startTime }) => Number.isFinite(startTime) && startTime >= 0)
    .toSorted((first, second) => first.startTime - second.startTime)
    .slice(-boundedMaximum);
}

/**
 * Installs observers in every new document before navigation begins.
 */
export async function installBrowserMetrics(
  page: Page,
  options: BrowserMetricsOptions = {},
): Promise<void> {
  await page.addInitScript(browserMetricsInitScript, {
    maxEntries: normalizeMaximumEntries(options.maxEntries),
    eventDurationThreshold: normalizeEventDurationThreshold(
      options.eventDurationThreshold,
    ),
  });
}

/**
 * Reads a serialization-safe snapshot from the active document.
 */
export async function collectBrowserMetrics(
  page: Page,
): Promise<BrowserMetricsSnapshot> {
  return page.evaluate((globalName) => {
    const host = window as unknown as Record<string, unknown>;
    const collector = host[globalName] as BrowserMetricsCollector | undefined;

    if (!collector) {
      throw new Error(
        "Browser metrics are not installed. Call installBrowserMetrics() before navigation.",
      );
    }

    return collector.snapshot();
  }, METRICS_GLOBAL);
}

/**
 * Replaces a custom mark so repeated scenarios cannot grow the performance timeline unboundedly.
 */
export async function markBrowserTiming(
  page: Page,
  name: string,
): Promise<void> {
  await page.evaluate((markName) => {
    performance.clearMarks(markName);
    performance.mark(markName);
  }, name);
}

/**
 * Replaces a custom measure between scenario marks.
 */
export async function measureBrowserTiming(
  page: Page,
  options: BrowserMeasureOptions,
): Promise<void> {
  await page.evaluate(({ name, start, end }) => {
    performance.clearMeasures(name);
    performance.measure(name, start, end);
  }, options);
}

/**
 * Normalizes the shared buffer limit before passing it into the page.
 */
function normalizeMaximumEntries(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_MAX_ENTRIES;
  }

  return Math.max(1, Math.floor(value));
}

/**
 * Uses the Event Timing API's lowest portable duration threshold.
 */
function normalizeEventDurationThreshold(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return MINIMUM_EVENT_DURATION_THRESHOLD;
  }

  return Math.max(MINIMUM_EVENT_DURATION_THRESHOLD, Math.floor(value));
}

/**
 * Runs inside the browser. Keep all runtime helpers local because Playwright serializes this function.
 */
export function browserMetricsInitScript(
  options: Required<BrowserMetricsOptions>,
): void {
  interface LayoutShiftEntryLike extends PerformanceEntry {
    value: number;
    hadRecentInput: boolean;
    lastInputTime: number;
  }

  interface TaskAttributionLike extends PerformanceEntry {
    containerType?: string;
    containerName?: string;
    containerId?: string;
    containerSrc?: string;
  }

  interface LongTaskEntryLike extends PerformanceEntry {
    attribution?: TaskAttributionLike[];
  }

  interface ScriptTimingLike extends PerformanceEntry {
    invoker?: string;
    invokerType?: string;
    sourceURL?: string;
    sourceFunctionName?: string;
    sourceCharPosition?: number;
    executionStart?: number;
    forcedStyleAndLayoutDuration?: number;
    pauseDuration?: number;
    windowAttribution?: string;
  }

  interface LongAnimationFrameEntryLike extends PerformanceEntry {
    renderStart?: number;
    styleAndLayoutStart?: number;
    firstUIEventTimestamp?: number;
    blockingDuration?: number;
    scripts?: ScriptTimingLike[];
  }

  interface EventObserverOptions extends PerformanceObserverInit {
    durationThreshold?: number;
  }

  interface ObserverRegistration {
    observer: PerformanceObserver;
    consume: (entries: PerformanceEntry[]) => void;
  }

  const globalName = "__makerbenchBrowserMetrics__";
  const host = window as unknown as Record<string, unknown>;

  if (host[globalName]) {
    return;
  }

  const maximumEntries = Math.max(1, Math.floor(options.maxEntries));
  performance.setResourceTimingBufferSize(maximumEntries + 1);
  const supportedEntryTypes =
    typeof PerformanceObserver === "undefined"
      ? []
      : [...PerformanceObserver.supportedEntryTypes].toSorted();
  const supportedEntryTypeSet = new Set(supportedEntryTypes);
  const registrations: ObserverRegistration[] = [];
  const lcpEntries: SerializableLargestContentfulPaint[] = [];
  const layoutShiftEntries: SerializableLayoutShift[] = [];
  const eventEntries: SerializableEventTiming[] = [];
  const longTaskEntries: SerializableLongTask[] = [];
  const longAnimationFrameEntries: SerializableLongAnimationFrame[] = [];
  const observedDroppedEntries = {
    largestContentfulPaint: 0,
    layoutShift: 0,
    event: 0,
    longTask: 0,
    longAnimationFrame: 0,
  };

  let cls = 0;
  let clsSessionScore = 0;
  let clsSessionStart = 0;
  let previousLayoutShift = 0;

  /** Returns a finite monotonic value or a safe zero. */
  function timingValue(value: number | undefined): number {
    return value !== undefined && Number.isFinite(value) && value >= 0
      ? value
      : 0;
  }

  /** Returns a string value without retaining DOM or platform objects. */
  function stringValue(value: string | undefined): string {
    return typeof value === "string" ? value : "";
  }

  /** Serializes the common PerformanceEntry fields. */
  function serializeEntry(
    entry: PerformanceEntry,
  ): SerializablePerformanceEntry {
    return {
      name: entry.name,
      entryType: entry.entryType,
      startTime: timingValue(entry.startTime),
      duration: timingValue(entry.duration),
    };
  }

  /** Serializes server timing without relying on PerformanceEntry.toJSON(). */
  function serializeServerTiming(entries: readonly PerformanceServerTiming[]) {
    return entries.map((entry) => ({
      name: entry.name,
      duration: timingValue(entry.duration),
      description: entry.description,
    }));
  }

  /** Serializes resource timing fields used by transfer and request analysis. */
  function serializeResource(
    entry: PerformanceResourceTiming,
  ): SerializableResourceTiming {
    return {
      ...serializeEntry(entry),
      initiatorType: entry.initiatorType,
      nextHopProtocol: entry.nextHopProtocol,
      workerStart: timingValue(entry.workerStart),
      redirectStart: timingValue(entry.redirectStart),
      redirectEnd: timingValue(entry.redirectEnd),
      fetchStart: timingValue(entry.fetchStart),
      domainLookupStart: timingValue(entry.domainLookupStart),
      domainLookupEnd: timingValue(entry.domainLookupEnd),
      connectStart: timingValue(entry.connectStart),
      secureConnectionStart: timingValue(entry.secureConnectionStart),
      connectEnd: timingValue(entry.connectEnd),
      requestStart: timingValue(entry.requestStart),
      responseStart: timingValue(entry.responseStart),
      responseEnd: timingValue(entry.responseEnd),
      transferSize: timingValue(entry.transferSize),
      encodedBodySize: timingValue(entry.encodedBodySize),
      decodedBodySize: timingValue(entry.decodedBodySize),
      serverTiming: serializeServerTiming(entry.serverTiming),
    };
  }

  /** Serializes navigation milestones alongside its resource timing fields. */
  function serializeNavigation(
    entry: PerformanceNavigationTiming,
  ): SerializableNavigationTiming {
    return {
      ...serializeResource(entry),
      type: entry.type,
      unloadEventStart: timingValue(entry.unloadEventStart),
      unloadEventEnd: timingValue(entry.unloadEventEnd),
      domInteractive: timingValue(entry.domInteractive),
      domContentLoadedEventStart: timingValue(entry.domContentLoadedEventStart),
      domContentLoadedEventEnd: timingValue(entry.domContentLoadedEventEnd),
      domComplete: timingValue(entry.domComplete),
      loadEventStart: timingValue(entry.loadEventStart),
      loadEventEnd: timingValue(entry.loadEventEnd),
      redirectCount: timingValue(entry.redirectCount),
    };
  }

  /** Serializes an LCP candidate without retaining its DOM element. */
  function serializeLcp(
    entry: LargestContentfulPaint,
  ): SerializableLargestContentfulPaint {
    return {
      ...serializeEntry(entry),
      renderTime: timingValue(entry.renderTime),
      loadTime: timingValue(entry.loadTime),
      size: timingValue(entry.size),
      id: entry.id,
      url: entry.url,
    };
  }

  /** Serializes a layout shift and its input-exclusion fields. */
  function serializeLayoutShift(
    entry: LayoutShiftEntryLike,
  ): SerializableLayoutShift {
    return {
      ...serializeEntry(entry),
      value: timingValue(entry.value),
      hadRecentInput: entry.hadRecentInput,
      lastInputTime: timingValue(entry.lastInputTime),
    };
  }

  /** Serializes an event target without retaining a DOM node. */
  function serializeEventTarget(
    target: Node | null,
  ): SerializableEventTarget | null {
    if (!target) {
      return null;
    }

    const candidate = target as Node & { id?: string };
    return {
      nodeName: candidate.nodeName,
      id: stringValue(candidate.id),
    };
  }

  /** Serializes native Event Timing fields for synthetic Playwright interactions. */
  function serializeEvent(
    entry: PerformanceEventTiming,
  ): SerializableEventTiming {
    return {
      ...serializeEntry(entry),
      interactionId: timingValue(entry.interactionId),
      processingStart: timingValue(entry.processingStart),
      processingEnd: timingValue(entry.processingEnd),
      cancelable: entry.cancelable,
      target: serializeEventTarget(entry.target),
    };
  }

  /** Serializes attribution for a long task. */
  function serializeTaskAttribution(
    entry: TaskAttributionLike,
  ): SerializableTaskAttribution {
    return {
      ...serializeEntry(entry),
      containerType: stringValue(entry.containerType),
      containerName: stringValue(entry.containerName),
      containerId: stringValue(entry.containerId),
      containerSrc: stringValue(entry.containerSrc),
    };
  }

  /** Serializes a long task and its container attribution. */
  function serializeLongTask(entry: LongTaskEntryLike): SerializableLongTask {
    return {
      ...serializeEntry(entry),
      attribution: (entry.attribution ?? []).map(serializeTaskAttribution),
    };
  }

  /** Serializes script attribution from the Long Animation Frames API. */
  function serializeScriptTiming(
    entry: ScriptTimingLike,
  ): SerializableScriptTiming {
    return {
      ...serializeEntry(entry),
      invoker: stringValue(entry.invoker),
      invokerType: stringValue(entry.invokerType),
      sourceURL: stringValue(entry.sourceURL),
      sourceFunctionName: stringValue(entry.sourceFunctionName),
      sourceCharPosition: timingValue(entry.sourceCharPosition),
      executionStart: timingValue(entry.executionStart),
      forcedStyleAndLayoutDuration: timingValue(
        entry.forcedStyleAndLayoutDuration,
      ),
      pauseDuration: timingValue(entry.pauseDuration),
      windowAttribution: stringValue(entry.windowAttribution),
    };
  }

  /** Serializes a Long Animation Frame and its script attribution. */
  function serializeLongAnimationFrame(
    entry: LongAnimationFrameEntryLike,
  ): SerializableLongAnimationFrame {
    return {
      ...serializeEntry(entry),
      renderStart: timingValue(entry.renderStart),
      styleAndLayoutStart: timingValue(entry.styleAndLayoutStart),
      firstUIEventTimestamp: timingValue(entry.firstUIEventTimestamp),
      blockingDuration: timingValue(entry.blockingDuration),
      scripts: (entry.scripts ?? []).map(serializeScriptTiming),
    };
  }

  /** Appends entries and drops the oldest values when the buffer reaches its limit. */
  function appendBounded<T>(
    target: T[],
    additions: readonly T[],
    droppedEntryType: keyof typeof observedDroppedEntries,
  ): void {
    target.push(...additions);
    const overflow = Math.max(0, target.length - maximumEntries);

    if (overflow > 0) {
      target.splice(0, overflow);
      observedDroppedEntries[droppedEntryType] += overflow;
    }
  }

  /** Updates CLS incrementally so bounding the diagnostic shift buffer cannot change the score. */
  function updateCls(entries: readonly SerializableLayoutShift[]): void {
    for (const entry of entries) {
      if (entry.hadRecentInput) {
        continue;
      }

      const startsNewSession =
        clsSessionScore === 0 ||
        entry.startTime - previousLayoutShift > 1_000 ||
        entry.startTime - clsSessionStart > 5_000;

      if (startsNewSession) {
        clsSessionStart = entry.startTime;
        clsSessionScore = entry.value;
      } else {
        clsSessionScore += entry.value;
      }

      previousLayoutShift = entry.startTime;
      cls = Math.max(cls, clsSessionScore);
    }
  }

  /** Registers an observer with a fallback for browsers that reject buffered options. */
  function observe(
    entryType: string,
    consume: (entries: PerformanceEntry[]) => void,
    observerOptions: PerformanceObserverInit,
  ): void {
    if (
      typeof PerformanceObserver === "undefined" ||
      !supportedEntryTypeSet.has(entryType)
    ) {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      consume(list.getEntries());
    });

    try {
      observer.observe(observerOptions);
    } catch {
      try {
        observer.observe({ entryTypes: [entryType] });
      } catch {
        observer.disconnect();
        return;
      }
    }

    registrations.push({ observer, consume });
  }

  observe(
    "largest-contentful-paint",
    (entries) => {
      appendBounded(
        lcpEntries,
        entries.map((entry) => serializeLcp(entry as LargestContentfulPaint)),
        "largestContentfulPaint",
      );
    },
    { type: "largest-contentful-paint", buffered: true },
  );

  observe(
    "layout-shift",
    (entries) => {
      const serializedEntries = entries.map((entry) => {
        return serializeLayoutShift(entry as LayoutShiftEntryLike);
      });
      updateCls(serializedEntries);
      appendBounded(layoutShiftEntries, serializedEntries, "layoutShift");
    },
    { type: "layout-shift", buffered: true },
  );

  observe(
    "event",
    (entries) => {
      appendBounded(
        eventEntries,
        entries.map((entry) => serializeEvent(entry as PerformanceEventTiming)),
        "event",
      );
    },
    {
      type: "event",
      buffered: true,
      durationThreshold: options.eventDurationThreshold,
    } as EventObserverOptions,
  );

  observe(
    "longtask",
    (entries) => {
      appendBounded(
        longTaskEntries,
        entries.map((entry) => serializeLongTask(entry as LongTaskEntryLike)),
        "longTask",
      );
    },
    { type: "longtask", buffered: true },
  );

  observe(
    "long-animation-frame",
    (entries) => {
      appendBounded(
        longAnimationFrameEntries,
        entries.map((entry) => {
          return serializeLongAnimationFrame(
            entry as LongAnimationFrameEntryLike,
          );
        }),
        "longAnimationFrame",
      );
    },
    { type: "long-animation-frame", buffered: true },
  );

  /** Flushes pending observer records before producing a snapshot. */
  function flushObservers(): void {
    for (const registration of registrations) {
      registration.consume(registration.observer.takeRecords());
    }
  }

  /** Sorts and bounds timeline entries, returning the number omitted. */
  function readTimelineEntries<T extends SerializablePerformanceEntry>(
    entryType: string,
    serialize: (entry: PerformanceEntry) => T,
  ): { entries: T[]; dropped: number } {
    const entries = performance
      .getEntriesByType(entryType)
      .map(serialize)
      .filter(({ startTime }) => Number.isFinite(startTime) && startTime >= 0)
      .toSorted((first, second) => first.startTime - second.startTime);
    const dropped = Math.max(0, entries.length - maximumEntries);

    return {
      entries: entries.slice(-maximumEntries),
      dropped,
    };
  }

  /** Returns the current document's serialization-safe performance evidence. */
  function snapshot(): BrowserMetricsSnapshot {
    flushObservers();

    const navigation = readTimelineEntries("navigation", (entry) => {
      return serializeNavigation(entry as PerformanceNavigationTiming);
    });
    const resources = readTimelineEntries("resource", (entry) => {
      return serializeResource(entry as PerformanceResourceTiming);
    });
    const paints = readTimelineEntries("paint", serializeEntry);
    const marks = readTimelineEntries("mark", serializeEntry);
    const measures = readTimelineEntries("measure", serializeEntry);
    const sortedLcpEntries = [...lcpEntries].toSorted(
      (first, second) => first.startTime - second.startTime,
    );
    const sortedLayoutShifts = [...layoutShiftEntries].toSorted(
      (first, second) => first.startTime - second.startTime,
    );
    const sortedEventEntries = [...eventEntries].toSorted(
      (first, second) => first.startTime - second.startTime,
    );
    const sortedLongTaskEntries = [...longTaskEntries].toSorted(
      (first, second) => first.startTime - second.startTime,
    );
    const sortedLongAnimationFrameEntries = [
      ...longAnimationFrameEntries,
    ].toSorted((first, second) => first.startTime - second.startTime);

    return {
      timeOrigin: timingValue(performance.timeOrigin),
      capturedAt: timingValue(performance.now()),
      supportedEntryTypes,
      navigation: navigation.entries,
      resources: resources.entries,
      paints: paints.entries,
      largestContentfulPaint: sortedLcpEntries,
      lcp: sortedLcpEntries.at(-1) ?? null,
      layoutShifts: sortedLayoutShifts,
      cls,
      events: sortedEventEntries,
      longTasks: sortedLongTaskEntries,
      longAnimationFrames: sortedLongAnimationFrameEntries,
      marks: marks.entries,
      measures: measures.entries,
      droppedEntries: {
        navigation: navigation.dropped,
        resource: resources.dropped,
        paint: paints.dropped,
        largestContentfulPaint: observedDroppedEntries.largestContentfulPaint,
        layoutShift: observedDroppedEntries.layoutShift,
        event: observedDroppedEntries.event,
        longTask: observedDroppedEntries.longTask,
        longAnimationFrame: observedDroppedEntries.longAnimationFrame,
        mark: marks.dropped,
        measure: measures.dropped,
      },
    };
  }

  Object.defineProperty(host, globalName, {
    value: { snapshot } satisfies BrowserMetricsCollector,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}
