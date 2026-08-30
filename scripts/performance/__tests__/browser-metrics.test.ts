import { afterEach, describe, expect, it, vi } from "vitest";

import {
  browserMetricsInitScript,
  calculateCumulativeLayoutShift,
  collectBrowserMetrics,
  installBrowserMetrics,
  keepRecentEntries,
  markBrowserTiming,
  measureBrowserTiming,
  type BrowserMetricsSnapshot,
} from "../browser-metrics.ts";

const METRICS_GLOBAL = "__makerbenchBrowserMetrics__";

interface FakeEntry extends PerformanceEntry {
  value?: number;
  hadRecentInput?: boolean;
  lastInputTime?: number;
}

interface InstalledCollector {
  snapshot: () => BrowserMetricsSnapshot;
}

class FakePerformanceObserver {
  static readonly supportedEntryTypes = [
    "event",
    "largest-contentful-paint",
    "layout-shift",
    "long-animation-frame",
    "longtask",
  ];

  static instances: FakePerformanceObserver[] = [];

  readonly callback: PerformanceObserverCallback;
  observedType = "";
  records: PerformanceEntry[] = [];

  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback;
    FakePerformanceObserver.instances.push(this);
  }

  /** Records the requested type for controlled observer emissions. */
  observe(options: PerformanceObserverInit): void {
    this.observedType = options.type ?? options.entryTypes?.[0] ?? "";
  }

  /** Returns and clears records waiting to be flushed. */
  takeRecords(): PerformanceEntry[] {
    return this.records.splice(0);
  }

  /** Matches the browser API used by the installation fallback. */
  disconnect(): void {}

  /** Queues entries so snapshot flushing exercises the observer consumer. */
  static queue(entryType: string, entries: FakeEntry[]): void {
    const observer = FakePerformanceObserver.instances.find((candidate) => {
      return candidate.observedType === entryType;
    });

    if (!observer) {
      throw new Error(`No observer registered for ${entryType}`);
    }

    observer.records.push(...entries);
  }
}

afterEach(() => {
  FakePerformanceObserver.instances = [];
  vi.unstubAllGlobals();
});

describe("calculateCumulativeLayoutShift", () => {
  it("uses the largest session window and excludes recent-input shifts", () => {
    expect(
      calculateCumulativeLayoutShift([
        { startTime: 100, value: 0.04, hadRecentInput: false },
        { startTime: 800, value: 0.05, hadRecentInput: false },
        { startTime: 1_000, value: 0.8, hadRecentInput: true },
        { startTime: 2_000, value: 0.2, hadRecentInput: false },
        { startTime: 7_100, value: 0.07, hadRecentInput: false },
      ]),
    ).toBe(0.2);
  });

  it("sorts entries before building session windows", () => {
    expect(
      calculateCumulativeLayoutShift([
        { startTime: 900, value: 0.03, hadRecentInput: false },
        { startTime: 100, value: 0.02, hadRecentInput: false },
      ]),
    ).toBe(0.05);
  });
});

describe("keepRecentEntries", () => {
  it("orders monotonic entries, rejects invalid timestamps, and retains the newest values", () => {
    const entries = keepRecentEntries(
      [
        { startTime: 30, name: "third" },
        { startTime: -1, name: "invalid" },
        { startTime: 10, name: "first" },
        { startTime: 20, name: "second" },
      ],
      2,
    );

    expect(entries.map(({ name }) => name)).toEqual(["second", "third"]);
  });
});

describe("browserMetricsInitScript", () => {
  it("collects buffered observer entries, computes CLS, and bounds diagnostic buffers", () => {
    const fakeWindow: Record<string, unknown> = {};
    const timelineEntries: Record<string, PerformanceEntry[]> = {
      navigation: [],
      resource: [],
      paint: [
        {
          name: "first-contentful-paint",
          entryType: "paint",
          startTime: 50,
          duration: 0,
        } as PerformanceEntry,
      ],
      mark: [],
      measure: [],
    };
    const setResourceTimingBufferSize = vi.fn();
    const fakePerformance = {
      timeOrigin: 1_000,
      now: () => 120,
      getEntriesByType: (entryType: string) => timelineEntries[entryType] ?? [],
      setResourceTimingBufferSize,
    } as unknown as Performance;

    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("performance", fakePerformance);
    vi.stubGlobal(
      "PerformanceObserver",
      FakePerformanceObserver as unknown as typeof PerformanceObserver,
    );

    browserMetricsInitScript({ maxEntries: 2, eventDurationThreshold: 16 });

    expect(setResourceTimingBufferSize).toHaveBeenCalledWith(3);

    FakePerformanceObserver.queue("layout-shift", [
      createEntry("layout-shift", 10, {
        value: 0.03,
        hadRecentInput: false,
        lastInputTime: 0,
      }),
      createEntry("layout-shift", 20, {
        value: 0.9,
        hadRecentInput: true,
        lastInputTime: 19,
      }),
      createEntry("layout-shift", 30, {
        value: 0.04,
        hadRecentInput: false,
        lastInputTime: 0,
      }),
    ]);
    FakePerformanceObserver.queue("largest-contentful-paint", [
      {
        ...createEntry("largest-contentful-paint", 70),
        renderTime: 70,
        loadTime: 0,
        size: 2_000,
        id: "hero",
        url: "",
        element: null,
      } as LargestContentfulPaint,
    ]);

    const collector = fakeWindow[METRICS_GLOBAL] as InstalledCollector;
    const snapshot = collector.snapshot();

    expect(snapshot.cls).toBeCloseTo(0.07);
    expect(snapshot.layoutShifts.map(({ startTime }) => startTime)).toEqual([
      20, 30,
    ]);
    expect(snapshot.droppedEntries.layoutShift).toBe(1);
    expect(snapshot.lcp?.id).toBe("hero");
    expect(snapshot.paints).toEqual([
      {
        name: "first-contentful-paint",
        entryType: "paint",
        startTime: 50,
        duration: 0,
      },
    ]);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("degrades to timeline metrics when PerformanceObserver is unavailable", () => {
    const fakeWindow: Record<string, unknown> = {};
    const setResourceTimingBufferSize = vi.fn();
    const fakePerformance = {
      timeOrigin: 1_000,
      now: () => 120,
      getEntriesByType: () => [],
      setResourceTimingBufferSize,
    } as unknown as Performance;

    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("performance", fakePerformance);
    vi.stubGlobal("PerformanceObserver", undefined);

    browserMetricsInitScript({ maxEntries: 10, eventDurationThreshold: 16 });

    const collector = fakeWindow[METRICS_GLOBAL] as InstalledCollector;
    const snapshot = collector.snapshot();

    expect(snapshot.supportedEntryTypes).toEqual([]);
    expect(snapshot.lcp).toBeNull();
    expect(snapshot.cls).toBe(0);
    expect(setResourceTimingBufferSize).toHaveBeenCalledWith(11);
  });

  it("sizes the native resource buffer and reports entries beyond the collector cap", () => {
    const fakeWindow: Record<string, unknown> = {};
    const resourceEntries = Array.from({ length: 501 }, (_, index) => {
      return {
        ...createEntry("resource", index),
        serverTiming: [],
      } as unknown as PerformanceResourceTiming;
    });
    const setResourceTimingBufferSize = vi.fn();
    const fakePerformance = {
      timeOrigin: 1_000,
      now: () => 600,
      getEntriesByType: (entryType: string) => {
        return entryType === "resource" ? resourceEntries : [];
      },
      setResourceTimingBufferSize,
    } as unknown as Performance;

    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("performance", fakePerformance);
    vi.stubGlobal("PerformanceObserver", undefined);

    browserMetricsInitScript({ maxEntries: 500, eventDurationThreshold: 16 });

    const collector = fakeWindow[METRICS_GLOBAL] as InstalledCollector;
    const snapshot = collector.snapshot();

    expect(setResourceTimingBufferSize).toHaveBeenCalledWith(501);
    expect(snapshot.resources).toHaveLength(500);
    expect(snapshot.droppedEntries.resource).toBe(1);
  });
});

describe("Playwright adapters", () => {
  it("installs the collector with normalized options before navigation", async () => {
    const addInitScript = vi.fn();
    const page = { addInitScript } as unknown as Parameters<
      typeof installBrowserMetrics
    >[0];

    await installBrowserMetrics(page, {
      maxEntries: 0,
      eventDurationThreshold: 4,
    });

    expect(addInitScript).toHaveBeenCalledWith(browserMetricsInitScript, {
      maxEntries: 1,
      eventDurationThreshold: 16,
    });
  });

  it("collects snapshots and manages custom marks and measures through page evaluation", async () => {
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce({ cls: 0.04 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const page = { evaluate } as unknown as Parameters<
      typeof collectBrowserMetrics
    >[0];

    await expect(collectBrowserMetrics(page)).resolves.toEqual({ cls: 0.04 });
    await markBrowserTiming(page, "makerbench:search-start");
    await measureBrowserTiming(page, {
      name: "makerbench:search",
      start: "makerbench:search-start",
      end: "makerbench:search-end",
    });

    expect(evaluate).toHaveBeenCalledTimes(3);
  });
});

/** Creates a minimal observer entry with optional specialized fields. */
function createEntry(
  entryType: string,
  startTime: number,
  fields: Partial<FakeEntry> = {},
): FakeEntry {
  return {
    name: entryType,
    entryType,
    startTime,
    duration: 0,
    ...fields,
  } as FakeEntry;
}
