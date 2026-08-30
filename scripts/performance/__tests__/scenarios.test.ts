import { describe, expect, it } from "vitest";

import type {
  BrowserMetricsSnapshot,
  SerializableResourceTiming,
} from "../browser-metrics.ts";
import {
  assertTargetOrigin,
  createPerformanceRun,
  matchesTargetResponse,
} from "../scenarios.ts";

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

/** Creates a bounded Resource Timing fixture. */
function createResource(
  name: string,
  startTime: number,
  transferSize: number,
): SerializableResourceTiming {
  return {
    name,
    entryType: "resource",
    startTime,
    duration: 20,
    initiatorType: "fetch",
    nextHopProtocol: "h2",
    workerStart: 0,
    redirectStart: 0,
    redirectEnd: 0,
    fetchStart: startTime,
    domainLookupStart: 0,
    domainLookupEnd: 0,
    connectStart: 0,
    secureConnectionStart: 0,
    connectEnd: 0,
    requestStart: startTime,
    responseStart: startTime + 10,
    responseEnd: startTime + 20,
    transferSize,
    encodedBodySize: transferSize,
    decodedBodySize: transferSize,
    serverTiming: [],
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
        createResource(
          "https://makerbench.schalkneethling.com/app.js",
          20,
          2_000,
        ),
        createResource("https://images.example/catalog.png", 30, 500_000),
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
        targetOrigin: "https://makerbench.schalkneethling.com",
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
        createResource("https://makerbench.schalkneethling.com/old", 400, 100),
        createResource("https://makerbench.schalkneethling.com/new", 550, 250),
        createResource(
          "https://cdn.makerbench.schalkneethling.com/new",
          560,
          1_000,
        ),
        createResource("http://makerbench.schalkneethling.com/new", 570, 1_000),
        createResource(
          "https://makerbench.schalkneethling.com:444/new",
          580,
          1_000,
        ),
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
        targetOrigin: "https://makerbench.schalkneethling.com",
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

  it("fails closed when Resource Timing contains a malformed URL", () => {
    const after = createSnapshot({
      resources: [createResource("not a URL", 20, 100)],
      measures: [
        {
          name: "makerbench:scenario:cold-tools-load",
          entryType: "measure",
          startTime: 0,
          duration: 100,
        },
      ],
    });

    expect(() =>
      createPerformanceRun({
        targetOrigin: "https://makerbench.schalkneethling.com",
        device: "desktop",
        run: 1,
        scenario: "cold-tools-load",
        measurement: {
          after,
          measureName: "makerbench:scenario:cold-tools-load",
          navigation: true,
        },
      }),
    ).toThrow("Resource Timing contained a malformed URL.");
  });

  it("fails closed when Resource Timing drops entries during a scenario", () => {
    const before = createSnapshot();
    const after = createSnapshot({
      droppedEntries: {
        ...createSnapshot().droppedEntries,
        resource: 1,
      },
      measures: [
        {
          name: "makerbench:scenario:tool-text-search",
          entryType: "measure",
          startTime: 500,
          duration: 100,
        },
      ],
    });

    expect(() =>
      createPerformanceRun({
        targetOrigin: "https://makerbench.schalkneethling.com",
        device: "desktop",
        run: 1,
        scenario: "tool-text-search",
        measurement: {
          before,
          after,
          measureName: "makerbench:scenario:tool-text-search",
          navigation: false,
        },
      }),
    ).toThrow("Resource Timing dropped entries during the measured scenario.");
  });

  it("does not carry a dropped-entry baseline across documents", () => {
    const before = createSnapshot({
      timeOrigin: 1_000,
      droppedEntries: {
        ...createSnapshot().droppedEntries,
        resource: 2,
      },
    });
    const after = createSnapshot({
      timeOrigin: 2_000,
      droppedEntries: {
        ...createSnapshot().droppedEntries,
        resource: 1,
      },
      measures: [
        {
          name: "makerbench:scenario:tool-text-search",
          entryType: "measure",
          startTime: 500,
          duration: 100,
        },
      ],
    });

    expect(() =>
      createPerformanceRun({
        targetOrigin: "https://makerbench.schalkneethling.com",
        device: "desktop",
        run: 1,
        scenario: "tool-text-search",
        measurement: {
          before,
          after,
          measureName: "makerbench:scenario:tool-text-search",
          navigation: false,
        },
      }),
    ).toThrow("Resource Timing dropped entries during the measured scenario.");
  });

  it("matches API responses only on the exact target origin", () => {
    const input = {
      method: "GET",
      path: "/api/tools/search",
      targetOrigin: "https://makerbench.schalkneethling.com",
    };

    expect(
      matchesTargetResponse({
        ...input,
        responseUrl:
          "https://makerbench.schalkneethling.com/api/tools/search?q=css",
      }),
    ).toBe(true);
    expect(
      matchesTargetResponse({
        ...input,
        responseUrl:
          "https://cdn.makerbench.schalkneethling.com/api/tools/search",
      }),
    ).toBe(false);
    expect(
      matchesTargetResponse({
        ...input,
        responseUrl:
          "https://makerbench.schalkneethling.com:444/api/tools/search",
      }),
    ).toBe(false);
    expect(
      matchesTargetResponse({
        ...input,
        method: "POST",
        responseUrl: "https://makerbench.schalkneethling.com/api/tools/search",
      }),
    ).toBe(false);
  });

  it("rejects a successful navigation that leaves the target origin", () => {
    expect(() =>
      assertTargetOrigin(
        "https://accounts.example/sign-in",
        "https://makerbench.schalkneethling.com",
      ),
    ).toThrow("Production navigation left the configured target origin.");

    expect(() =>
      assertTargetOrigin(
        "https://makerbench.schalkneethling.com/resources",
        "https://makerbench.schalkneethling.com",
      ),
    ).not.toThrow();
  });
});
