import { describe, expect, it } from "vitest";

import type { BrowserMetricsSnapshot } from "../browser-metrics.ts";
import { createPerformanceRun } from "../scenarios.ts";

function createSnapshot(
  overrides: Partial<BrowserMetricsSnapshot> = {},
): BrowserMetricsSnapshot {
  return {
    timeOrigin: 1_000,
    capturedAt: 500,
    supportedEntryTypes: [],
    navigation: [],
    resources: [],
    paints: [],
    largestContentfulPaint: [],
    lcp: null,
    layoutShifts: [],
    cls: 0,
    events: [],
    longTasks: [],
    longAnimationFrames: [],
    marks: [],
    measures: [],
    droppedEntries: {
      navigation: 0,
      resource: 0,
      paint: 0,
      largestContentfulPaint: 0,
      layoutShift: 0,
      event: 0,
      longTask: 0,
      longAnimationFrame: 0,
      mark: 0,
      measure: 0,
    },
    ...overrides,
  };
}

describe("createPerformanceRun", () => {
  it("maps navigation metrics and transfer totals into the summary contract", () => {
    const after = createSnapshot({
      supportedEntryTypes: ["layout-shift"],
      navigation: [
        {
          name: "https://makerbench.schalkneethling.com/",
          entryType: "navigation",
          startTime: 0,
          duration: 1_000,
          initiatorType: "navigation",
          nextHopProtocol: "h2",
          workerStart: 0,
          redirectStart: 0,
          redirectEnd: 0,
          fetchStart: 5,
          domainLookupStart: 5,
          domainLookupEnd: 10,
          connectStart: 10,
          secureConnectionStart: 12,
          connectEnd: 20,
          requestStart: 20,
          responseStart: 100,
          responseEnd: 200,
          transferSize: 1_000,
          encodedBodySize: 900,
          decodedBodySize: 2_000,
          serverTiming: [],
          type: "navigate",
          unloadEventStart: 0,
          unloadEventEnd: 0,
          domInteractive: 600,
          domContentLoadedEventStart: 650,
          domContentLoadedEventEnd: 675,
          domComplete: 950,
          loadEventStart: 975,
          loadEventEnd: 1_000,
          redirectCount: 0,
        },
      ],
      resources: [
        {
          name: "https://makerbench.schalkneethling.com/app.js",
          entryType: "resource",
          startTime: 20,
          duration: 100,
          initiatorType: "script",
          nextHopProtocol: "h2",
          workerStart: 0,
          redirectStart: 0,
          redirectEnd: 0,
          fetchStart: 20,
          domainLookupStart: 0,
          domainLookupEnd: 0,
          connectStart: 0,
          secureConnectionStart: 0,
          connectEnd: 0,
          requestStart: 25,
          responseStart: 50,
          responseEnd: 120,
          transferSize: 2_000,
          encodedBodySize: 1_900,
          decodedBodySize: 4_000,
          serverTiming: [],
        },
      ],
      paints: [
        {
          name: "first-contentful-paint",
          entryType: "paint",
          startTime: 300,
          duration: 0,
        },
      ],
      lcp: {
        name: "",
        entryType: "largest-contentful-paint",
        startTime: 450,
        duration: 0,
        renderTime: 450,
        loadTime: 0,
        size: 20_000,
        id: "",
        url: "",
      },
      cls: 0.03,
      measures: [
        {
          name: "makerbench:scenario:cold-tools-load",
          entryType: "measure",
          startTime: 0,
          duration: 1_100,
        },
      ],
    });

    expect(
      createPerformanceRun({
        device: "desktop",
        run: 1,
        scenario: "cold-tools-load",
        measurement: {
          after,
          measureName: "makerbench:scenario:cold-tools-load",
          navigation: true,
        },
      }),
    ).toEqual({
      device: "desktop",
      run: 1,
      scenario: "cold-tools-load",
      metrics: {
        navigationDurationMs: 1_000,
        firstContentfulPaintMs: 300,
        largestContentfulPaintMs: 450,
        cumulativeLayoutShift: 0.03,
        scenarioDurationMs: 1_100,
      },
      network: {
        requestCount: 2,
        transferBytes: 3_000,
      },
    });
  });

  it("uses only entries added after an interaction starts", () => {
    const before = createSnapshot({ capturedAt: 500, cls: 0.02 });
    const after = createSnapshot({
      capturedAt: 800,
      cls: 0.05,
      supportedEntryTypes: [
        "event",
        "layout-shift",
        "long-animation-frame",
        "longtask",
      ],
      layoutShifts: [
        {
          name: "",
          entryType: "layout-shift",
          startTime: 625,
          duration: 0,
          value: 0.03,
          hadRecentInput: false,
          lastInputTime: 0,
        },
      ],
      resources: [
        {
          name: "old",
          entryType: "resource",
          startTime: 400,
          duration: 10,
          initiatorType: "fetch",
          nextHopProtocol: "h2",
          workerStart: 0,
          redirectStart: 0,
          redirectEnd: 0,
          fetchStart: 400,
          domainLookupStart: 0,
          domainLookupEnd: 0,
          connectStart: 0,
          secureConnectionStart: 0,
          connectEnd: 0,
          requestStart: 400,
          responseStart: 405,
          responseEnd: 410,
          transferSize: 100,
          encodedBodySize: 100,
          decodedBodySize: 100,
          serverTiming: [],
        },
        {
          name: "new",
          entryType: "resource",
          startTime: 550,
          duration: 20,
          initiatorType: "fetch",
          nextHopProtocol: "h2",
          workerStart: 0,
          redirectStart: 0,
          redirectEnd: 0,
          fetchStart: 550,
          domainLookupStart: 0,
          domainLookupEnd: 0,
          connectStart: 0,
          secureConnectionStart: 0,
          connectEnd: 0,
          requestStart: 550,
          responseStart: 560,
          responseEnd: 570,
          transferSize: 250,
          encodedBodySize: 250,
          decodedBodySize: 250,
          serverTiming: [],
        },
      ],
      events: [
        {
          name: "click",
          entryType: "event",
          startTime: 600,
          duration: 48,
          interactionId: 1,
          processingStart: 610,
          processingEnd: 620,
          cancelable: true,
          target: null,
        },
      ],
      measures: [
        {
          name: "makerbench:scenario:tool-text-search",
          entryType: "measure",
          startTime: 500,
          duration: 300,
        },
      ],
    });

    expect(
      createPerformanceRun({
        device: "mobile",
        run: 2,
        scenario: "tool-text-search",
        measurement: {
          before,
          after,
          measureName: "makerbench:scenario:tool-text-search",
          navigation: false,
        },
      }),
    ).toMatchObject({
      metrics: {
        cumulativeLayoutShift: 0.03,
        interactionLatencyMs: 48,
        longTaskDurationMs: 0,
        longAnimationFrameDurationMs: 0,
        scenarioDurationMs: 300,
      },
      network: {
        requestCount: 1,
        transferBytes: 250,
      },
    });
  });
});
